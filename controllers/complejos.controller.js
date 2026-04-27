const { request, response } = require("express");
const Complejos = require("../models/complejos");
const Canchas = require("../models/canchas");
const Reservas = require("../models/reservas");
const ComplexClaim = require("../models/complex-claims");
const { ComplexReview } = require("../models/complex-reviews");
const { auditAdminGeneralAction } = require("../helpers/audit-admin-general");
const { uploadBufferToCloudinary } = require("../helpers/cloudinary");
const { ensurePointWithinActiveCoverage } = require('../helpers/coberturas-geograficas');
const { recalculateComplexRating } = require('../helpers/reservation-reputation');
require("../models/deportes");

const userAlreadyManagesComplex = (usuarioId, complejo = {}) => {
    const requester = String(usuarioId || '');
    if (!requester) return false;

    const administrador = complejo.administrador;
    const administradorId = typeof administrador === 'object' && administrador !== null
        ? String(administrador._id || administrador.uid || '')
        : String(administrador || '');

    if (administradorId === requester) {
        return true;
    }

    return (complejo.administradores || []).some((item) => {
        const itemId = typeof item === 'object' && item !== null
            ? String(item._id || item.uid || '')
            : String(item || '');
        return itemId === requester;
    });
};

const appendClaimMetadata = async ({ complejo, usuarioAuth }) => {
    const plain = normalizeComplejoRatingSnapshot(complejo);
    const reclamoEstado = plain.reclamoEstado || 'disponible';
    const propiedadVerificada = plain.propiedadVerificada === true;
    const isGeneralAdmin = usuarioAuth?.rol === 'ADMIN_GENERAL_ROL';
    const alreadyManages = userAlreadyManagesComplex(usuarioAuth?._id, plain);

    let reclamoUsuarioEstado = '';
    if (usuarioAuth?._id) {
        const claim = await ComplexClaim.findOne({
            complejo: plain.uid || plain._id,
            solicitante: usuarioAuth._id,
        })
            .sort({ createdAt: -1 })
            .select('estado');
        reclamoUsuarioEstado = claim?.estado || '';
    }

    return {
        ...plain,
        propiedadVerificada,
        reclamoEstado,
        reclamoUsuarioEstado,
        reclamoDisponible: !isGeneralAdmin &&
            !alreadyManages &&
            !propiedadVerificada &&
            reclamoEstado !== 'verificado' &&
            reclamoUsuarioEstado !== 'pendiente',
    };
};

const normalizarPayloadComplejo = (data = {}) => {
    const payload = { ...data };
    const latitudNumerica = Number(payload.latitud);
    const longitudNumerica = Number(payload.longitud);

    if (payload.telefonoContacto === '' || payload.telefonoContacto === undefined) {
        delete payload.telefonoContacto;
    } else if (payload.telefonoContacto !== null) {
        payload.telefonoContacto = String(payload.telefonoContacto).trim();
    }

    if (payload.whatsappContacto === '' || payload.whatsappContacto === undefined) {
        delete payload.whatsappContacto;
    } else if (payload.whatsappContacto !== null) {
        payload.whatsappContacto = String(payload.whatsappContacto).trim();
    }

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

    if (
        payload.maxDiasAnticipacionReserva === '' ||
        payload.maxDiasAnticipacionReserva === undefined
    ) {
        delete payload.maxDiasAnticipacionReserva;
    } else if (payload.maxDiasAnticipacionReserva !== null) {
        payload.maxDiasAnticipacionReserva = Number(payload.maxDiasAnticipacionReserva);
    }

    if (typeof payload.imagenesActualesJson === 'string') {
        try {
            const parsed = JSON.parse(payload.imagenesActualesJson);
            payload.imagenes = Array.isArray(parsed)
                ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
                : [];
        } catch (_) {
            payload.imagenes = [];
        }
    } else if (Array.isArray(payload.imagenes)) {
        payload.imagenes = payload.imagenes
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    return payload;
};

const buildCloudinaryPublicId = (...parts) =>
    parts
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .join('-')
        .replace(/[^a-zA-Z0-9-_]/g, '_');

const uploadImageIfPresent = async ({ file, folder, publicId }) => {
    if (!file?.buffer) {
        return null;
    }

    const result = await uploadBufferToCloudinary({
        buffer: file.buffer,
        folder,
        publicId,
    });

    return result?.secure_url || '';
};

const uploadManyImages = async ({ files = [], folder, publicIdPrefix }) => {
    const uploaded = [];

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file?.buffer) continue;

        const secureUrl = await uploadImageIfPresent({
            file,
            folder,
            publicId: buildCloudinaryPublicId(publicIdPrefix, Date.now(), index),
        });

        if (secureUrl) {
            uploaded.push(secureUrl);
        }
    }

    return uploaded;
};

