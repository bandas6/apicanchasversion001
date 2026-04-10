const { request, response } = require('express');
const Complejo = require('../models/complejos');
const CentroMensaje = require('../models/centro-mensajes');
const { uploadBufferToCloudinary } = require('../helpers/cloudinary');

const AUDIENCIAS_VALIDAS = ['ALL', 'AUTHENTICATED', 'USER_ROL', 'ADMIN_ROL', 'ADMIN_GENERAL_ROL'];
const TIPOS_VALIDOS = ['TIP', 'BANNER', 'ALERTA', 'NOTIFICACION'];
const SCOPES_VALIDOS = ['GLOBAL', 'COMPLEJO'];
const CTA_VALIDOS = ['NONE', 'COMPLEJOS', 'RESERVAS', 'COMPLEJO', 'URL'];
const LAYOUTS_VALIDOS = ['SOLO_TEXTO', 'IMAGEN_TEXTO', 'SOLO_IMAGEN'];
const POSICIONES_VALIDAS = ['TOP', 'CENTER', 'BOTTOM'];
const MODOS_ENTREGA_VALIDOS = ['INMEDIATO', 'ROTACION'];

const isGeneralAdmin = (usuarioAuth) => usuarioAuth?.rol === 'ADMIN_GENERAL_ROL';

const normalizeText = (value, fallback = '') => String(value ?? fallback).trim();

const buildCloudinaryPublicId = (...parts) =>
    parts
        .flat()
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .join('-')
        .replace(/[^a-zA-Z0-9-_]/g, '-');

const uploadImageIfPresent = async ({ file, folder, publicId }) => {
    if (!file?.buffer) {
        return '';
    }

    const result = await uploadBufferToCloudinary({
        buffer: file.buffer,
        folder,
        publicId,
    });

    return result?.secure_url ? String(result.secure_url).trim() : '';
};

const normalizePayload = (body = {}) => ({
    tipo: normalizeText(body.tipo, 'TIP').toUpperCase(),
    titulo: normalizeText(body.titulo),
    texto: normalizeText(body.texto),
    imagenUrl: normalizeText(body.imagenUrl),
    iconoKey: normalizeText(body.iconoKey, 'explore') || 'explore',
    ctaLabel: normalizeText(body.ctaLabel),
    ctaTarget: normalizeText(body.ctaTarget ?? body.ctaTargetTipo, 'NONE').toUpperCase(),
    ctaTargetId: normalizeText(body.ctaTargetId),
    ctaUrl: normalizeText(body.ctaUrl),
    scope: normalizeText(body.scope ?? body.alcanceTipo, 'GLOBAL').toUpperCase(),
    audiencia: normalizeText(body.audiencia, 'ALL').toUpperCase(),
    layout: normalizeText(body.layout, 'SOLO_TEXTO').toUpperCase(),
    posicion: normalizeText(body.posicion, 'TOP').toUpperCase(),
    descartable: body.descartable !== false,
    bloqueante: body.bloqueante === true,
    duracionMs: Number(body.duracionMs ?? 5000),
    modoEntrega: normalizeText(body.modoEntrega, 'INMEDIATO').toUpperCase(),
    frecuenciaMinutos: Number(body.frecuenciaMinutos ?? 5),
    cooldownMinutos: Number(body.cooldownMinutos ?? 60),
    prioridad: Number(body.prioridad ?? body.orden ?? 50),
    maxImpresionesPorUsuario: Number(body.maxImpresionesPorUsuario ?? 0),
    maxImpresionesTotales: Number(body.maxImpresionesTotales ?? 0),
    complejo: body.complejo || null,
    complejoNombre: normalizeText(body.complejoNombre),
    activo: body.activo !== false,
    orden: Number(body.orden ?? 0),
    fechaInicio: body.fechaInicio || null,
    fechaFin: body.fechaFin || null,
    observacionesRevision: normalizeText(body.observacionesRevision),
});

