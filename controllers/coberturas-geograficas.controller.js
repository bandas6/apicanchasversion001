const { request, response } = require('express');
const CoberturaGeografica = require('../models/coberturas-geograficas');
const {
    buildCoverageSlug,
    normalizeBounds,
} = require('../helpers/coberturas-geograficas');

const normalizeText = (value = '') => String(value || '').trim();

const normalizePayload = (body = {}) => {
    const pais = normalizeText(body.pais);
    const ciudad = normalizeText(body.ciudad);

    if (!pais) {
        throw new Error('Debes seleccionar un pais');
    }

    if (!ciudad) {
        throw new Error('Debes seleccionar una ciudad');
    }

    return {
        pais,
        ciudad,
        slug: buildCoverageSlug({ pais, ciudad }),
        bounds: normalizeBounds(body.bounds || {}),
        activo: body.activo !== false,
    };
};

const listarCoberturasActivas = async (req = request, res = response) => {
    try {
        const coberturas = await CoberturaGeografica.find({ activo: true })
            .sort({ pais: 1, ciudad: 1 });

        return res.status(200).json({
            ok: true,
            coberturas,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const listarCoberturasAdmin = async (req = request, res = response) => {
    try {
        const coberturas = await CoberturaGeografica.find()
            .sort({ pais: 1, ciudad: 1 });

        return res.status(200).json({
            ok: true,
            coberturas,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const crearCobertura = async (req = request, res = response) => {
    try {
        const payload = normalizePayload(req.body);
        const existente = await CoberturaGeografica.findOne({ slug: payload.slug });

        if (existente) {
            return res.status(400).json({
                ok: false,
                error: 'Esa ciudad ya existe en la cobertura geografica',
            });
        }

        const cobertura = new CoberturaGeografica(payload);
        await cobertura.save();

        return res.status(201).json({
            ok: true,
            cobertura,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const actualizarCobertura = async (req = request, res = response) => {
    try {
        const payload = normalizePayload(req.body);
        const { id } = req.params;
        const existente = await CoberturaGeografica.findById(id);

        if (!existente) {
            return res.status(404).json({
                ok: false,
                error: 'Cobertura no encontrada',
            });
        }

        const duplicada = await CoberturaGeografica.findOne({
            slug: payload.slug,
            _id: { $ne: id },
        });

        if (duplicada) {
            return res.status(400).json({
                ok: false,
                error: 'Ya existe otra cobertura para esa ciudad',
            });
        }

        const cobertura = await CoberturaGeografica.findByIdAndUpdate(
            id,
            payload,
            { new: true },
        );

        return res.status(200).json({
            ok: true,
            cobertura,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const eliminarCobertura = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const cobertura = await CoberturaGeografica.findByIdAndDelete(id);

        if (!cobertura) {
            return res.status(404).json({
                ok: false,
                error: 'Cobertura no encontrada',
            });
        }

        return res.status(200).json({
            ok: true,
            cobertura,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    listarCoberturasActivas,
    listarCoberturasAdmin,
    crearCobertura,
    actualizarCobertura,
    eliminarCobertura,
};
