const { request, response } = require("express");
const Partidos = require("../models/partidos");

const guardarPartido = async (req = request, res = response) => {
    try {
        const { jugado, resultado, equipos, usuarios } = req.body;
        const partido = new Partidos({ jugado, resultado, equipos, usuarios });

        await partido.save();

        return res.status(201).json({
            ok: true,
            partido
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerPartidos = async (req = request, res = response) => {
    const query = {};
    const { desde = 0, limit = 20 } = req.query;

    try {
        const [total, partidos] = await Promise.all([
            Partidos.countDocuments(query),
            Partidos.find(query)
                .populate('equipos.equipoUno equipos.equipoDos usuarios.usuarioUno usuarios.usuarioDos')
                .skip(Number(desde))
                .limit(Number(limit))
        ]);

        return res.status(200).json({
            ok: true,
            total,
            partidos
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerPartido = async (req = request, res = response) => {
    const { id } = req.params;
    const { tipo } = req.query;

    try {
        let partidos = [];

        if (tipo === 'misPartidos') {
            partidos = await Partidos.find({ "usuarios.usuarioUno": id })
                .populate('equipos.equipoUno equipos.equipoDos usuarios.usuarioUno usuarios.usuarioDos')
                .exec();
        }

        const partido = await Partidos.findById(id)
            .populate('equipos.equipoUno equipos.equipoDos usuarios.usuarioUno usuarios.usuarioDos')
            .exec();

        if (!partido && tipo !== 'misPartidos') {
            return res.status(404).json({
                ok: false,
                error: 'Partido no encontrado'
            });
        }

        return res.status(200).json({
            ok: true,
            total: partido ? 1 : 0,
            partido,
            partidos
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message || 'Error interno del servidor'
        });
    }
};

module.exports = {
    guardarPartido,
    obtenerPartidos,
    obtenerPartido
};