const normalizeCrossFieldRules = (data = {}) => {
    if (data.scope !== 'COMPLEJO') {
        data.complejo = null;
        data.complejoNombre = '';
        if (data.ctaTarget === 'COMPLEJO') {
            data.ctaTarget = 'NONE';
            data.ctaLabel = '';
            data.ctaUrl = '';
            data.ctaTargetId = '';
        }
    }

    return data;
};

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

const resolveEstadoActivo = (data = {}) => {
    const now = new Date();
    if (data.fechaFin && data.fechaFin < now) {
        return 'FINALIZADO';
    }
    if (data.activo === false) {
        return 'PAUSADO';
    }
    if (data.fechaInicio && data.fechaInicio > now) {
        return 'PROGRAMADO';
    }
    return 'ACTIVO';
};

const validarPayloadMensaje = (data = {}, { isGeneralAdminUser = false } = {}) => {
    if (!TIPOS_VALIDOS.includes(data.tipo)) {
        return 'El tipo de mensaje no es valido';
    }

    if (!data.texto && !(data.tipo === 'BANNER' && data.imagenUrl)) {
        return 'Debes enviar texto o una imagen para el mensaje';
    }

    if (data.texto.length > 180) {
        return 'El texto del mensaje no puede superar 180 caracteres';
    }

    if (data.titulo.length > 80) {
        return 'El titulo no puede superar 80 caracteres';
    }

    if (!SCOPES_VALIDOS.includes(data.scope)) {
        return 'El alcance configurado no es valido';
    }

    if (!AUDIENCIAS_VALIDAS.includes(data.audiencia)) {
        return 'La audiencia configurada no es valida';
    }

    if (!CTA_VALIDOS.includes(data.ctaTarget)) {
        return 'El CTA configurado no es valido';
    }

    if (!LAYOUTS_VALIDOS.includes(data.layout)) {
        return 'El layout configurado no es valido';
    }

    if (!POSICIONES_VALIDAS.includes(data.posicion)) {
        return 'La posicion configurada no es valida';
    }

    if (!MODOS_ENTREGA_VALIDOS.includes(data.modoEntrega)) {
        return 'El modo de entrega no es valido';
    }

    if (data.ctaTarget !== 'NONE' && !data.ctaLabel) {
        return 'Debes enviar una etiqueta para el CTA';
    }

    if (data.ctaLabel.length > 40) {
        return 'La etiqueta del CTA no puede superar 40 caracteres';
    }

    if (data.ctaTarget === 'URL' && !data.ctaUrl) {
        return 'Debes configurar una URL para este CTA';
    }

    if (data.ctaTarget === 'COMPLEJO' && !data.complejo) {
        return 'Los mensajes dirigidos a un complejo deben tener un complejo asociado';
    }

    if (data.layout === 'SOLO_IMAGEN' && !data.imagenUrl) {
        return 'El layout solo imagen requiere una imagen';
    }

    if (!Number.isFinite(data.frecuenciaMinutos) || data.frecuenciaMinutos < 5) {
        return 'La frecuencia minima permitida es de 5 minutos';
    }

    if (!Number.isFinite(data.cooldownMinutos) || data.cooldownMinutos < 0) {
        return 'El cooldown debe ser un numero valido';
    }

    if (!Number.isFinite(data.prioridad) || data.prioridad < 0) {
        return 'La prioridad debe ser un numero valido mayor o igual a 0';
    }

    if (!Number.isFinite(data.orden) || data.orden < 0) {
        return 'El orden del mensaje debe ser un numero valido mayor o igual a 0';
    }

    if (!Number.isFinite(data.duracionMs) || data.duracionMs < 0) {
        return 'La duracion debe ser un numero valido mayor o igual a 0';
    }

    data.fechaInicio = normalizeDate(data.fechaInicio);
    data.fechaFin = normalizeDate(data.fechaFin, true);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (data.fechaFin && data.fechaFin < hoy) {
        return 'La fecha de fin no puede quedar completamente en el pasado';
    }

    if (data.fechaInicio && data.fechaFin && data.fechaInicio > data.fechaFin) {
        return 'La fecha de inicio no puede ser mayor a la fecha de fin';
    }

    if (['BANNER', 'ALERTA'].includes(data.tipo) && data.bloqueante && data.duracionMs > 0) {
        return 'Un mensaje bloqueante no puede autocerrarse';
    }

    if (!isGeneralAdminUser) {
        data.audiencia = 'ALL';
        data.prioridad = 50;
    }

    return null;
};

