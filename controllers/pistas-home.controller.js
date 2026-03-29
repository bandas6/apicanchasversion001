const { request, response } = require('express');
const Complejo = require('../models/complejos');
const PistaHome = require('../models/pistas-home');

const normalizePayload = (body = {}) => ({
    texto: String(body.texto || '').trim(),
    iconoKey: String(body.iconoKey || 'explore').trim() || 'explore',
    ctaLabel: String(body.ctaLabel || '').trim(),
    ctaTarget: String(body.ctaTarget || 'NONE').trim().toUpperCase(),
    scope: String(body.scope || 'GLOBAL').trim().toUpperCase(),
    complejo: body.complejo || null,
    complejoNombre: String(body.complejoNombre || '').trim(),
    activo: body.activo !== false,
    orden: Number(body.orden || 0),
    fechaInicio: body.fechaInicio || null,
    fechaFin: body.fechaFin || null,
    observacionesRevision: String(body.observacionesRevision || '').trim(),
});

const isGeneralAdmin = (usuarioAuth) => usuarioAuth?.rol === 'ADMIN_GENERAL_ROL';

const managedComplejosByUser = async (usuarioId) => {
    const complejos = await Complejo.find({
        $or: [
            { administrador: usuarioId },
            { administradores: usuarioId },
        ],
    }).select('_id');

    return complejos.map((item) => String(item._id));
};

const puedeGestionarComplejo = async (usuarioAuth, complejoId) => {
    if (!complejoId) {
        return false;
    }

    if (isGeneralAdmin(usuarioAuth)) {
        return true;
    }

    const managed = await managedComplejosByUser(usuarioAuth._id);
    return managed.includes(String(complejoId));
};

const obtenerNombreComplejo = async (complejoId) => {
    if (!complejoId) {
        return '';
    }

    const complejo = await Complejo.findById(complejoId).select('nombre');
    return complejo?.nombre ? String(complejo.nombre).trim() : '';
};

const normalizeDate = (rawValue, endOfDay = false) => {
    if (!rawValue) {
        return null;
    }

    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (endOfDay) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }

    return date;
};

const validarPayloadPista = (data = {}) => {
    if (!data.texto) {
        return 'El texto de la pista es obligatorio';
    }

    if (data.texto.length > 180) {
        return 'El texto de la pista no puede superar 180 caracteres';
    }

    if (!['GLOBAL', 'COMPLEJO'].includes(data.scope)) {
        return 'El scope de la pista no es valido';
    }

    if (!['NONE', 'COMPLEJOS', 'RESERVAS', 'COMPLEJO'].includes(data.ctaTarget)) {
        return 'El CTA configurado no es valido';
    }

    if (data.ctaTarget !== 'NONE' && !data.ctaLabel) {
        return 'Debes enviar una etiqueta para el CTA';
    }

    if (data.ctaLabel.length > 40) {
        return 'La etiqueta del CTA no puede superar 40 caracteres';
    }

    if (data.ctaTarget === 'NONE') {
        data.ctaLabel = '';
    }

    if (data.ctaTarget === 'COMPLEJO' && !data.complejo) {
        return 'Las pistas con CTA al detalle deben tener un complejo asociado';
    }

    if (!Number.isFinite(data.orden) || data.orden < 0) {
        return 'El orden de la pista debe ser un numero valido mayor o igual a 0';
    }

    data.fechaInicio = normalizeDate(data.fechaInicio);
    data.fechaFin = normalizeDate(data.fechaFin, true);

    const ahora = new Date();
    ahora.setHours(0, 0, 0, 0);

    if (data.fechaFin && data.fechaFin < ahora) {
        return 'La fecha de fin no puede quedar completamente en el pasado';
    }

    if (data.fechaInicio && data.fechaFin && data.fechaInicio > data.fechaFin) {
        return 'La fecha de inicio no puede ser mayor a la fecha de fin';
    }

    return null;
};

