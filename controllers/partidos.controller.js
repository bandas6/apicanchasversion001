const { request, response } = require("express");
const Partidos = require("../models/partidos");
const Equipos = require("../models/equipos");
const Usuarios = require("../models/usuarios");


const guardarPartido = async (req = request, res = response) => {

    try {

        const { jugado, resultado, equipos, usuarios } = req.body;
        const partido = new Partidos({ jugado, resultado, equipos, usuarios });

        //guardar en DB
        await partido.save();

        res.status(200).json({
            ok: true,
            partido
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }

}

obtenerPartidos = async (req = request, res = response) => {

    query = {}
    const { desde, limit } = req.params

    try {

        const [total, partidos] = await Promise.all([
            Partidos.countDocuments(query),
            Partidos.find(query)
                .populate('equipos.equipoUno equipos.equipoDos usuarios.usuarioUno usuarios.usuarioDos')
                .skip(Number(desde))
                .limit(Number(limit))
        ])

        res.status(200).json({
            ok: true,
            total,
            partidos
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }
}


module.exports = {
    guardarPartido,
    obtenerPartidos
}