const basePopulateQuery = (query) => query
    .populate('complejo', 'nombre')
    .populate('creadaPor', 'nombre apellido correo rol')
    .populate('aprobadaPor', 'nombre apellido correo rol');

const obtenerMensajesPublicos = async (req = request, res = response) => {
    try {
        const ahora = new Date();
        const audienciaPermitida = ['ALL'];
        if (req.usuarioAuth?.rol) {
            audienciaPermitida.push('AUTHENTICATED', String(req.usuarioAuth.rol).trim().toUpperCase());
        }

        const mensajes = await basePopulateQuery(
            CentroMensaje.find({
                activo: true,
                audiencia: { $in: audienciaPermitida },
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
                    {
                        $or: [
                            { estado: { $in: ['ACTIVO', 'PROGRAMADO'] } },
                            {
                                estado: { $exists: false },
                                aprobada: true,
                                estadoRevision: 'aprobada',
                            },
                        ],
                    },
                ],
            }),
        )
            .sort({ prioridad: -1, orden: 1, updatedAt: -1 });

        return res.status(200).json({
            ok: true,
            total: mensajes.length,
            mensajes,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerMensajesAdmin = async (req = request, res = response) => {
    try {
        const { scope, estado, estadoRevision, complejo, audiencia, tipo } = req.query;
        const query = {};

        if (isGeneralAdmin(req.usuarioAuth)) {
            if (scope) {
                query.scope = normalizeText(scope).toUpperCase();
            }
            if (estado) {
                query.estado = normalizeText(estado).toUpperCase();
            }
            if (estadoRevision) {
                query.estadoRevision = normalizeText(estadoRevision).toLowerCase();
            }
            if (complejo) {
                query.complejo = complejo;
            }
            if (audiencia) {
                query.audiencia = normalizeText(audiencia).toUpperCase();
            }
            if (tipo) {
                query.tipo = normalizeText(tipo).toUpperCase();
            }
        } else {
            const complejos = await managedComplejosByUser(req.usuarioAuth._id);
            query.scope = 'COMPLEJO';
            query.complejo = { $in: complejos };
        }

        const mensajes = await basePopulateQuery(CentroMensaje.find(query))
            .sort({ createdAt: -1 });

        return res.status(200).json({
            ok: true,
            total: mensajes.length,
            mensajes,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerMensajesPendientes = async (req = request, res = response) => {
    try {
        const mensajes = await basePopulateQuery(CentroMensaje.find({
            scope: 'COMPLEJO',
            $or: [
                { estado: 'PENDIENTE_APROBACION' },
                { estadoRevision: 'pendiente' },
            ],
        }))
            .sort({ createdAt: -1 });

        return res.status(200).json({
            ok: true,
            total: mensajes.length,
            mensajes,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const crearMensajeCentro = async (req = request, res = response) => {
    try {
        const data = normalizeCrossFieldRules(normalizePayload(req.body));
        const validationError = validarPayloadMensaje(data, {
            isGeneralAdminUser: isGeneralAdmin(req.usuarioAuth),
        });
        if (validationError) {
            return res.status(400).json({ ok: false, error: validationError });
        }

        if (data.scope === 'GLOBAL' && !isGeneralAdmin(req.usuarioAuth)) {
            return res.status(403).json({
                ok: false,
                error: 'Solo el administrador general puede crear mensajes globales',
            });
        }

        if (data.scope === 'COMPLEJO') {
            if (!data.complejo) {
                return res.status(400).json({
                    ok: false,
                    error: 'Debes asociar el mensaje a un complejo',
                });
            }

            const canManage = await puedeGestionarComplejo(req.usuarioAuth, data.complejo);
            if (!canManage) {
                return res.status(403).json({
                    ok: false,
                    error: 'No puedes crear mensajes para un complejo que no administras',
                });
            }

            data.complejoNombre = await obtenerNombreComplejo(data.complejo);
        } else {
            data.complejo = null;
            data.complejoNombre = '';
        }

        if (!isGeneralAdmin(req.usuarioAuth) && !data.ctaLabel) {
            data.ctaLabel = 'Ver detalle';
        }

        const approvedByDefault = isGeneralAdmin(req.usuarioAuth);
        const estado = approvedByDefault
            ? resolveEstadoActivo(data)
            : 'PENDIENTE_APROBACION';

        const mensaje = new CentroMensaje({
            ...data,
            creadaPor: req.usuarioAuth._id,
            estado,
            aprobada: approvedByDefault,
            estadoRevision: approvedByDefault ? 'aprobada' : 'pendiente',
            aprobadaPor: approvedByDefault ? req.usuarioAuth._id : null,
            aprobadaAt: approvedByDefault ? new Date() : null,
        });

        await mensaje.save();
        await mensaje.populate('complejo', 'nombre');
        await mensaje.populate('creadaPor', 'nombre apellido correo rol');
        await mensaje.populate('aprobadaPor', 'nombre apellido correo rol');

        return res.status(201).json({
            ok: true,
            mensaje,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const actualizarMensajeCentro = async (req = request, res = response) => {
    try {
        const mensaje = await CentroMensaje.findById(req.params.id);

        if (!mensaje) {
            return res.status(404).json({
                ok: false,
                error: 'Mensaje no encontrado',
            });
        }

        const data = normalizeCrossFieldRules(normalizePayload(req.body));
        const developerOwned = isGeneralAdmin(req.usuarioAuth);
        const validationError = validarPayloadMensaje(data, {
            isGeneralAdminUser: developerOwned,
        });
        if (validationError) {
            return res.status(400).json({ ok: false, error: validationError });
        }

        if (!developerOwned) {
            if (mensaje.scope !== 'COMPLEJO') {
                return res.status(403).json({
                    ok: false,
                    error: 'Solo el administrador general puede editar mensajes globales',
                });
            }

            const canManage = await puedeGestionarComplejo(req.usuarioAuth, mensaje.complejo);
            if (!canManage) {
                return res.status(403).json({
                    ok: false,
                    error: 'No puedes editar mensajes de un complejo que no administras',
                });
            }
        }

        if (mensaje.scope === 'COMPLEJO') {
            data.complejo = mensaje.complejo;
            data.complejoNombre = await obtenerNombreComplejo(mensaje.complejo);
        } else {
            data.complejo = null;
            data.complejoNombre = '';
            if (data.ctaTarget === 'COMPLEJO') {
                data.ctaTarget = 'NONE';
                data.ctaLabel = '';
                data.ctaUrl = '';
                data.ctaTargetId = '';
            }
        }

        mensaje.tipo = data.tipo;
        mensaje.titulo = data.titulo;
        mensaje.texto = data.texto;
        mensaje.imagenUrl = data.imagenUrl;
        mensaje.iconoKey = data.iconoKey;
        mensaje.ctaLabel = data.ctaLabel;
        mensaje.ctaTarget = data.ctaTarget;
        mensaje.ctaTargetId = data.ctaTargetId;
        mensaje.ctaUrl = data.ctaUrl;
        mensaje.audiencia = data.audiencia;
        mensaje.layout = data.layout;
        mensaje.posicion = data.posicion;
        mensaje.descartable = data.descartable;
        mensaje.bloqueante = data.bloqueante;
        mensaje.duracionMs = data.duracionMs;
        mensaje.modoEntrega = data.modoEntrega;
        mensaje.frecuenciaMinutos = data.frecuenciaMinutos;
        mensaje.cooldownMinutos = data.cooldownMinutos;
        mensaje.maxImpresionesPorUsuario = data.maxImpresionesPorUsuario;
        mensaje.maxImpresionesTotales = data.maxImpresionesTotales;
        mensaje.orden = data.orden;
        mensaje.activo = data.activo;
        mensaje.fechaInicio = data.fechaInicio;
        mensaje.fechaFin = data.fechaFin;
        mensaje.complejoNombre = data.complejoNombre;

        if (developerOwned) {
            mensaje.prioridad = data.prioridad;
            mensaje.estado = resolveEstadoActivo(data);
            mensaje.aprobada = true;
            mensaje.estadoRevision = 'aprobada';
            mensaje.aprobadaPor = req.usuarioAuth._id;
            mensaje.aprobadaAt = new Date();
        } else {
            mensaje.prioridad = 50;
            mensaje.estado = 'PENDIENTE_APROBACION';
            mensaje.aprobada = false;
            mensaje.estadoRevision = 'pendiente';
            mensaje.aprobadaPor = null;
            mensaje.aprobadaAt = null;
            mensaje.observacionesRevision = '';
        }

        await mensaje.save();
        await mensaje.populate('complejo', 'nombre');
        await mensaje.populate('creadaPor', 'nombre apellido correo rol');
        await mensaje.populate('aprobadaPor', 'nombre apellido correo rol');

        return res.status(200).json({
            ok: true,
            mensaje,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const revisarMensajeCentro = async (req = request, res = response) => {
    try {
        const { accion, observacionesRevision, activo, prioridad } = req.body;
        const mensaje = await CentroMensaje.findById(req.params.id);

        if (!mensaje) {
            return res.status(404).json({
                ok: false,
                error: 'Mensaje no encontrado',
            });
        }

        const reviewAction = normalizeText(accion).toLowerCase();
        const reviewNote = normalizeText(observacionesRevision);
        if (!['aprobar', 'rechazar'].includes(reviewAction)) {
            return res.status(400).json({
                ok: false,
                error: 'La accion de revision no es valida',
            });
        }

        if (reviewAction === 'rechazar' && !reviewNote) {
            return res.status(400).json({
                ok: false,
                error: 'Debes enviar una observacion al rechazar el mensaje',
            });
        }

        if (reviewAction === 'aprobar') {
            if (typeof activo === 'boolean') {
                mensaje.activo = activo;
            }
            if (Number.isFinite(Number(prioridad))) {
                mensaje.prioridad = Number(prioridad);
            }
            mensaje.aprobada = true;
            mensaje.estadoRevision = 'aprobada';
            mensaje.estado = resolveEstadoActivo(mensaje);
            mensaje.aprobadaPor = req.usuarioAuth._id;
            mensaje.aprobadaAt = new Date();
        } else {
            mensaje.aprobada = false;
            mensaje.estadoRevision = 'rechazada';
            mensaje.estado = 'RECHAZADO';
            mensaje.activo = false;
            mensaje.aprobadaPor = null;
            mensaje.aprobadaAt = null;
        }

        mensaje.observacionesRevision = reviewNote;

        await mensaje.save();
        await mensaje.populate('complejo', 'nombre');
        await mensaje.populate('creadaPor', 'nombre apellido correo rol');
        await mensaje.populate('aprobadaPor', 'nombre apellido correo rol');

        return res.status(200).json({
            ok: true,
            mensaje,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }
};

const subirImagenMensajeCentro = async (req = request, res = response) => {
    try {
        const imageFile = req.file;
        if (!imageFile?.buffer) {
            return res.status(400).json({
                ok: false,
                error: 'Debes adjuntar una imagen para el mensaje',
            });
        }

        const imageUrl = await uploadImageIfPresent({
            file: imageFile,
            folder: 'canchas/centro-mensajes',
            publicId: buildCloudinaryPublicId(
                'centro-mensajes',
                req.usuarioAuth?._id,
                Date.now(),
            ),
        });

        return res.status(200).json({
            ok: true,
            imageUrl,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    obtenerMensajesPublicos,
    obtenerMensajesAdmin,
    obtenerMensajesPendientes,
    crearMensajeCentro,
    actualizarMensajeCentro,
    revisarMensajeCentro,
    subirImagenMensajeCentro,
};
