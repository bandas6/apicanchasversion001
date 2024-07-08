const { request, response } = require("express");
const Complejos = require("../models/complejos");
const Solicitudes = require("../models/solicitudes");


const guardarSolicitud = async (req = request, res = response) => {
    try {
        const data = req.body;
        const solicitud = new Solicitudes(data); // Aquí se debe usar Complejo en lugar de Complejos

        // Guardar en la base de datos
        await solicitud.save(); // Aquí se debe usar complejo en lugar de partido

        res.status(200).json({
            ok: true,
            solicitud
        });

    } catch (error) {
        res.status(400).json({
            ok: false,
            error
        });
    }
};


const actualizarSolicitud = async (req = request, res = response) => {
    
    const { id } = req.params;

    try {
        const data = req.body;

        const solicitud = await Solicitudes.findByIdAndUpdate(id, data, { new: true })
        .populate('usuario'); // Aquí se debe usar Complejo en lugar de Complejos

        res.status(200).json({
            ok: true,
            solicitud
        });

    } catch (error) {
        res.status(400).json({
            ok: false,
            error
        });
    }
};

const actualizarSolicitudConReservaId = async (req = request, res = response) => {
    
    const { reservaId } = req.params;
    const { estado } = req.body;

    try {

        const solicitud = await Solicitudes.findOne({reservaId})
        .populate('usuario'); // Aquí se debe usar Complejo en lugar de Complejos

        if(!solicitud){
            res.status(400).json({
                ok: false,
                msg: 'La solicitud no existe'
            })
            return;
        }

        solicitud.estado = estado;

        await solicitud.save()

        res.status(200).json({
            ok: true,
            solicitud
        });

    } catch (error) {
        res.status(400).json({
            ok: false,
            error
        });
    }
};


const obtenerSolicitudes = async (req = request, res = response) => {

    const usuarioId = req.usuarioAuth._id;

    query = { usuario: usuarioId }
    const { desde, limit } = req.params

    try {

        const [total, solicitudes] = await Promise.all([
            Solicitudes.countDocuments(query),
            Solicitudes.find(query)
                .populate('usuario')
                .populate('administrador')
                .populate('complejo')
                .populate('cancha')
                .skip(Number(desde))
                .limit(Number(limit))
        ])

        res.status(200).json({
            ok: true,
            total,
            solicitudes
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }
}


const obtenerSolicitud = async (req = request, res = response) => {
    const { id } = req.params; // Este es el ID del usuario

    try {
        // Obtener el partido por ID y poblar las referencias
        const solicitud = await Solicitudes.findById(id)
            .populate('usuario')
            .exec();

        // Combinamos la información obtenida
        res.status(200).json({
            ok: true,
            total: complejo ? 1 : 0,
            solicitud
        });

    } catch (error) {
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


module.exports = {
    guardarSolicitud,
    obtenerSolicitudes,
    obtenerSolicitud,
    actualizarSolicitud,
    actualizarSolicitudConReservaId
}