const { request, response } = require("express");
const Solicitudes = require("../models/solicitudes");

const guardarSolicitud = async (req = request, res = response) => {
    try {
        const data = req.body;
        const solicitud = new Solicitudes(data);

        await solicitud.save();

        return res.status(201).json({
            ok: true,
            solicitud
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const actualizarSolicitud = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const data = req.body;
        const solicitud = await Solicitudes.findByIdAndUpdate(id, data, { new: true })
            .populate('usuario');

        if (!solicitud) {
            return res.status(404).json({
                ok: false,
                msg: 'La solicitud no existe'
            });
        }

        return res.status(200).json({
            ok: true,
            solicitud
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const actualizarSolicitudConReservaId = async (req = request, res = response) => {
    const { reservaId } = req.params;
    const { estado } = req.body;

    try {
        const solicitud = await Solicitudes.findOne({ reservaId })
            .populate('usuario');

        if (!solicitud) {
            return res.status(404).json({
                ok: false,
                msg: 'La solicitud no existe'
            });
        }

        solicitud.estado = estado;
        await solicitud.save();

        return res.status(200).json({
            ok: true,
            solicitud
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerSolicitudes = async (req = request, res = response) => {
    const usuarioId = req.usuarioAuth._id;
    const query = { usuario: usuarioId };
    const { desde = 0, limit = 20 } = req.query;

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
        ]);

        return res.status(200).json({
            ok: true,
            total,
            solicitudes
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerSolicitudesComplejo = async (req = request, res = response) => {
    const { idComplejo } = req.params;
    const query = { complejo: idComplejo };
    const { desde = 0, limit = 20 } = req.query;

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
        ]);

        return res.status(200).json({
            ok: true,
            total,
            solicitudes
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerSolicitud = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const solicitud = await Solicitudes.findById(id)
            .populate('usuario')
            .exec();

        if (!solicitud) {
            return res.status(404).json({
                ok: false,
                error: 'Solicitud no encontrada'
            });
        }

        return res.status(200).json({
            ok: true,
            total: 1,
            solicitud
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message || 'Error interno del servidor'
        });
    }
};

module.exports = {
    guardarSolicitud,
    obtenerSolicitudes,
    obtenerSolicitud,
    obtenerSolicitudesComplejo,
    actualizarSolicitud,
    actualizarSolicitudConReservaId
};