const mergeUniqueUrls = (...collections) => {
    const seen = new Set();
    const merged = [];

    for (const collection of collections) {
        for (const rawItem of collection || []) {
            const item = String(rawItem || '').trim();
            if (!item || seen.has(item)) continue;
            seen.add(item);
            merged.push(item);
        }
    }

    return merged;
};

const isSummaryViewRequested = (value = '') => (
    String(value || '').trim().toLowerCase() === 'summary'
);

const normalizeComplejoRatingSnapshot = (complejo = {}) => {
    const plain = typeof complejo.toJSON === 'function'
        ? complejo.toJSON()
        : { ...complejo };
    const reviewsCount = Number(plain.reviewsCount ?? plain.totalResenas ?? 0);
    const ratingAverage = plain.ratingAverage ?? plain.rating ?? null;
    const ratingAverageDisplay = plain.ratingAverageDisplay ?? plain.rating ?? null;
    const ratingStatus = plain.ratingStatus || (reviewsCount >= 5
        ? 'established'
        : reviewsCount > 0
            ? 'building'
            : 'new');

    plain.reviewsCount = reviewsCount;
    plain.totalResenas = reviewsCount;
    plain.ratingAverage = ratingAverage == null ? null : Number(ratingAverage);
    plain.ratingAverageDisplay = ratingAverageDisplay == null
        ? null
        : Number(ratingAverageDisplay);
    plain.rating = plain.ratingAverageDisplay;
    plain.ratingStatus = ratingStatus;
    plain.ratingSummaryLabel = plain.ratingSummaryLabel ||
        (ratingStatus === 'established' ? 'Verificado por reservas' : 'Nuevo');

    return plain;
};

const buildCompactComplexSnapshot = (complejo = {}) => {
    const plain = typeof complejo.toJSON === 'function'
        ? complejo.toJSON()
        : { ...complejo };
    const canchas = Array.isArray(plain.canchas) ? plain.canchas : [];

    let minPrice = null;
    let availableCourts = 0;

    for (const cancha of canchas) {
        const basePrice = Number(
            cancha?.precioHoraBase ??
            cancha?.precioHora ??
            0
        );

        if (Number.isFinite(basePrice) && basePrice > 0) {
            minPrice = minPrice == null ? basePrice : Math.min(minPrice, basePrice);
        }

        if (cancha?.activa !== false && cancha?.enMantenimiento !== true) {
            availableCourts += 1;
        }
    }

    plain.minPrice = minPrice;
    plain.courtsCount = canchas.length;
    plain.availableCourts = availableCourts;
    return plain;
};

const toPublicComplexReview = (review = {}) => {
    const plain = typeof review.toJSON === 'function'
        ? review.toJSON()
        : { ...review };
    const user = plain.userId && typeof plain.userId === 'object'
        ? plain.userId
        : {};

    return {
        uid: plain.uid || plain._id,
        reservationId: plain.reservationId,
        userId: {
            uid: user.uid || user._id,
            nombre: user.nombre || '',
            apellido: user.apellido || '',
            imagenUrl: user.imagenUrl || user.fotoUrl || user.nombre_archivo_imagen || '',
        },
        complejoId: plain.complejoId,
        rating: Number(plain.rating || 0),
        comentario: plain.comentario || '',
        tags: Array.isArray(plain.tags) ? plain.tags : [],
        createdAt: plain.createdAt || null,
        updatedAt: plain.updatedAt || null,
    };
};

