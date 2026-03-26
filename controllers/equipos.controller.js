const { request, response } = require("express");
const Equipos = require("../models/equipos");

const obtenerEquipos = async (req = request, res = response) => {
    try {
        const { limit = 0, desde = 0 } = req.query;
        const query = { estado: true };

        const [total, equipos] = await Promise.all([
            Equipos.countDocuments(query),
            Equipos.find(query)
                .populate('usuario')
                .skip(Number(desde))
                .limit(Number(limit))
        ]);

        return res.status(200).json({
            ok: true,
            total,
            equipos
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const obtenerEquiposDestacados = async (req = request, res = response) => {
    try {
        const destacados = await Equipos.find({ estado: true })
            .sort({ puntuacion: -1, valoracion: -1, nombre: 1 })
            .limit(10)
            .populate('usuario');

        return res.status(200).json({
            ok: true,
            destacados
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const obtenerEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;

        const equipo = await Equipos.findById(id)
            .populate('usuario')
            .populate('jugadores.id');

        if (!equipo) {
            return res.status(404).json({
                ok: false,
                error: 'Equipo no encontrado'
            });
        }

        return res.status(200).json({
            ok: true,
            equipo,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const obtenerJugadoresPorEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;

        const equipo = await Equipos.findById(id).populate('jugadores.id');

        if (!equipo) {
            return res.status(404).json({
                ok: false,
                error: 'Equipo no encontrado'
            });
        }

        return res.status(200).json({
            ok: true,
            jugadores: equipo.jugadores
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const guardarEquipo = async (req = request, res = response) => {
    try {
        const { nombre, valoracion, usuario, img, jugadoresId } = req.body;
        const equipo = new Equipos({ nombre, valoracion, usuario, img, jugadoresId });

        await equipo.save();

        return res.status(201).json({
            ok: true,
            equipo
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const actualizarEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { usuario, ...resto } = req.body;

        const equipo = await Equipos.findByIdAndUpdate(id, resto, { new: true }).populate('usuario');

        return res.status(200).json({
            ok: true,
            equipo
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const eliminarEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;

        const equipo = await Equipos.findByIdAndUpdate(id, { estado: false });

        return res.status(200).json({
            ok: true,
            equipo
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

module.exports = {
    guardarEquipo,
    obtenerEquipos,
    obtenerEquiposDestacados,
    obtenerEquipo,
    obtenerJugadoresPorEquipo,
    actualizarEquipo,
    eliminarEquipo
}
