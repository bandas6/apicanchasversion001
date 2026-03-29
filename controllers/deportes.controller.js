const { request, response } = require('express');
const Deporte = require('../models/deportes');
const { auditAdminGeneralAction } = require('../helpers/audit-admin-general');

const slugify = (value = '') => String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const obtenerDeportes = async (req = request, res = response) => {
    const { desde = 0, limit = 100, activos } = req.query;
    const query = {};

    if (activos !== 'false') {
        query.activo = true;
    }

    try {
        const [total, deportes] = await Promise.all([
            Deporte.countDocuments(query),
            Deporte.find(query)
                .sort({ nombre: 1 })
                .skip(Number(desde))
                .limit(Number(limit)),
        ]);

        return res.status(200).json({
            ok: true,
            total,
            deportes,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const crearDeporte = async (req = request, res = response) => {
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();

    if (!nombre) {
        return res.status(400).json({
            ok: false,
            error: 'El nombre del deporte es obligatorio',
        });
    }

    try {
        const slug = slugify(nombre);
        const existente = await Deporte.findOne({
            $or: [
                { nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                { slug },
            ],
        });

        if (existente) {
            return res.status(409).json({
                ok: false,
                error: 'Ese deporte ya existe en el catalogo',
            });
        }

        const deporte = new Deporte({
            nombre,
            slug,
            descripcion,
            activo: true,
        });

        await deporte.save();

        await auditAdminGeneralAction({
            req,
            action: 'CREATE_DEPORTE',
            resourceType: 'deporte',
            resourceId: deporte._id,
            summary: `Deporte creado: ${deporte.nombre}`.trim(),
        });

        return res.status(201).json({
            ok: true,
            deporte,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const actualizarDeporte = async (req = request, res = response) => {
    const { id } = req.params;
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();
    const payload = {};

    if (nombre) {
        payload.nombre = nombre;
        payload.slug = slugify(nombre);
    }

    if (req.body?.descripcion !== undefined) {
        payload.descripcion = descripcion;
    }

    if (req.body?.activo !== undefined) {
        payload.activo = Boolean(req.body.activo);
    }

    try {
        if (payload.slug) {
            const duplicated = await Deporte.findOne({
                _id: { $ne: id },
                $or: [
                    { nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                    { slug: payload.slug },
                ],
            });

            if (duplicated) {
                return res.status(409).json({
                    ok: false,
                    error: 'Ese deporte ya existe en el catalogo',
                });
            }
        }

        const deporte = await Deporte.findByIdAndUpdate(
            id,
            payload,
            { new: true, runValidators: true },
        );

        if (!deporte) {
            return res.status(404).json({
                ok: false,
                error: 'Deporte no encontrado',
            });
        }

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_DEPORTE',
            resourceType: 'deporte',
            resourceId: deporte._id,
            summary: `Deporte actualizado: ${deporte.nombre}`.trim(),
            metadata: {
                camposActualizados: Object.keys(payload),
            },
        });

        return res.status(200).json({
            ok: true,
            deporte,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    obtenerDeportes,
    crearDeporte,
    actualizarDeporte,
};