const resolveComplejoCover = ({
    uploadedCover = '',
    requestedImages = [],
    uploadedGallery = [],
    currentCover = '',
}) => {
    const requested = requestedImages.map((item) => String(item || '').trim()).filter(Boolean);
    const uploaded = uploadedGallery.map((item) => String(item || '').trim()).filter(Boolean);
    const current = String(currentCover || '').trim();
    const cover = String(uploadedCover || '').trim();

    if (cover) {
        return cover;
    }

    if (current && requested.includes(current)) {
        return current;
    }

    if (requested.length > 0) {
        return requested[0];
    }

    if (uploaded.length > 0) {
        return uploaded[0];
    }

    return '';
};

const parseHourToMinutes = (value = '') => {
    const [hour = '0', minute = '0'] = String(value || '').split(':');
    return (Number(hour) * 60) + Number(minute);
};

const buildReservaEndDate = ({ fecha, horaFin }) => {
    if (!fecha) {
        return null;
    }

    const base = new Date(fecha);
    if (Number.isNaN(base.getTime())) {
        return null;
    }

    const [hour = '0', minute = '0'] = String(horaFin || '').split(':');
    base.setHours(Number(hour) || 0, Number(minute) || 0, 0, 0);
    return base;
};

const getDayOfWeek = (date) => {
    const jsDay = new Date(date).getDay();
    return jsDay === 0 ? 7 : jsDay;
};

const hasTimeConflict = ({ startA, endA, startB, endB }) => (
    startA < endB && startB < endA
);

const hasAvailableSlotsToday = ({ cancha, reservas = [], now = new Date() }) => {
    if (!cancha || cancha.activa === false || cancha.enMantenimiento === true) {
        return false;
    }

    const diaSemana = getDayOfWeek(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const tarifas = Array.isArray(cancha.tarifas) ? cancha.tarifas : [];
    const disponibilidad = Array.isArray(cancha.disponibilidadSemanal)
        ? cancha.disponibilidadSemanal
        : [];

    const slotsBase = disponibilidad
        .filter((item) => item?.disponible !== false && Number(item?.diaSemana) === diaSemana)
        .map((item) => ({
            horaInicio: item.horaInicio,
            horaFin: item.horaFin,
        }));

    const slots = (slotsBase.length > 0
        ? slotsBase
        : tarifas
            .filter((item) => item?.activo !== false && Number(item?.diaSemana) === diaSemana)
            .map((item) => ({
                horaInicio: item.horaInicio,
                horaFin: item.horaFin,
            })))
        .filter((item) => item.horaInicio && item.horaFin);

    return slots.some((slot) => {
        const startMinutes = parseHourToMinutes(slot.horaInicio);
        const endMinutes = parseHourToMinutes(slot.horaFin);

        if (endMinutes <= currentMinutes) {
            return false;
        }

        const ocupado = reservas.some((item) => {
            if (item.estado !== 'confirmada') {
                return false;
            }

            const existingStart = parseHourToMinutes(item.horaInicio);
            const existingEnd = parseHourToMinutes(item.horaFin);

            return hasTimeConflict({
                startA: startMinutes,
                endA: endMinutes,
                startB: existingStart,
                endB: existingEnd,
            });
        });

        return !ocupado;
    });
};

const attachTodayAvailability = async (complejos = []) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const canchaIds = complejos
        .flatMap((complejo) => (Array.isArray(complejo.canchas) ? complejo.canchas : []))
        .map((cancha) => String(cancha?._id || cancha?.uid || '').trim())
        .filter(Boolean);

    const reservas = canchaIds.length > 0
        ? await Reservas.find({
            cancha: { $in: canchaIds },
            fecha: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            estado: 'confirmada',
        }).select('cancha horaInicio horaFin estado')
        : [];

    const reservasByCancha = reservas.reduce((acc, reserva) => {
        const canchaId = String(reserva.cancha || '').trim();
        if (!canchaId) {
            return acc;
        }

        if (!acc[canchaId]) {
            acc[canchaId] = [];
        }
        acc[canchaId].push(reserva);
        return acc;
    }, {});

    return complejos.map((doc) => {
        const plain = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
        const canchas = Array.isArray(plain.canchas) ? plain.canchas : [];
        plain.disponibleHoy = canchas.some((cancha) => {
            const canchaId = String(cancha?._id || cancha?.uid || '').trim();
            return hasAvailableSlotsToday({
                cancha,
                reservas: reservasByCancha[canchaId] || [],
                now,
            });
        });
        return plain;
    });
};

