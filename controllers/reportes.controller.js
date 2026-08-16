const { request, response } = require('express');
const { Reporte, TIPOS_REPORTE } = require('../models/reportes');
const Usuarios = require('../models/usuarios');
const Equipos = require('../models/equipos');

const crearReporte = async (req = request, res = response) => {
    try {
        const { tipo, objetivoId, motivo, mensaje = '' } = req.body;
        const reportanteId = req.usuarioAuth._id;

        if (tipo === 'usuario') {
            if (String(objetivoId) === String(reportanteId)) {
                return res.status(400).json({ ok: false, error: 'No podes reportarte a vos mismo' });
            }
            const usuarioObjetivo = await Usuarios.findById(objetivoId).select('_id');
            if (!usuarioObjetivo) {
                return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
            }
        } else {
            const equipoObjetivo = await Equipos.findById(objetivoId).select('capitan');
            if (!equipoObjetivo) {
                return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
            }
            if (String(equipoObjetivo.capitan) === String(reportanteId)) {
                return res.status(400).json({ ok: false, error: 'No podes reportar tu propio equipo' });
            }
        }

        const reporte = await new Reporte({
            reportante: reportanteId,
            tipo,
            objetivoId,
            motivo,
            mensaje,
        }).save();

        return res.status(201).json({ ok: true, reporte });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

// Listado minimo para ADMIN/DEV -- sin pantalla dedicada todavia (queda
// para una fase de moderacion mas completa), pero el dato queda accesible
// para revision manual en vez de perderse.
const listarReportes = async (req = request, res = response) => {
    try {
        const { limit = 20, desde = 0, estado, tipo } = req.query;
        const query = {};

        if (estado) {
            query.estado = estado;
        }

        if (tipo && TIPOS_REPORTE.includes(tipo)) {
            query.tipo = tipo;
        }

        const [total, reportes] = await Promise.all([
            Reporte.countDocuments(query),
            Reporte.find(query)
                .populate('reportante', 'nombre apellido correo')
                .sort({ createdAt: -1 })
                .skip(Number(desde))
                .limit(Number(limit)),
        ]);

        return res.status(200).json({ ok: true, total, reportes });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

module.exports = {
    crearReporte,
    listarReportes,
};
