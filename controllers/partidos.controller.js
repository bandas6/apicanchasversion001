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

const obtenerPartidos = async (req = request, res = response) => {

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


const obtenerPartido = async (req = request, res = response) => {
    const { id } = req.params; // Este es el ID del usuario
    const { tipo } = req.query;

    try {
        // Declarar la variable partidos antes de usarla
        let partidos;

        // Función auxiliar para obtener partidos basados en el tipo de consulta
        const obtenerPartidosPorTipo = async (tipo, usuarioId) => {
            if (tipo === 'misPartidos') {
                // Usar exec() para obtener una promesa que se pueda esperar
                return Partidos.find({ "usuarios.usuarioUno": usuarioId }).exec();
            }
            return [];
        };

        // Obtener partidos basados en el tipo de consulta y esperar la respuesta
        partidos = await obtenerPartidosPorTipo(tipo, id);

        // Obtener el partido por ID y poblar las referencias
        const partido = await Partidos.findById(id)
            .populate('equipos.equipoUno equipos.equipoDos usuarios.usuarioUno usuarios.usuarioDos')
            .exec();

        // Combinamos la información obtenida
        res.status(200).json({
            ok: true,
            total: partido ? 1 : 0,
            partido,
            partidos
        });

    } catch (error) {
        console.error('Error al obtener el partido:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


module.exports = {
    guardarPartido,
    obtenerPartidos,
    obtenerPartido
}