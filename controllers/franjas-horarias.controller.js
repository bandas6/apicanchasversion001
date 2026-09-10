const { request, response } = require('express');
const FranjaHoraria = require('../models/franjas-horarias');
const { auditAdminGeneralAction } = require('../helpers/audit-admin-general');

/// Catalogo de franjas horarias (punto 3.2 del checklist 2026-09-02).
///
/// Mismo patron que `deportes.controller.js`: lectura abierta —el panel de
/// cualquier admin necesita el catalogo para ofrecerlo como selector— y
/// mutaciones restringidas a DEV en la capa de rutas (`esAdminGeneralRol`).
/// Ese gate es justamente lo que pedia Arnold y lo que no existia: hasta ahora
/// un admin de complejo podia renombrar franjas a mano desde la grilla de
/// tarifas de cada cancha.

const slugify = (value = '') => String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const obtenerFranjasHorarias = async (req = request, res = response) => {
    const { activos } = req.query;
    const query = {};

    // Por defecto solo las activas: el selector del admin no debe ofrecer una
    // franja que DEV dio de baja. El panel de DEV pide `activos=false` para
    // ver y poder reactivar las inactivas.
    if (activos !== 'false') {
        query.activo = true;
    }

    try {
        const franjas = await FranjaHoraria.find(query).sort({ orden: 1, nombre: 1 });

        return res.status(200).json({
            ok: true,
            total: franjas.length,
            franjas,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const crearFranjaHoraria = async (req = request, res = response) => {
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();
    const orden = Number(req.body?.orden);

    if (!nombre) {
        return res.status(400).json({
            ok: false,
            error: 'El nombre de la franja es obligatorio',
        });
    }

    try {
        const slug = slugify(nombre);
        const existente = await FranjaHoraria.findOne({
            $or: [
                { nombre: new RegExp(`^${escapeRegex(nombre)}$`, 'i') },
                { slug },
            ],
        });

        if (existente) {
            return res.status(409).json({
                ok: false,
                error: 'Esa franja ya existe en el catalogo',
            });
        }

        const franja = new FranjaHoraria({
            nombre,
            slug,
            descripcion,
            orden: Number.isFinite(orden) ? orden : 0,
            activo: true,
        });

        await franja.save();

        await auditAdminGeneralAction({
            req,
            action: 'CREATE_FRANJA_HORARIA',
            resourceType: 'franja-horaria',
            resourceId: franja._id,
            summary: `Franja creada: ${franja.nombre}`.trim(),
        });

        return res.status(201).json({ ok: true, franja });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const actualizarFranjaHoraria = async (req = request, res = response) => {
    const { id } = req.params;
    const nombre = String(req.body?.nombre || '').trim();
    const payload = {};

    if (nombre) {
        payload.nombre = nombre;
        payload.slug = slugify(nombre);
    }

    if (req.body?.descripcion !== undefined) {
        payload.descripcion = String(req.body.descripcion || '').trim();
    }

    if (req.body?.orden !== undefined) {
        const orden = Number(req.body.orden);
        if (!Number.isFinite(orden)) {
            return res.status(400).json({
                ok: false,
                error: 'El orden debe ser un numero',
            });
        }
        payload.orden = orden;
    }

    if (req.body?.activo !== undefined) {
        payload.activo = Boolean(req.body.activo);
    }

    try {
        if (payload.slug) {
            const duplicada = await FranjaHoraria.findOne({
                _id: { $ne: id },
                $or: [
                    { nombre: new RegExp(`^${escapeRegex(nombre)}$`, 'i') },
                    { slug: payload.slug },
                ],
            });

            if (duplicada) {
                return res.status(409).json({
                    ok: false,
                    error: 'Esa franja ya existe en el catalogo',
                });
            }
        }

        const franja = await FranjaHoraria.findByIdAndUpdate(
            id,
            payload,
            { new: true, runValidators: true },
        );

        if (!franja) {
            return res.status(404).json({
                ok: false,
                error: 'Franja no encontrada',
            });
        }

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_FRANJA_HORARIA',
            resourceType: 'franja-horaria',
            resourceId: franja._id,
            summary: `Franja actualizada: ${franja.nombre}`.trim(),
            metadata: { camposActualizados: Object.keys(payload) },
        });

        return res.status(200).json({ ok: true, franja });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    obtenerFranjasHorarias,
    crearFranjaHoraria,
    actualizarFranjaHoraria,
};