const obtenerPistasPublicas = async (req = request, res = response) => {
    try {
        const ahora = new Date();
        const pistas = await PistaHome.find({
            activo: true,
            $or: [
                { scope: 'GLOBAL' },
                {
                    scope: 'COMPLEJO',
                    aprobada: true,
                    estadoRevision: 'aprobada',
                },
            ],
            $and: [
                {
                    $or: [
                        { fechaInicio: null },
                        { fechaInicio: { $lte: ahora } },
                    ],
                },
                {
                    $or: [
                        { fechaFin: null },
                        { fechaFin: { $gte: ahora } },
                    ],
                },
            ],
        })
            .populate('complejo', 'nombre')
            .sort({ orden: 1, updatedAt: -1 });

        return res.status(200).json({
            ok: true,
            total: pistas.length,
            pistas,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerPistasAdmin = async (req = request, res = response) => {
    try {
        const { scope, estadoRevision, complejo } = req.query;
        const query = {};

        if (isGeneralAdmin(req.usuarioAuth)) {
            if (scope) {
                query.scope = String(scope).trim().toUpperCase();
            }
            if (estadoRevision) {
                query.estadoRevision = String(estadoRevision).trim().toLowerCase();
            }
            if (complejo) {
                query.complejo = complejo;
            }
        } else {
            const complejos = await managedComplejosByUser(req.usuarioAuth._id);
            query.scope = 'COMPLEJO';
            query.complejo = { $in: complejos };
        }

        const pistas = await PistaHome.find(query)
            .populate('complejo', 'nombre')
            .populate('creadaPor', 'nombre apellido correo rol')
            .populate('aprobadaPor', 'nombre apellido correo rol')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            ok: true,
            total: pistas.length,
            pistas,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const crearPistaHome = async (req = request, res = response) => {
    try {
        const data = normalizePayload(req.body);
        const validationError = validarPayloadPista(data);
        if (validationError) {
            return res.status(400).json({
                ok: false,
                error: validationError,
            });
        }

        if (data.scope === 'GLOBAL' && !isGeneralAdmin(req.usuarioAuth)) {
            return res.status(403).json({
                ok: false,
                error: 'Solo el desarrollador puede crear pistas globales',
            });
        }

        if (data.scope === 'COMPLEJO') {
            if (!data.complejo) {
                return res.status(400).json({
                    ok: false,
                    error: 'Debes asociar la pista a un complejo',
                });
            }

            const canManage = await puedeGestionarComplejo(req.usuarioAuth, data.complejo);
            if (!canManage) {
                return res.status(403).json({
                    ok: false,
                    error: 'No puedes crear pistas para un complejo que no administras',
                });
            }

            data.complejoNombre = await obtenerNombreComplejo(data.complejo);
        } else {
            data.complejo = null;
            data.complejoNombre = '';
        }

        const developerOwned = isGeneralAdmin(req.usuarioAuth);
        if (data.scope === 'COMPLEJO') {
            data.ctaTarget = 'COMPLEJO';
            if (!data.ctaLabel) {
                data.ctaLabel = 'Reservar ahora';
            }
        }

        const pista = new PistaHome({
            ...data,
            creadaPor: req.usuarioAuth._id,
            aprobada: developerOwned,
            estadoRevision: developerOwned ? 'aprobada' : 'pendiente',
            aprobadaPor: developerOwned ? req.usuarioAuth._id : null,
            aprobadaAt: developerOwned ? new Date() : null,
        });

        await pista.save();
        await pista.populate('complejo', 'nombre');

        return res.status(201).json({
            ok: true,
            pista,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const actualizarPistaHome = async (req = request, res = response) => {
    try {
        const pista = await PistaHome.findById(req.params.id);

        if (!pista) {
            return res.status(404).json({
                ok: false,
                error: 'Pista no encontrada',
            });
        }

        const data = normalizePayload(req.body);
        const developerOwned = isGeneralAdmin(req.usuarioAuth);
        const validationError = validarPayloadPista({
            ...data,
            scope: pista.scope,
        });

        if (validationError) {
            return res.status(400).json({
                ok: false,
                error: validationError,
            });
        }

        if (developerOwned) {
            pista.texto = data.texto;
            pista.iconoKey = data.iconoKey;
            pista.ctaLabel = data.ctaLabel;
            pista.ctaTarget = data.ctaTarget;
            pista.orden = data.orden;
            pista.activo = data.activo;
            pista.fechaInicio = data.fechaInicio;
            pista.fechaFin = data.fechaFin;
            if (pista.scope === 'GLOBAL') {
                pista.complejoNombre = '';
                pista.aprobada = true;
                pista.estadoRevision = 'aprobada';
                pista.aprobadaPor = req.usuarioAuth._id;
                pista.aprobadaAt = new Date();
            }
        } else {
            if (pista.scope !== 'COMPLEJO') {
                return res.status(403).json({
                    ok: false,
                    error: 'Solo el desarrollador puede editar pistas globales',
                });
            }

            const canManage = await puedeGestionarComplejo(req.usuarioAuth, pista.complejo);
            if (!canManage) {
                return res.status(403).json({
                    ok: false,
                    error: 'No puedes editar pistas de un complejo que no administras',
                });
            }

            pista.texto = data.texto;
            pista.iconoKey = data.iconoKey;
            pista.ctaLabel = data.ctaLabel;
            pista.ctaTarget = data.ctaTarget === 'NONE' ? 'COMPLEJO' : data.ctaTarget;
            pista.orden = data.orden;
            pista.activo = data.activo;
            pista.fechaInicio = data.fechaInicio;
            pista.fechaFin = data.fechaFin;
            pista.complejoNombre = await obtenerNombreComplejo(pista.complejo);
            pista.aprobada = false;
            pista.estadoRevision = 'pendiente';
            pista.aprobadaPor = null;
            pista.aprobadaAt = null;
            pista.observacionesRevision = '';
        }

        await pista.save();
        await pista.populate('complejo', 'nombre');
        await pista.populate('creadaPor', 'nombre apellido correo rol');
        await pista.populate('aprobadaPor', 'nombre apellido correo rol');

        return res.status(200).json({
            ok: true,
            pista,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const revisarPistaHome = async (req = request, res = response) => {
    try {
        const { accion, observacionesRevision, activo } = req.body;
        const pista = await PistaHome.findById(req.params.id);

        if (!pista) {
            return res.status(404).json({
                ok: false,
                error: 'Pista no encontrada',
            });
        }

        const reviewAction = String(accion || '').trim().toLowerCase();
        const reviewNote = String(observacionesRevision || '').trim();
        if (!['aprobar', 'rechazar'].includes(reviewAction)) {
            return res.status(400).json({
                ok: false,
                error: 'La accion de revision no es valida',
            });
        }

        if (reviewAction === 'rechazar' && !reviewNote) {
            return res.status(400).json({
                ok: false,
                error: 'Debes enviar una observacion al rechazar la pista',
            });
        }

        pista.aprobada = reviewAction === 'aprobar';
        pista.estadoRevision = reviewAction === 'aprobar' ? 'aprobada' : 'rechazada';
        pista.aprobadaPor = reviewAction === 'aprobar' ? req.usuarioAuth._id : null;
        pista.aprobadaAt = reviewAction === 'aprobar' ? new Date() : null;
        pista.observacionesRevision = reviewNote;

        if (typeof activo === 'boolean') {
            pista.activo = activo;
        } else if (reviewAction === 'rechazar') {
            pista.activo = false;
        }

        await pista.save();
        await pista.populate('complejo', 'nombre');
        await pista.populate('creadaPor', 'nombre apellido correo rol');
        await pista.populate('aprobadaPor', 'nombre apellido correo rol');

        return res.status(200).json({
            ok: true,
            pista,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    obtenerPistasPublicas,
    obtenerPistasAdmin,
    crearPistaHome,
    actualizarPistaHome,
    revisarPistaHome,
};