const guardarComplejo = async (req = request, res = response) => {
    try {
        const data = normalizarPayloadComplejo(req.body);
        const files = req.files || {};
        const portadaFile = Array.isArray(files.portada) ? files.portada[0] : null;
        data.administrador = req.usuarioAuth._id;
        data.administradores = [req.usuarioAuth._id];
        if (req.usuarioAuth?.rol === 'ADMIN_ROL') {
            data.propiedadVerificada = true;
            data.reclamoEstado = 'verificado';
            data.reclamadoPor = req.usuarioAuth._id;
            data.reclamadoAt = new Date();
        }
        const validationError = validateComplejoPayload({
            data,
            requireCover: true,
            hasCoverFile: Boolean(portadaFile?.buffer),
        });

        if (validationError) {
            return res.status(400).json({
                ok: false,
                error: validationError,
            });
        }

        const portadaUrl = await uploadImageIfPresent({
            file: portadaFile,
            folder: 'canchas/complejos',
            publicId: buildCloudinaryPublicId('complejo-portada', data.nombre || req.usuarioAuth._id, Date.now()),
        });
        if (portadaUrl) {
            data.img = portadaUrl;
        }
        data.imagenes = data.img ? [data.img] : [];
        const lat = data.ubicacionGeo?.lat;
        const lng = data.ubicacionGeo?.lng;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            await ensurePointWithinActiveCoverage({ lat, lng });
        }
        const complejo = new Complejos(data);

        await complejo.save();

        await auditAdminGeneralAction({
            req,
            action: 'CREATE_COMPLEJO',
            resourceType: 'complejo',
            resourceId: complejo._id,
            summary: `Complejo creado: ${complejo.nombre || ''}`.trim(),
        });

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
        const files = req.files || {};
        const portadaFile = Array.isArray(files.portada) ? files.portada[0] : null;
        const complejoActual = await Complejos.findById(id);

        if (!complejoActual) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado'
            });
        }

        data.administrador = req.usuarioAuth._id;
        data.administradores = [req.usuarioAuth._id];
        data.img = data.img || complejoActual.img || '';
        const validationError = validateComplejoPayload({
            data,
            requireCover: false,
            hasCoverFile: Boolean(portadaFile?.buffer),
        });

        if (validationError) {
            return res.status(400).json({
                ok: false,
                error: validationError,
            });
        }

        const portadaUrl = await uploadImageIfPresent({
            file: portadaFile,
            folder: 'canchas/complejos',
            publicId: buildCloudinaryPublicId('complejo-portada', id, Date.now()),
        });
        data.img = portadaUrl || data.img || complejoActual.img || '';
        data.imagenes = data.img ? [data.img] : [];
        const lat = data.ubicacionGeo?.lat;
        const lng = data.ubicacionGeo?.lng;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            await ensurePointWithinActiveCoverage({ lat, lng });
        }

        const complejo = await Complejos.findByIdAndUpdate(id, data, { new: true })
            .populate('administrador')
            .populate('administradores')
            .populate('deportes')
            .populate('canchas');

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_COMPLEJO',
            resourceType: 'complejo',
            resourceId: complejo._id,
            summary: `Complejo actualizado: ${complejo.nombre || ''}`.trim(),
            metadata: {
                camposActualizados: Object.keys(data),
            },
        });

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

