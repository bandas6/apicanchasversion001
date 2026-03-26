const { request, response } = require("express");
const Complejos = require("../models/complejos");
const Canchas = require("../models/canchas");
require("../models/deportes");

const normalizarPayloadComplejo = (data = {}) => {
    const payload = { ...data };
    const latitudNumerica = Number(payload.latitud);
    const longitudNumerica = Number(payload.longitud);

    if (
        (!payload.ubicacionGeo || typeof payload.ubicacionGeo !== 'object') &&
        Number.isFinite(latitudNumerica) &&
        Number.isFinite(longitudNumerica)
    ) {
        payload.ubicacionGeo = {
            lat: latitudNumerica,
            lng: longitudNumerica,
        };
    }

    if (payload.administradores?.length) {
        payload.administradores = payload.administradores;
    } else if (payload.administrador) {
        payload.administradores = [payload.administrador];
    }

    if (payload.rating === '' || payload.rating === undefined) {
        delete payload.rating;
    } else if (payload.rating !== null) {
        payload.rating = Number(payload.rating);
    }

    if (payload.totalResenas === '' || payload.totalResenas === undefined) {
        delete payload.totalResenas;
    } else if (payload.totalResenas !== null) {
        payload.totalResenas = Number(payload.totalResenas);
    }

    if (
        payload.maxReservasPorUsuarioPorDia === '' ||
        payload.maxReservasPorUsuarioPorDia === undefined
    ) {
        delete payload.maxReservasPorUsuarioPorDia;
    } else if (payload.maxReservasPorUsuarioPorDia !== null) {
        payload.maxReservasPorUsuarioPorDia = Number(payload.maxReservasPorUsuarioPorDia);
    }

    return payload;
};

const guardarComplejo = async (req = request, res = response) => {
    try {
        const data = normalizarPayloadComplejo(req.body);
        const complejo = new Complejos(data);

        await complejo.save();

        return res.status(201).json({
            ok: true,
            complejo
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const actualizarComplejo = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const data = normalizarPayloadComplejo(req.body);
        const complejo = await Complejos.findByIdAndUpdate(id, data, { new: true })
            .populate('administrador')
            .populate('administradores')
            .populate('deportes')
            .populate('canchas');

        if (!complejo) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado'
            });
        }

        return res.status(200).json({
            ok: true,
            complejo
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerComplejos = async (req = request, res = response) => {
    const { desde = 0, limit = 20, administrador } = req.query;
    const query = { estado: true };

    if (administrador) {
        query.$or = [
            { administrador },
            { administradores: administrador },
        ];
    }

    try {
        const [total, complejos] = await Promise.all([
            Complejos.countDocuments(query),
            Complejos.find(query)
                .populate('administrador')
                .populate('administradores')
                .populate('deportes')
                .populate('canchas')
                .skip(Number(desde))
                .limit(Number(limit))
        ]);

        return res.status(200).json({
            ok: true,
            total,
            complejos
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerComplejo = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const complejo = await Complejos.findById(id)
            .populate('administrador')
            .populate('administradores')
            .populate('deportes')
            .populate('canchas');

        if (!complejo) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado'
            });
        }

        return res.status(200).json({
            ok: true,
            total: 1,
            complejo
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerCanchasPorComplejo = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const canchas = await Canchas.find({
            complejo: id,
            eliminado: false,
        })
            .populate('complejo')
            .populate('deporte')
            .populate('deportes');

        return res.status(200).json({
            ok: true,
            total: canchas.length,
            canchas
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

module.exports = {
    guardarComplejo,
    obtenerComplejos,
    obtenerComplejo,
    obtenerCanchasPorComplejo,
    actualizarComplejo
}
