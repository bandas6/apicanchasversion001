const { request, response } = require("express");
const Equipos = require("../models/equipos");
const Usuarios = require("../models/usuarios");


const obtenerEquipos = async (req = request, res = response) => {

    try {

        const { limit = 0, desde = 0 } = req.query;
        query = { estado: true }

        const [total, equipos] = await Promise.all([
            Equipos.countDocuments(query),
            Equipos.find(query)
                .populate('usuario')
                .skip(Number(desde))
                .limit(Number(limit))
        ])

        res.status(200).json({
            ok: true,
            total,
            equipos
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }

}

const obtenerEquipo = async (req = request, res = response) => {

    try {

        const { id } = req.params;

        const equipo = await Equipos.findById(id).populate('usuario').populate('usuario jugadores.id')

        res.status(200).json({
            ok: true,
            equipo,
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }


}

const guardarEquipo = async (req = request, res = response) => {

    try {

        const { nombre, valoracion, usuario, img, jugadoresId } = req.body;
        const equipo = new Equipos({ nombre, valoracion, usuario, img, jugadoresId });

        await equipo.save();

        res.status(200).json({
            ok: true,
            equipo
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }

}

const actualizarEquipo = async (req = request, res = response) => {

    try {

        const { id } = req.params;

        const { usuario, ...resto } = req.body;

        console.log(resto)

        const equipo = await Equipos.findByIdAndUpdate(id, resto, { new: true }).populate('usuario');

        res.status(200).json({
            ok: true,
            equipo
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }

}

const eliminarEquipo = async (req = request, res = response) => {

    try {

        const { id } = req.params;

        const equipo = await Equipos.findByIdAndUpdate(id, { estado: false });

        res.status(200).json({
            ok: true,
            equipo
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }

}

module.exports = {
    guardarEquipo,
    obtenerEquipos,
    obtenerEquipo,
    actualizarEquipo,
    eliminarEquipo
}