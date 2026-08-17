const { request, response } = require('express');
const { Reto } = require('../models/retos');
const { ResultadoReto } = require('../models/resultados-reto');
const { ADMIN_ROLES, tieneRol } = require('../middlewares/validar-roles');
const { puedeGestionarReto } = require('../helpers/retos-social');
const { identificarLadoReportante, resolveEstadoResultado } = require('../helpers/resultados-reto-social');

const esAdmin = (req) => tieneRol(req.usuarioAuth, ADMIN_ROLES);

// V3 del brief de diseño de Fase 5: la etiqueta ('Vos reportaste' / 'Marcela
// reportó') tiene que usar el nombre guardado en el reporte, no el capitan
// ACTUAL del equipo -- el rol puede cambiar despues del partido. Se puebla
// el usuario real que reporto, no se resuelve contra la membresia vigente.
const RESULTADO_POPULATE = [
    { path: 'reporteRetador.reportadoPor', select: 'nombre apellido' },
    { path: 'reporteRetado.reportadoPor', select: 'nombre apellido' },
];

const reportarResultado = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { golesRetador, golesRetado } = req.body;

        const reto = await Reto.findById(id)
            .populate('equipoRetador', 'capitan')
            .populate('equipoRetado', 'capitan');
        if (!reto) {
            return res.status(404).json({ ok: false, error: 'Reto no encontrado' });
        }

        if (reto.estado !== 'jugado') {
            return res.status(400).json({ ok: false, error: 'El reto todavia no se marco como jugado' });
        }

        const lado = identificarLadoReportante({
            capitanRetadorId: reto.equipoRetador.capitan,
            capitanRetadoId: reto.equipoRetado.capitan,
            usuarioId: req.usuarioAuth._id,
        });
        if (!lado) {
            return res.status(403).json({
                ok: false,
                error: 'Solo los capitanes de los 2 equipos pueden reportar el resultado',
            });
        }

        let resultado = await ResultadoReto.findOne({ reto: id });
        if (!resultado) {
            resultado = new ResultadoReto({ reto: id });
        }

        if (resultado.estado !== 'pendiente') {
            return res.status(400).json({
                ok: false,
                error: 'El resultado de este reto ya quedo definido',
            });
        }

        const reporte = {
            golesRetador,
            golesRetado,
            reportadoPor: req.usuarioAuth._id,
            reportadoEn: new Date(),
        };

        if (lado === 'retador') {
            resultado.reporteRetador = reporte;
        } else {
            resultado.reporteRetado = reporte;
        }

        resultado.estado = resolveEstadoResultado({
            reporteRetador: resultado.reporteRetador,
            reporteRetado: resultado.reporteRetado,
        });

        await resultado.save();
        await resultado.populate(RESULTADO_POPULATE);

        return res.status(200).json({ ok: true, resultado });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const obtenerResultado = async (req = request, res = response) => {
    try {
        const { id } = req.params;

        const reto = await Reto.findById(id)
            .populate('equipoRetador', 'capitan')
            .populate('equipoRetado', 'capitan');
        if (!reto) {
            return res.status(404).json({ ok: false, error: 'Reto no encontrado' });
        }

        const autorizado = puedeGestionarReto({
            capitanRetadorId: reto.equipoRetador.capitan,
            capitanRetadoId: reto.equipoRetado.capitan,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
        });
        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'No podes ver el resultado de este reto' });
        }

        const resultado = await ResultadoReto.findOne({ reto: id }).populate(RESULTADO_POPULATE);

        return res.status(200).json({ ok: true, resultado });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

module.exports = {
    reportarResultado,
    obtenerResultado,
    RESULTADO_POPULATE,
};