const validateComplejoPayload = ({ data = {}, requireCover = false, hasCoverFile = false }) => {
    const nombre = String(data.nombre || '').trim();
    const descripcion = String(data.descripcion || '').trim();
    const telefonoContacto = String(data.telefonoContacto || '').trim();
    const whatsappContacto = String(data.whatsappContacto || '').trim();
    const direccion = String(data.direccion || '').trim();
    const maxReservasPorUsuarioPorDia = Number(data.maxReservasPorUsuarioPorDia);
    const maxDiasAnticipacionReserva = Number(data.maxDiasAnticipacionReserva);
    const lat = Number(data.ubicacionGeo?.lat ?? data.latitud);
    const lng = Number(data.ubicacionGeo?.lng ?? data.longitud);

    if (!nombre) {
        return 'El nombre del complejo es obligatorio';
    }

    if (!telefonoContacto && !whatsappContacto) {
        return 'Debes registrar al menos un telefono o un WhatsApp de contacto';
    }

    if (!descripcion) {
        return 'La descripcion del complejo es obligatoria';
    }

    if (!Number.isFinite(maxReservasPorUsuarioPorDia) || maxReservasPorUsuarioPorDia < 1) {
        return 'El maximo de reservas por usuario por dia debe ser mayor o igual a 1';
    }

    if (!Number.isFinite(maxDiasAnticipacionReserva) || maxDiasAnticipacionReserva < 1) {
        return 'El maximo de dias de anticipacion para reservar debe ser mayor o igual a 1';
    }

    if (!direccion) {
        return 'Debes seleccionar la ubicacion del complejo en el mapa';
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return 'Debes seleccionar una ubicacion valida para el complejo';
    }

    const currentCover = String(data.img || '').trim();
    if (requireCover && !hasCoverFile && !currentCover) {
        return 'La foto de portada del complejo es obligatoria';
    }

    return null;
};

const eliminarComplejo = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const complejo = await Complejos.findById(id);

        if (!complejo) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado',
            });
        }

        const now = new Date();
        const startOfDay = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );
        const reservasActivas = await Reservas.find({
            complejo: id,
            fecha: { $gte: startOfDay },
            estado: { $in: ['pendiente', 'confirmada', 'pendiente_cierre'] },
        }).select('fecha horaInicio horaFin estado');

        const tieneReservasFuturasActivas = reservasActivas.some((item) => {
            const endDate = buildReservaEndDate({
                fecha: item.fecha,
                horaFin: item.horaFin,
            });
            return endDate != null && endDate > now;
        });

        if (tieneReservasFuturasActivas) {
            return res.status(409).json({
                ok: false,
                error: 'No puedes eliminar este complejo porque tiene reservas futuras activas. Revisa o cancela esas reservas antes de continuar.',
            });
        }

        await Complejos.findByIdAndUpdate(
            id,
            { estado: false },
            { new: true },
        );

        const canchasActualizadas = await Canchas.updateMany(
            { complejo: id, eliminado: false },
            {
                $set: {
                    eliminado: true,
                    activa: false,
                    enMantenimiento: false,
                },
            },
        );

        await auditAdminGeneralAction({
            req,
            action: 'DELETE_COMPLEJO',
            resourceType: 'complejo',
            resourceId: complejo._id,
            summary: `Complejo desactivado: ${complejo.nombre || ''}`.trim(),
            metadata: {
                canchasAfectadas: canchasActualizadas.modifiedCount ?? 0,
            },
        });

        return res.status(200).json({
            ok: true,
            complejoId: id,
            canchasAfectadas: canchasActualizadas.modifiedCount ?? 0,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerComplejos = async (req = request, res = response) => {
    const { desde = 0, limit = 20, administrador, view, q } = req.query;
    const query = { estado: true };
    const summaryView = isSummaryViewRequested(view);
    const searchRegex = String(q || '').trim();

    if (administrador) {
        query.$or = [
            { administrador },
            { administradores: administrador },
        ];
    }

    if (searchRegex) {
        const regex = new RegExp(
            searchRegex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i',
        );
        query.$and = [
            ...(Array.isArray(query.$and) ? query.$and : []),
            {
                $or: [
                    { nombre: regex },
                    { direccion: regex },
                    { descripcion: regex },
                ],
            },
        ];
    }

    try {
        const listQuery = Complejos.find(query)
            .skip(Number(desde))
            .limit(Number(limit));

        if (summaryView) {
            listQuery
                .populate('deportes', 'nombre slug')
                .populate(
                    'canchas',
                    [
                        'nombre',
                        'descripcion',
                        'tipoDeporte',
                        'precioHora',
                        'precioHoraBase',
                        'activa',
                        'enMantenimiento',
                        'tarifas',
                        'tarifasEspeciales',
                        'disponibilidadSemanal',
                        'img',
                        'imagenes',
                    ].join(' '),
                )
                .lean();
        } else {
            listQuery
                .populate('administrador')
                .populate('administradores')
                .populate('deportes')
                .populate('canchas');
        }

        const [total, complejos] = await Promise.all([
            Complejos.countDocuments(query),
            listQuery,
        ]);
        const complejosConDisponibilidad = (await attachTodayAvailability(complejos))
            .map((item) => normalizeComplejoRatingSnapshot(item))
            .map((item) => summaryView ? buildCompactComplexSnapshot(item) : item);

        return res.status(200).json({
            ok: true,
            total,
            complejos: complejosConDisponibilidad
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
        const [complejoConDisponibilidad] = await attachTodayAvailability(
            complejo ? [complejo] : [],
        );

        if (!complejoConDisponibilidad) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado'
            });
        }

        return res.status(200).json({
            ok: true,
            total: 1,
            complejo: await appendClaimMetadata({
                complejo: complejoConDisponibilidad,
                usuarioAuth: req.usuarioAuth,
            })
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

const obtenerReviewsComplejo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { limit = 20, desde = 0, q, moderationStatus = 'visible' } = req.query;

        const complejo = await Complejos.findById(id).select('_id');
        if (!complejo) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado',
            });
        }

        const query = {
            complejoId: id,
            ...(moderationStatus === 'all' ? {} : { moderationStatus }),
        };
        const normalizedQuery = String(q || '').trim();
        if (normalizedQuery) {
            query.comentario = new RegExp(
                normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
        }

        const [total, reviews] = await Promise.all([
            ComplexReview.countDocuments(query),
            ComplexReview.find(query)
                .populate('userId', 'nombre apellido fotoUrl nombre_archivo_imagen')
                .sort({ updatedAt: -1, createdAt: -1 })
                .skip(Number(desde))
                .limit(Number(limit)),
        ]);

        return res.status(200).json({
            ok: true,
            total,
            reviews: reviews.map((item) => toPublicComplexReview(item)),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const reportarReviewComplejo = async (req = request, res = response) => {
    try {
        const { reviewId } = req.params;
        const { reason = '' } = req.body || {};
        const review = await ComplexReview.findById(reviewId);

        if (!review) {
            return res.status(404).json({
                ok: false,
                error: 'Resena no encontrada',
            });
        }

        review.moderationStatus = 'reported';
        review.reportReason = String(reason || '').trim();
        review.reportedAt = new Date();
        review.reportedBy = req.usuarioAuth?._id || null;
        await review.save();

        return res.status(200).json({
            ok: true,
            review: toPublicComplexReview(review),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const moderarReviewComplejo = async (req = request, res = response) => {
    try {
        const { reviewId } = req.params;
        const { action = 'visible', moderationNotes = '' } = req.body || {};
        const nextStatus = String(action || '').trim().toLowerCase();

        if (!['visible', 'hidden', 'reported'].includes(nextStatus)) {
            return res.status(400).json({
                ok: false,
                error: 'Accion de moderacion no valida',
            });
        }

        const review = await ComplexReview.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                ok: false,
                error: 'Resena no encontrada',
            });
        }

        review.moderationStatus = nextStatus;
        review.moderationNotes = String(moderationNotes || '').trim();
        review.moderatedAt = new Date();
        review.moderatedBy = req.usuarioAuth?._id || null;
        await review.save();

        return res.status(200).json({
            ok: true,
            review: toPublicComplexReview(review),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    guardarComplejo,
    obtenerComplejos,
    obtenerComplejo,
    obtenerCanchasPorComplejo,
    actualizarComplejo,
    eliminarComplejo,
    obtenerReviewsComplejo,
    reportarReviewComplejo,
    moderarReviewComplejo,
}
