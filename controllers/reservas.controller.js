const { request, response } = require("express");
const Reservas = require("../models/reservas");
const Canchas = require("../models/canchas");
const Complejos = require("../models/complejos");
const Usuarios = require("../models/usuarios");
const { ComplexReview, COMPLEX_REVIEW_TAGS } = require("../models/complex-reviews");
const ReservationWaitlist = require("../models/reservation-waitlists");
const { USER_ATTENDANCE_VALUES, USER_BEHAVIOR_VALUES } = require("../models/user-reputation-events");
const { ADMIN_ROLES, usuarioAdministraComplejo } = require("../middlewares/validar-roles");
const { auditAdminGeneralAction } = require("../helpers/audit-admin-general");
const {
    CLOSURE_STATES,
    USER_REVIEW_ALLOWED_STATES,
    USER_EVALUATION_ALLOWED_STATES,
    syncReservationLifecycle,
    syncReservationsForQuery,
    closeReservation,
    refreshReservationPermissions,
    recalculateComplexRating,
    recalculateUserReliability,
    upsertUserEvaluationForReservation,
    getReservationEndAt,
} = require("../helpers/reservation-reputation");
require("../models/deportes");

const populateReservaQuery = (query) => {
    if (!query) {
        return query;
    }

    return query
        .populate('usuario')
        .populate('complejo')
        .populate('cancha')
        .populate('deporte');
};

const parseHourToMinutes = (value = '') => {
    const [hour = '0', minute = '0'] = String(value).split(':');
    return (Number(hour) * 60) + Number(minute);
};

// Parsea una fecha "de calendario" (tipicamente "YYYY-MM-DD", como la envia
// el frontend) sin cruzar por UTC. `new Date('YYYY-MM-DD')` interpreta ese
// string como medianoche UTC; si despues se lee con getters locales
// (getFullYear/getMonth/getDate) en un servidor cuya zona horaria esta
// detras de UTC (cualquier zona de America, incluida Colombia), el dia
// leido queda UN DIA ANTES del que el cliente envio -- por ejemplo, "hoy"
// se lee como "ayer" y termina tratandose como fecha pasada. Este helper
// evita ese cruce construyendo directamente con el constructor local
// (new Date(year, month, day)), que no depende de la zona horaria del
// proceso para el DIA que representa.
// Nunca lanza (mismo contrato que `new Date(x)`): un valor invalido devuelve
// una Invalid Date (`.getTime()` es NaN), no null -- asi los `Number.isNaN`
// que ya existian en cada call-site siguen funcionando sin cambios.
const parseCalendarDate = (value) => {
    if (value instanceof Date) {
        return value;
    }

    const raw = String(value ?? '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, year, month, day] = match;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    // Fallback para formatos que no son "YYYY-MM-DD...": mismo
    // comportamiento que antes tenia todo el archivo. Menos seguro ante el
    // mismo cruce UTC/local si el valor viene sin hora, pero no rompe
    // ningun caso que ya funcionara.
    return new Date(raw);
};

const hasTimeConflict = ({ startA, endA, startB, endB }) => {
    return startA < endB && startB < endA;
};

const getDayOfWeek = (date) => {
    const jsDay = new Date(date).getDay();
    return jsDay === 0 ? 7 : jsDay;
};

const formatMinutesToHour = (minutes = 0) => {
    const safeMinutes = Math.max(0, Math.round(minutes));
    const hour = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
    const minute = String(safeMinutes % 60).padStart(2, '0');
    return `${hour}:${minute}`;
};

const normalizePositiveMinutes = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.round(parsed);
};

const resolveCanchaSlotConfig = (cancha = {}) => {
    const duracionSlotMinutos = normalizePositiveMinutes(
        cancha.duracionSlotMinutos,
        60,
    );
    const pasoSlotMinutos = normalizePositiveMinutes(
        cancha.pasoSlotMinutos,
        duracionSlotMinutos,
    );
    const reservaMinimaMinutos = normalizePositiveMinutes(
        cancha.reservaMinimaMinutos,
        duracionSlotMinutos,
    );
    const reservaMaximaMinutos = normalizePositiveMinutes(
        cancha.reservaMaximaMinutos,
        Math.max(duracionSlotMinutos, reservaMinimaMinutos),
    );

    return {
        duracionSlotMinutos,
        pasoSlotMinutos,
        reservaMinimaMinutos,
        reservaMaximaMinutos,
    };
};

const isSameIsoDate = (rawDate = '', targetDate = new Date()) => {
    if (!rawDate) {
        return false;
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
        return String(rawDate).trim() === targetDate.toISOString().split('T')[0];
    }

    return sameCalendarDay(parsed, targetDate);
};

const isSlotBlockedByOperation = (slotStart, slotEnd, cancha = {}, fecha = new Date()) => {
    const blocks = Array.isArray(cancha.bloquesNoDisponibles)
        ? cancha.bloquesNoDisponibles
        : [];

    return blocks.some((block) => {
        if (block?.activo === false || !isSameIsoDate(block?.fecha, fecha)) {
            return false;
        }

        const blockStart = parseHourToMinutes(block.horaInicio);
        const blockEnd = parseHourToMinutes(block.horaFin);

        return hasTimeConflict({
            startA: slotStart,
            endA: slotEnd,
            startB: blockStart,
            endB: blockEnd,
        });
    });
};

const calculateReservaPrice = ({ cancha, fecha, horaInicio, horaFin }) => {
    const startMinutes = parseHourToMinutes(horaInicio);
    const endMinutes = parseHourToMinutes(horaFin);
    const durationHours = (endMinutes - startMinutes) / 60;
    const diaSemana = getDayOfWeek(fecha);
    const tarifas = Array.isArray(cancha.tarifas) ? cancha.tarifas : [];
    const tarifasEspeciales = Array.isArray(cancha.tarifasEspeciales) ? cancha.tarifasEspeciales : [];

    const tarifaEspecialAplicable = tarifasEspeciales.find((tarifa) => {
        const diasSemana = Array.isArray(tarifa?.diasSemana) ? tarifa.diasSemana.map(Number) : [];
        if (tarifa?.activo === false || !diasSemana.includes(diaSemana)) {
            return false;
        }

        const tarifaInicio = parseHourToMinutes(tarifa.horaInicio);
        const tarifaFin = parseHourToMinutes(tarifa.horaFin);

        return startMinutes >= tarifaInicio && endMinutes <= tarifaFin;
    });

    if (tarifaEspecialAplicable) {
        return Number((durationHours * Number(tarifaEspecialAplicable.precio || 0)).toFixed(2));
    }

    const tarifaAplicable = tarifas.find((tarifa) => {
        if (!tarifa.activo || tarifa.diaSemana !== diaSemana) {
            return false;
        }

        const tarifaInicio = parseHourToMinutes(tarifa.horaInicio);
        const tarifaFin = parseHourToMinutes(tarifa.horaFin);

        return startMinutes >= tarifaInicio && endMinutes <= tarifaFin;
    });

    if (tarifaAplicable) {
        return Number((durationHours * Number(tarifaAplicable.precio || 0)).toFixed(2));
    }

    return Number((durationHours * Number(cancha.precioHoraBase || cancha.precioHora || 0)).toFixed(2));
};

const sameCalendarDay = (a, b) => (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
);

const RESERVA_RECHAZADA_POR_OCUPACION =
    'Solicitud rechazada: la cancha ya fue ocupada en ese horario.';
const RESERVA_EXPIRADA_POR_TIEMPO =
    'La solicitud vencio porque el horario solicitado ya paso sin confirmacion.';

const hasReservationExpired = (reserva, now = new Date()) => {
    if (!reserva || reserva.estado !== 'pendiente' || !reserva.fecha || !reserva.horaFin) {
        return false;
    }

    const fecha = new Date(reserva.fecha);
    if (Number.isNaN(fecha.getTime())) {
        return false;
    }

    const [hour = '0', minute = '0'] = String(reserva.horaFin).split(':');
    const endAt = new Date(
        fecha.getFullYear(),
        fecha.getMonth(),
        fecha.getDate(),
        Number(hour),
        Number(minute),
        0,
        0,
    );

    return endAt.getTime() <= now.getTime();
};

const expirePendingReservations = async (reservas = []) => {
    const now = new Date();
    const expiradas = [];

    for (const reserva of reservas) {
        if (!hasReservationExpired(reserva, now)) {
            continue;
        }

        reserva.estado = 'expirada';
        if (!String(reserva.observaciones || '').trim()) {
            reserva.observaciones = RESERVA_EXPIRADA_POR_TIEMPO;
        }
        await reserva.save();
        expiradas.push(reserva);
    }

    return expiradas;
};

const normalizeReviewTags = (tags = []) => {
    if (!Array.isArray(tags)) {
        return [];
    }

    return [...new Set(
        tags
            .map((item) => String(item || '').trim())
            .filter((item) => COMPLEX_REVIEW_TAGS.includes(item))
    )];
};

const buildComplexReviewPayload = (review = null, reserva = null) => {
    if (!review) {
        return null;
    }

    const reviewWindowEndsAt = reserva?.reviewWindowEndsAt
        ? new Date(reserva.reviewWindowEndsAt)
        : null;
    const canEdit = Boolean(
        reviewWindowEndsAt &&
        reviewWindowEndsAt.getTime() > Date.now(),
    );

    return {
        ...review.toJSON(),
        reviewWindowEndsAt,
        canEdit,
    };
};

const buildReservationReviewSummary = (review = null, reserva = null) => {
    if (!review) {
        return null;
    }

    const basePayload = buildComplexReviewPayload(review, reserva);
    if (!basePayload) {
        return null;
    }

    return {
        rating: Number(basePayload.rating || 0),
        comentario: String(basePayload.comentario || '').trim(),
        tags: Array.isArray(basePayload.tags) ? basePayload.tags : [],
        createdAt: basePayload.createdAt || null,
        updatedAt: basePayload.updatedAt || null,
        canEdit: basePayload.canEdit === true,
        reviewWindowEndsAt: basePayload.reviewWindowEndsAt || null,
    };
};

const attachUserReviewSummaryToReserva = async ({
    reserva,
    userId = null,
}) => {
    if (!reserva || !userId) {
        return reserva;
    }

    const review = await ComplexReview.findOne({
        reservationId: reserva._id || reserva.uid,
        userId,
    });

    if (!review) {
        return reserva;
    }

    const plain = typeof reserva.toJSON === 'function'
        ? reserva.toJSON()
        : { ...reserva };
    plain.userReviewSummary = buildReservationReviewSummary(review, reserva);
    return plain;
};

const attachUserReviewSummariesToReservas = async ({
    reservas = [],
    userId = null,
}) => {
    if (!Array.isArray(reservas) || reservas.length === 0 || !userId) {
        return reservas;
    }

    const reservationIds = reservas
        .map((item) => item?._id || item?.uid)
        .filter(Boolean);

    if (reservationIds.length === 0) {
        return reservas;
    }

    const reviews = await ComplexReview.find({
        reservationId: { $in: reservationIds },
        userId,
    });
    const reviewByReservationId = new Map(
        reviews.map((item) => [String(item.reservationId || ''), item]),
    );

    return reservas.map((item) => {
        const reservationId = String(item?._id || item?.uid || '');
        const review = reviewByReservationId.get(reservationId);
        if (!review) {
            return item;
        }

        const plain = typeof item.toJSON === 'function'
            ? item.toJSON()
            : { ...item };
        plain.userReviewSummary = buildReservationReviewSummary(review, item);
        return plain;
    });
};

const buildUserReputationSummaryPayload = (usuario = {}) => {
    const reliabilityScore = Number(usuario.reliabilityScore || 100);
    return {
        userId: usuario._id || usuario.uid,
        reliabilityScore,
        attendanceCount: Number(usuario.attendanceCount || 0),
        lateCount: Number(usuario.lateCount || 0),
        noShowCount: Number(usuario.noShowCount || 0),
        lateCancelCount: Number(usuario.lateCancelCount || 0),
        reliabilityBadge: usuario.reliabilityBadge || 'confiable',
    };
};

const buildAvailabilitySlots = ({ cancha, complejo, fecha, reservas = [], identityApproved = true }) => {
    const diaSemana = getDayOfWeek(fecha);
    const tarifasEspeciales = Array.isArray(cancha.tarifasEspeciales) ? cancha.tarifasEspeciales : [];
    const slotConfig = resolveCanchaSlotConfig(cancha);
    const disponibilidad = Array.isArray(cancha.disponibilidadSemanal)
        ? cancha.disponibilidadSemanal
        : [];

    const baseBlocks = disponibilidad
        .filter((item) => item?.disponible !== false && Number(item?.diaSemana) === diaSemana)
        .map((item) => ({
            horaInicio: item.horaInicio,
            horaFin: item.horaFin,
            precio: Number(cancha.precioHoraBase || cancha.precioHora || 0),
            tipo: 'base',
        }));

    const fallbackSlots = Array.isArray(cancha.tarifas) ? cancha.tarifas : [];
    const sourceBlocks = (baseBlocks.length > 0
        ? baseBlocks
        : fallbackSlots
            .filter((item) => item?.activo !== false && Number(item?.diaSemana) === diaSemana)
            .map((item) => ({
                horaInicio: item.horaInicio,
                horaFin: item.horaFin,
                precio: Number(item.precio || cancha.precioHoraBase || cancha.precioHora || 0),
                tipo: 'legacy',
            })))
        .filter((item) => item.horaInicio && item.horaFin);

    const slots = sourceBlocks.flatMap((slot) => {
        const startMinutes = parseHourToMinutes(slot.horaInicio);
        const endMinutes = parseHourToMinutes(slot.horaFin);
        const generated = [];

        for (
            let cursor = startMinutes;
            cursor + slotConfig.duracionSlotMinutos <= endMinutes;
            cursor += slotConfig.pasoSlotMinutos
        ) {
            generated.push({
                horaInicio: formatMinutesToHour(cursor),
                horaFin: formatMinutesToHour(cursor + slotConfig.duracionSlotMinutos),
                precio: slot.precio,
                tipo: slot.tipo,
                duracionMinutos: slotConfig.duracionSlotMinutos,
            });
        }

        return generated;
    });

    const now = new Date();
    const isToday = sameCalendarDay(now, fecha);
    const currentMinutes = parseHourToMinutes(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    const normalizedToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const normalizedFecha = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const isPastDate = normalizedFecha.getTime() < normalizedToday.getTime();

    return slots.map((slot) => {
        const startMinutes = parseHourToMinutes(slot.horaInicio);
        const endMinutes = parseHourToMinutes(slot.horaFin);
        let disponible = true;
        let motivo = 'disponible';

        if (cancha.activa === false) {
            disponible = false;
            motivo = 'cancha_inactiva';
        } else if (complejo?.estado === false) {
            disponible = false;
            motivo = 'sede_inactiva';
        } else if (!identityApproved) {
            disponible = false;
            motivo = 'identidad_no_aprobada';
        } else if (isPastDate) {
            disponible = false;
            motivo = 'fecha_pasada';
        } else if (isToday && endMinutes <= currentMinutes) {
            disponible = false;
            motivo = 'horario_pasado';
        } else if (isSlotBlockedByOperation(startMinutes, endMinutes, cancha, fecha)) {
            disponible = false;
            motivo = 'bloqueo_operativo';
        } else {
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

            if (ocupado) {
                disponible = false;
                motivo = 'ocupada';
            }
        }

        const tarifaEspecialAplicable = tarifasEspeciales.find((tarifa) => {
            const diasSemana = Array.isArray(tarifa?.diasSemana) ? tarifa.diasSemana.map(Number) : [];
            if (tarifa?.activo === false || !diasSemana.includes(diaSemana)) {
                return false;
            }
            const tarifaInicio = parseHourToMinutes(tarifa.horaInicio);
            const tarifaFin = parseHourToMinutes(tarifa.horaFin);
            return startMinutes >= tarifaInicio && endMinutes <= tarifaFin;
        });

        return {
            ...slot,
            precio: calculateReservaPrice({
                cancha,
                fecha,
                horaInicio: slot.horaInicio,
                horaFin: slot.horaFin,
            }),
            tipo: tarifaEspecialAplicable ? 'excepcion' : slot.tipo,
            disponible,
            motivo,
        };
    });
};

const guardarReserva = async (req = request, res = response) => {
    try {
        const data = { ...req.body };
        const usuarioAuth = req.usuarioAuth;

        if (!data.fecha || !data.horaInicio || !data.horaFin) {
            return res.status(400).json({
                ok: false,
                error: 'fecha, horaInicio y horaFin son obligatorios'
            });
        }

        const startMinutes = parseHourToMinutes(data.horaInicio);
        const endMinutes = parseHourToMinutes(data.horaFin);

        const reservaDate = parseCalendarDate(data.fecha);
        const startOfDay = new Date(reservaDate.getFullYear(), reservaDate.getMonth(), reservaDate.getDate());
        const endOfDay = new Date(reservaDate.getFullYear(), reservaDate.getMonth(), reservaDate.getDate() + 1);

        await syncReservationsForQuery({
            cancha: data.cancha,
            fecha: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
        });

        if (!data.usuario && usuarioAuth?.rol === 'USER') {
            data.usuario = String(usuarioAuth._id);
        }

        if (data.usuario) {
            if (!usuarioAuth) {
                return res.status(401).json({
                    ok: false,
                    error: 'Debes iniciar sesion para crear una reserva asociada a un usuario'
                });
            }

            const isAdmin = ADMIN_ROLES.includes(usuarioAuth.rol);
            const isSelfReservation = String(usuarioAuth._id) === String(data.usuario);

            if (!isAdmin && !isSelfReservation) {
                return res.status(403).json({
                    ok: false,
                    error: 'No puedes crear reservas para otro usuario'
                });
            }

            const usuario = await Usuarios.findById(data.usuario);

            if (!usuario || !usuario.estado) {
                return res.status(404).json({
                    ok: false,
                    error: 'Usuario no encontrado o inactivo'
                });
            }

            if (usuario.rol !== 'USER') {
                return res.status(400).json({
                    ok: false,
                    error: 'Solo se pueden asignar reservas a usuarios con USER'
                });
            }

            if (usuario.identidadEstado !== 'aprobada') {
                return res.status(403).json({
                    ok: false,
                    error: 'Debes validar tu identidad antes de crear reservas'
                });
            }

        }

        const cancha = await Canchas.findById(data.cancha);

        if (!cancha) {
            return res.status(404).json({
                ok: false,
                error: 'Cancha no encontrada'
            });
        }

        if (!data.deporte && cancha.deporte) {
            data.deporte = cancha.deporte;
        }

        const slotConfig = resolveCanchaSlotConfig(cancha);
        const requestedDuration = endMinutes - startMinutes;

        if (endMinutes <= startMinutes) {
            return res.status(400).json({
                ok: false,
                error: 'La hora de fin debe ser mayor a la hora de inicio'
            });
        }

        if (requestedDuration < slotConfig.reservaMinimaMinutos) {
            return res.status(400).json({
                ok: false,
                error: `La reserva minima para esta cancha es de ${slotConfig.reservaMinimaMinutos} minuto(s)`
            });
        }

        if (requestedDuration > slotConfig.reservaMaximaMinutos) {
            return res.status(400).json({
                ok: false,
                error: `La reserva maxima para esta cancha es de ${slotConfig.reservaMaximaMinutos} minuto(s)`
            });
        }

        if (requestedDuration % slotConfig.duracionSlotMinutos !== 0) {
            return res.status(400).json({
                ok: false,
                error: 'La duracion solicitada no coincide con la unidad de reserva configurada para esta cancha'
            });
        }

        const complejoReserva = data.complejo
            ? await Complejos.findById(data.complejo)
            : await Complejos.findById(cancha.complejo);
        if (!complejoReserva) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado'
            });
        }

        const normalizedReservationDate = new Date(
            reservaDate.getFullYear(),
            reservaDate.getMonth(),
            reservaDate.getDate(),
        );
        const today = new Date();
        const normalizedToday = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
        );

        if (normalizedReservationDate.getTime() < normalizedToday.getTime()) {
            return res.status(400).json({
                ok: false,
                error: 'No se puede reservar para una fecha que ya paso',
            });
        }

        const maxDiasAnticipacionReserva = Math.max(
            1,
            Number(complejoReserva.maxDiasAnticipacionReserva || 7),
        );
        const maxAllowedDate = new Date(normalizedToday);
        maxAllowedDate.setDate(maxAllowedDate.getDate() + maxDiasAnticipacionReserva);

        if (normalizedReservationDate.getTime() > maxAllowedDate.getTime()) {
            return res.status(400).json({
                ok: false,
                error: `Este complejo solo permite reservar hasta ${maxDiasAnticipacionReserva} dia(s) de anticipacion`,
            });
        }

        const reservasExistentes = await Reservas.find({
            cancha: data.cancha,
            fecha: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            estado: 'confirmada',
        });

        const disponibilidadSlots = buildAvailabilitySlots({
            cancha,
            complejo: complejoReserva,
            fecha: reservaDate,
            reservas: reservasExistentes,
            identityApproved: true,
        });
        const slotRequested = disponibilidadSlots.find((item) =>
            item.horaInicio === data.horaInicio &&
            item.horaFin === data.horaFin,
        );

        if (!slotRequested) {
            return res.status(400).json({
                ok: false,
                error: 'El horario solicitado no coincide con un slot reservable valido para esta cancha'
            });
        }

        if (slotRequested.disponible !== true) {
            return res.status(409).json({
                ok: false,
                error: 'El slot solicitado ya no esta disponible para esta cancha'
            });
        }

        if (usuarioAuth && ADMIN_ROLES.includes(usuarioAuth.rol)) {
            if (usuarioAuth.rol === 'DEV') {
                // Superadmin puede operar sobre cualquier complejo.
            } else {
            const complejoId = complejoReserva._id || cancha.complejo;
            const canManage = await usuarioAdministraComplejo(usuarioAuth._id, complejoId);

            if (!canManage) {
                return res.status(403).json({
                    ok: false,
                    error: 'No puedes crear reservas en un complejo que no administras'
                });
            }
            }
        }

        const precioTotal = Number(slotRequested.precio || 0);

        const reserva = new Reservas({
            ...data,
            complejo: data.complejo || complejoReserva._id,
            estado: 'pendiente',
            precioTotal,
        });

        await reserva.save();
        await refreshReservationPermissions(reserva);

        try {
            await cancelarAvisosPorReserva({
                usuarioId: reserva.usuario,
                fecha: reserva.fecha,
                horaInicio: reserva.horaInicio,
            });
        } catch (avisoError) {
            // No bloquea la creacion de la reserva si falla la limpieza de avisos.
        }

        await auditAdminGeneralAction({
            req,
            action: 'CREATE_RESERVA',
            resourceType: 'reserva',
            resourceId: reserva._id,
            targetUsuario: reserva.usuario || null,
            summary: 'Reserva creada por superadmin',
            metadata: {
                complejo: reserva.complejo,
                cancha: reserva.cancha,
                fecha: reserva.fecha,
                estado: reserva.estado,
            },
        });

        return res.status(201).json({
            ok: true,
            reserva
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const actualizarReserva = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const reservaActual = await Reservas.findById(id);

        if (!reservaActual) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada'
            });
        }

        await syncReservationLifecycle(reservaActual);

        const nextState = String(req.body?.estado || reservaActual.estado || '').trim();

        if (CLOSURE_STATES.includes(nextState)) {
            return res.status(400).json({
                ok: false,
                error: 'Usa el endpoint de cierre operativo para aplicar este estado',
            });
        }

        if (nextState === 'confirmada') {
            const reservaDate = new Date(reservaActual.fecha);
            const startOfDay = new Date(
                reservaDate.getFullYear(),
                reservaDate.getMonth(),
                reservaDate.getDate(),
            );
            const endOfDay = new Date(
                reservaDate.getFullYear(),
                reservaDate.getMonth(),
                reservaDate.getDate() + 1,
            );
            const conflictingConfirmed = await Reservas.find({
                _id: { $ne: reservaActual._id },
                cancha: reservaActual.cancha,
                fecha: {
                    $gte: startOfDay,
                    $lt: endOfDay,
                },
                estado: 'confirmada',
            });

            const hasConfirmedConflict = conflictingConfirmed.some((item) => {
                const existingStart = parseHourToMinutes(item.horaInicio);
                const existingEnd = parseHourToMinutes(item.horaFin);

                return hasTimeConflict({
                    startA: parseHourToMinutes(reservaActual.horaInicio),
                    endA: parseHourToMinutes(reservaActual.horaFin),
                    startB: existingStart,
                    endB: existingEnd,
                });
            });

            if (hasConfirmedConflict) {
                return res.status(409).json({
                    ok: false,
                    error: 'No se puede confirmar esta reserva porque la cancha ya fue ocupada en ese horario'
                });
            }

            if (reservaActual.usuario && reservaActual.complejo) {
                const complejo = await Complejos.findById(reservaActual.complejo);
                const limiteDiario = Number(complejo?.maxReservasPorUsuarioPorDia || 1);

                const reservasConfirmadasDelDia = await Reservas.countDocuments({
                    _id: { $ne: reservaActual._id },
                    usuario: reservaActual.usuario,
                    complejo: reservaActual.complejo,
                    fecha: {
                        $gte: startOfDay,
                        $lt: endOfDay,
                    },
                    estado: 'confirmada',
                });

                if (reservasConfirmadasDelDia >= limiteDiario) {
                    return res.status(409).json({
                        ok: false,
                        error: `No se puede confirmar esta solicitud porque el usuario ya alcanzo el maximo de ${limiteDiario} reserva(s) confirmada(s) para este dia en este complejo`
                    });
                }
            }
        }

        const reserva = await Reservas.findByIdAndUpdate(
            id,
            { ...req.body },
            {
                new: true,
                runValidators: true,
            },
        );

        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada'
            });
        }

        if (nextState === 'confirmada') {
            const reservaDate = new Date(reserva.fecha);
            const startOfDay = new Date(
                reservaDate.getFullYear(),
                reservaDate.getMonth(),
                reservaDate.getDate(),
            );
            const endOfDay = new Date(
                reservaDate.getFullYear(),
                reservaDate.getMonth(),
                reservaDate.getDate() + 1,
            );
            const pendientesSolapadas = await Reservas.find({
                _id: { $ne: reserva._id },
                cancha: reserva.cancha?._id || reserva.cancha,
                fecha: {
                    $gte: startOfDay,
                    $lt: endOfDay,
                },
                estado: 'pendiente',
            });

            const rejectedIds = [];

            for (const item of pendientesSolapadas) {
                const overlap = hasTimeConflict({
                    startA: parseHourToMinutes(reserva.horaInicio),
                    endA: parseHourToMinutes(reserva.horaFin),
                    startB: parseHourToMinutes(item.horaInicio),
                    endB: parseHourToMinutes(item.horaFin),
                });

                if (!overlap) {
                    continue;
                }

                item.estado = 'rechazada';
                item.observaciones = RESERVA_RECHAZADA_POR_OCUPACION;
                await item.save();
                rejectedIds.push(String(item._id));
            }

            if (rejectedIds.length > 0) {
                await auditAdminGeneralAction({
                    req,
                    action: 'REJECT_OVERLAPPING_RESERVAS',
                    resourceType: 'reserva',
                    resourceId: reserva._id,
                    targetUsuario: reserva.usuario?._id || reserva.usuario || null,
                    summary: `Se rechazaron ${rejectedIds.length} solicitud(es) solapadas`,
                    metadata: {
                        reservaConfirmada: reserva._id,
                        rechazadas: rejectedIds,
                        motivo: RESERVA_RECHAZADA_POR_OCUPACION,
                    },
                });
            }
        }

        await refreshReservationPermissions(reserva);
        const reservaPopulated = await populateReservaQuery(
            Reservas.findById(reserva._id),
        );

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_RESERVA',
            resourceType: 'reserva',
            resourceId: reserva._id,
            targetUsuario: reserva.usuario?._id || reserva.usuario || null,
            summary: 'Reserva actualizada por superadmin',
            metadata: {
                camposActualizados: Object.keys(req.body || {}),
                estado: reserva.estado,
            },
        });

        return res.status(200).json({
            ok: true,
            reserva: reservaPopulated
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerReservasCancha = async (req = request, res = response) => {
    const { id } = req.params;
    const query = { cancha: id };

    try {
        await syncReservationsForQuery(query);

        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            populateReservaQuery(Reservas.find(query))
                .sort({ fecha: 1, horaInicio: 1 })
        ]);

        return res.status(200).json({
            ok: true,
            total,
            reservas
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerDisponibilidadCancha = async (req = request, res = response) => {
    const { id } = req.params;
    const { fecha } = req.query;

    try {
        const cancha = await Canchas.findById(id).populate('complejo');

        if (!cancha) {
            return res.status(404).json({
                ok: false,
                error: 'Cancha no encontrada'
            });
        }

        const targetDate = fecha ? parseCalendarDate(fecha) : new Date();
        if (Number.isNaN(targetDate.getTime())) {
            return res.status(400).json({
                ok: false,
                error: 'La fecha enviada no es valida'
            });
        }

        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        await syncReservationsForQuery({
            cancha: id,
            fecha: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
        });

        const reservas = await Reservas.find({
            cancha: id,
            fecha: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            estado: 'confirmada',
        }).sort({ horaInicio: 1 });

        const identityApproved = req.usuarioAuth?.rol && req.usuarioAuth.rol !== 'USER'
            ? true
            : req.usuarioAuth?.identidadEstado === 'aprobada';

        const franjas = buildAvailabilitySlots({
            cancha,
            complejo: cancha.complejo,
            fecha: targetDate,
            reservas,
            identityApproved,
        });

        return res.status(200).json({
            ok: true,
            cancha,
            fecha: startOfDay.toISOString(),
            slotConfig: resolveCanchaSlotConfig(cancha),
            franjas,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

const FRANJA_BOUNDS = {
    manana: { start: 6 * 60, end: 12 * 60 },
    tarde: { start: 12 * 60, end: 18 * 60 },
    noche: { start: 18 * 60, end: 24 * 60 },
};

const resolveFranjaKey = (horaInicio) => {
    const minutes = parseHourToMinutes(horaInicio);
    if (minutes >= FRANJA_BOUNDS.manana.start && minutes < FRANJA_BOUNDS.manana.end) {
        return 'manana';
    }
    if (minutes >= FRANJA_BOUNDS.tarde.start && minutes < FRANJA_BOUNDS.tarde.end) {
        return 'tarde';
    }
    return 'noche';
};

const CANCHA_SLOT_FIELDS = [
    'nombre',
    'tipoDeporte',
    'activa',
    'precioHora',
    'precioHoraBase',
    'tarifas',
    'tarifasEspeciales',
    'disponibilidadSemanal',
    'bloquesNoDisponibles',
    'duracionSlotMinutos',
    'pasoSlotMinutos',
    'reservaMinimaMinutos',
    'reservaMaximaMinutos',
].join(' ');

// Cuantos dias hacia adelante se busca "proximaDisponibilidad" cuando el
// complejo no tiene ningun turno libre en la fecha consultada. Mismo orden
// de magnitud que MAX_DIAS_ANTICIPACION_AVISO (aviso de cupo) pero separado
// a proposito: son dos features distintas y no deberian quedar acopladas
// por compartir una constante que despues cambie por otra razon.
const MAX_DIAS_PROXIMA_DISPONIBILIDAD = 6;

// Completa proximaDisponibilidad para los items de `resultado` que quedaron
// sin proximoTurnoLibre en la fecha consultada. Busca dia por dia (hasta
// MAX_DIAS_PROXIMA_DISPONIBILIDAD) el primer dia con al menos un slot
// disponible, en cualquier cancha del complejo, y corta ahi. Trae las
// reservas de toda la ventana en una sola consulta (no una por dia) para no
// multiplicar el costo de red por complejo sin turnos hoy.
const attachProximaDisponibilidad = async ({ resultado, complejos, startOfDay, identityApproved }) => {
    const pendientes = resultado.filter((item) => !item.proximoTurnoLibre);
    if (pendientes.length === 0) {
        return;
    }

    const complejosPorId = new Map(complejos.map((complejo) => [String(complejo._id), complejo]));

    const lookaheadStart = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), startOfDay.getDate() + 1);
    const lookaheadEnd = new Date(
        startOfDay.getFullYear(),
        startOfDay.getMonth(),
        startOfDay.getDate() + 1 + MAX_DIAS_PROXIMA_DISPONIBILIDAD,
    );

    const lookaheadCanchaIds = pendientes
        .flatMap((item) => {
            const canchas = complejosPorId.get(item.complejoId)?.canchas;
            return Array.isArray(canchas) ? canchas : [];
        })
        .map((cancha) => String(cancha?._id || ''))
        .filter(Boolean);

    if (lookaheadCanchaIds.length === 0) {
        return;
    }

    await syncReservationsForQuery({
        cancha: { $in: lookaheadCanchaIds },
        fecha: { $gte: lookaheadStart, $lt: lookaheadEnd },
    });

    const lookaheadReservas = await Reservas.find({
        cancha: { $in: lookaheadCanchaIds },
        fecha: { $gte: lookaheadStart, $lt: lookaheadEnd },
        estado: 'confirmada',
    }).select('cancha fecha horaInicio horaFin estado');

    const reservasPorCanchaYDia = lookaheadReservas.reduce((acc, reserva) => {
        const canchaId = String(reserva.cancha || '');
        const diaKey = new Date(reserva.fecha.getFullYear(), reserva.fecha.getMonth(), reserva.fecha.getDate()).getTime();
        const key = `${canchaId}::${diaKey}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(reserva);
        return acc;
    }, {});

    for (const item of pendientes) {
        const complejo = complejosPorId.get(item.complejoId);
        const canchas = Array.isArray(complejo?.canchas) ? complejo.canchas : [];

        for (let offset = 1; offset <= MAX_DIAS_PROXIMA_DISPONIBILIDAD; offset += 1) {
            const dia = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), startOfDay.getDate() + offset);
            const diaKey = dia.getTime();

            let horaEncontrada = null;
            for (const cancha of canchas) {
                const canchaId = String(cancha?._id || '');
                const reservasDia = reservasPorCanchaYDia[`${canchaId}::${diaKey}`] || [];
                const slots = buildAvailabilitySlots({
                    cancha,
                    fecha: dia,
                    reservas: reservasDia,
                    identityApproved,
                });
                const primerLibre = slots.find((slot) => slot.disponible);
                if (primerLibre && (!horaEncontrada || primerLibre.horaInicio < horaEncontrada)) {
                    horaEncontrada = primerLibre.horaInicio;
                }
            }

            if (horaEncontrada) {
                item.proximaDisponibilidad = {
                    fecha: dia.toISOString(),
                    hora: horaEncontrada,
                };
                break;
            }
        }
    }
};

// Turnos libres agregados por complejo, para el filtro de dia/franja de
// Home (rol USER). Reusa buildAvailabilitySlots (misma logica que
// obtenerDisponibilidadCancha) por cada cancha de cada complejo, agrupando
// el resultado en baldes de franja (manana/tarde/noche), conteo por hora
// exacta y el proximo turno libre del complejo. Si un complejo no tiene
// nada libre en la fecha consultada, ademas busca hacia adelante (hasta
// MAX_DIAS_PROXIMA_DISPONIBILIDAD dias) el primer dia con algo libre y lo
// devuelve en proximaDisponibilidad — o null si no encuentra nada dentro de
// esa ventana (Home no muestra ninguna fecha en ese caso, no adivina).
const obtenerDisponibilidadAgregada = async (req = request, res = response) => {
    const { fecha, complejoIds } = req.query;

    try {
        const targetDate = fecha ? parseCalendarDate(fecha) : new Date();
        if (Number.isNaN(targetDate.getTime())) {
            return res.status(400).json({
                ok: false,
                error: 'La fecha enviada no es valida',
            });
        }

        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        const complejoQuery = { estado: true };
        const ids = String(complejoIds || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        if (ids.length > 0) {
            complejoQuery._id = { $in: ids };
        }

        const complejos = await Complejos.find(complejoQuery)
            .select('canchas')
            .populate('canchas', CANCHA_SLOT_FIELDS)
            .lean();

        const canchaIds = complejos
            .flatMap((complejo) => (Array.isArray(complejo.canchas) ? complejo.canchas : []))
            .map((cancha) => String(cancha?._id || ''))
            .filter(Boolean);

        if (canchaIds.length > 0) {
            await syncReservationsForQuery({
                cancha: { $in: canchaIds },
                fecha: { $gte: startOfDay, $lt: endOfDay },
            });
        }

        const reservas = canchaIds.length > 0
            ? await Reservas.find({
                cancha: { $in: canchaIds },
                fecha: { $gte: startOfDay, $lt: endOfDay },
                estado: 'confirmada',
            }).select('cancha horaInicio horaFin estado')
            : [];

        const reservasByCancha = reservas.reduce((acc, reserva) => {
            const canchaId = String(reserva.cancha || '');
            if (!canchaId) {
                return acc;
            }
            if (!acc[canchaId]) {
                acc[canchaId] = [];
            }
            acc[canchaId].push(reserva);
            return acc;
        }, {});

        // A diferencia de obtenerDisponibilidadCancha (donde identityApproved
        // SI filtra, porque ese endpoint alimenta el flujo real de reserva),
        // aca es siempre true: este endpoint solo cuenta turnos para que un
        // usuario sin sesion o sin identidad verificada pueda explorar y
        // filtrar Home con normalidad. El gate de identidad real se sigue
        // aplicando cuando esa persona intenta reservar de verdad.
        const identityApproved = true;

        const resultado = complejos.map((complejo) => {
            const canchas = Array.isArray(complejo.canchas) ? complejo.canchas : [];
            const franjas = { manana: 0, tarde: 0, noche: 0 };
            const horasMap = new Map();
            let proximoTurnoLibre = null;

            canchas.forEach((cancha) => {
                const canchaId = String(cancha?._id || '');
                const slots = buildAvailabilitySlots({
                    cancha,
                    fecha: targetDate,
                    reservas: reservasByCancha[canchaId] || [],
                    identityApproved,
                });

                slots.forEach((slot) => {
                    if (!slot.disponible) {
                        return;
                    }
                    const franjaKey = resolveFranjaKey(slot.horaInicio);
                    franjas[franjaKey] += 1;

                    const entry = horasMap.get(slot.horaInicio) || { libres: 0, precioDesde: null };
                    entry.libres += 1;
                    const precio = Number(slot.precio);
                    if (Number.isFinite(precio) && (entry.precioDesde === null || precio < entry.precioDesde)) {
                        entry.precioDesde = precio;
                    }
                    horasMap.set(slot.horaInicio, entry);

                    if (!proximoTurnoLibre || slot.horaInicio < proximoTurnoLibre) {
                        proximoTurnoLibre = slot.horaInicio;
                    }
                });
            });

            const horas = Array.from(horasMap.entries())
                .map(([hora, { libres, precioDesde }]) => ({ hora, libres, precioDesde }))
                .sort((a, b) => a.hora.localeCompare(b.hora));

            return {
                complejoId: String(complejo._id),
                franjas,
                horas,
                proximoTurnoLibre,
                proximaDisponibilidad: null,
            };
        });

        await attachProximaDisponibilidad({
            resultado,
            complejos,
            startOfDay,
            identityApproved,
        });

        return res.status(200).json({
            ok: true,
            fecha: startOfDay.toISOString(),
            complejos: resultado,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

// --- Aviso de cupo (Home, "¿Te avisamos cuando se libere?") ---
// El usuario pide que le avisen cuando se libere un turno cerca de el, en
// un dia (y opcionalmente franja) dado. El aviso vive como subdocumento de
// Usuarios (mismo patron que filtrosGuardados/devicePushTokens) porque su
// evaluacion es siempre "para el usuario que pide", nunca cruzada entre
// usuarios: no hace falta una coleccion propia ni un job en background.

const MAX_AVISOS_ACTIVOS = 3;
const MAX_DIAS_ANTICIPACION_AVISO = 6;
const FRANJAS_AVISO_VALIDAS = ['manana', 'tarde', 'noche'];
const EARTH_RADIUS_KM = 6371;

const toRadians = (value) => (value * Math.PI) / 180;

const haversineDistanceKm = (lat1, lng1, lat2, lng2) => {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const crearAvisoDisponibilidad = async (req = request, res = response) => {
    try {
        const usuarioId = req.usuarioAuth?._id;
        if (!usuarioId) {
            return res.status(401).json({
                ok: false,
                error: 'Debes iniciar sesion para crear un aviso',
            });
        }

        const { dia, franja = '', lat, lng, radioKm = 4 } = req.body || {};

        const parsedDia = dia ? parseCalendarDate(dia) : null;
        if (!parsedDia || Number.isNaN(parsedDia.getTime())) {
            return res.status(400).json({
                ok: false,
                error: 'Debes enviar un dia valido',
            });
        }

        const normalizedDia = new Date(parsedDia.getFullYear(), parsedDia.getMonth(), parsedDia.getDate());
        const today = new Date();
        const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const maxAllowedDate = new Date(normalizedToday);
        maxAllowedDate.setDate(maxAllowedDate.getDate() + MAX_DIAS_ANTICIPACION_AVISO);

        if (normalizedDia.getTime() < normalizedToday.getTime()) {
            return res.status(400).json({
                ok: false,
                error: 'No puedes crear un aviso para un dia que ya paso',
            });
        }

        if (normalizedDia.getTime() > maxAllowedDate.getTime()) {
            return res.status(400).json({
                ok: false,
                error: `Solo se pueden crear avisos hasta ${MAX_DIAS_ANTICIPACION_AVISO} dia(s) de anticipacion`,
            });
        }

        const normalizedFranja = String(franja || '').trim();
        if (normalizedFranja && !FRANJAS_AVISO_VALIDAS.includes(normalizedFranja)) {
            return res.status(400).json({
                ok: false,
                error: 'La franja enviada no es valida',
            });
        }

        const parsedLat = Number(lat);
        const parsedLng = Number(lng);
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
            return res.status(400).json({
                ok: false,
                error: 'Debes enviar una ubicacion valida',
            });
        }

        const parsedRadio = Number(radioKm);
        const normalizedRadio = Number.isFinite(parsedRadio) && parsedRadio > 0 ? parsedRadio : 4;

        const usuario = await Usuarios.findById(usuarioId);
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado',
            });
        }

        const activos = (usuario.avisosDisponibilidad || []).filter((item) => item.estado === 'activo');
        if (activos.length >= MAX_AVISOS_ACTIVOS) {
            return res.status(409).json({
                ok: false,
                error: `Ya tienes ${MAX_AVISOS_ACTIVOS} avisos activos. Borra uno para crear otro.`,
            });
        }

        const yaExiste = activos.some((item) =>
            new Date(item.dia).getTime() === normalizedDia.getTime() &&
            String(item.franja || '') === normalizedFranja,
        );
        if (yaExiste) {
            return res.status(409).json({
                ok: false,
                error: 'Ya tienes un aviso activo con ese dia y franja',
            });
        }

        usuario.avisosDisponibilidad = [
            ...(usuario.avisosDisponibilidad || []),
            {
                dia: normalizedDia,
                franja: normalizedFranja,
                lat: parsedLat,
                lng: parsedLng,
                radioKm: normalizedRadio,
                estado: 'activo',
                createdAt: new Date(),
            },
        ];
        await usuario.save();

        const creado = usuario.avisosDisponibilidad[usuario.avisosDisponibilidad.length - 1];

        return res.status(201).json({
            ok: true,
            aviso: creado,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerMisAvisosDisponibilidad = async (req = request, res = response) => {
    try {
        const usuario = await Usuarios.findById(req.usuarioAuth?._id);
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado',
            });
        }

        const today = new Date();
        const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const avisos = (usuario.avisosDisponibilidad || []).filter((item) =>
            ['activo', 'notificado'].includes(item.estado) &&
            new Date(item.dia).getTime() >= normalizedToday.getTime(),
        );

        return res.status(200).json({
            ok: true,
            avisos,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const eliminarAvisoDisponibilidad = async (req = request, res = response) => {
    try {
        const { avisoId } = req.params;
        const usuario = await Usuarios.findById(req.usuarioAuth?._id);
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado',
            });
        }

        usuario.avisosDisponibilidad = (usuario.avisosDisponibilidad || []).filter(
            (item) => String(item._id) !== String(avisoId || ''),
        );
        await usuario.save();

        return res.status(200).json({
            ok: true,
            avisos: usuario.avisosDisponibilidad,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

// Evalua los avisos activos del usuario contra la disponibilidad real (misma
// logica que obtenerDisponibilidadAgregada) y marca como 'notificado' los que
// ya tienen cupo. No dispara push: el cliente llama esto al abrir/reanudar la
// app y usa la respuesta para mostrar una notificacion local (ver
// docs/viabilidad-aviso-cupo.md, V2 — no hay infraestructura de push real).
const obtenerEstadoAvisosDisponibilidad = async (req = request, res = response) => {
    try {
        const usuario = await Usuarios.findById(req.usuarioAuth?._id);
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado',
            });
        }

        const today = new Date();
        const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const avisosActivos = (usuario.avisosDisponibilidad || []).filter((item) =>
            item.estado === 'activo' && new Date(item.dia).getTime() >= normalizedToday.getTime(),
        );

        if (avisosActivos.length === 0) {
            return res.status(200).json({
                ok: true,
                notificados: [],
            });
        }

        const complejos = await Complejos.find({ estado: true })
            .select('canchas ubicacionGeo')
            .populate('canchas', CANCHA_SLOT_FIELDS)
            .lean();

        const notificados = [];

        for (const aviso of avisosActivos) {
            const complejosEnRadio = complejos.filter((complejo) => {
                const lat = Number(complejo.ubicacionGeo?.lat);
                const lng = Number(complejo.ubicacionGeo?.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    return false;
                }
                return haversineDistanceKm(aviso.lat, aviso.lng, lat, lng) <= (aviso.radioKm || 4);
            });

            const canchaIds = complejosEnRadio
                .flatMap((complejo) => (Array.isArray(complejo.canchas) ? complejo.canchas : []))
                .map((cancha) => String(cancha?._id || ''))
                .filter(Boolean);

            if (canchaIds.length === 0) {
                continue;
            }

            const targetDate = new Date(aviso.dia);
            const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

            await syncReservationsForQuery({
                cancha: { $in: canchaIds },
                fecha: { $gte: startOfDay, $lt: endOfDay },
            });

            const reservas = await Reservas.find({
                cancha: { $in: canchaIds },
                fecha: { $gte: startOfDay, $lt: endOfDay },
                estado: 'confirmada',
            }).select('cancha horaInicio horaFin');

            const reservasByCancha = reservas.reduce((acc, reserva) => {
                const canchaId = String(reserva.cancha || '');
                if (!canchaId) {
                    return acc;
                }
                acc[canchaId] = acc[canchaId] || [];
                acc[canchaId].push(reserva);
                return acc;
            }, {});

            const hayCupo = complejosEnRadio.some((complejo) => {
                const canchas = Array.isArray(complejo.canchas) ? complejo.canchas : [];
                return canchas.some((cancha) => {
                    const canchaId = String(cancha?._id || '');
                    const slots = buildAvailabilitySlots({
                        cancha,
                        fecha: targetDate,
                        reservas: reservasByCancha[canchaId] || [],
                        identityApproved: true,
                    });
                    return slots.some((slot) => {
                        if (!slot.disponible) {
                            return false;
                        }
                        if (!aviso.franja) {
                            return true;
                        }
                        return resolveFranjaKey(slot.horaInicio) === aviso.franja;
                    });
                });
            });

            if (hayCupo) {
                aviso.estado = 'notificado';
                notificados.push({
                    id: String(aviso._id),
                    dia: aviso.dia,
                    franja: aviso.franja || null,
                });
            }
        }

        if (notificados.length > 0) {
            await usuario.save();
        }

        return res.status(200).json({
            ok: true,
            notificados,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const cancelarAvisosPorReserva = async ({ usuarioId, fecha, horaInicio }) => {
    if (!usuarioId) {
        return;
    }

    const usuario = await Usuarios.findById(usuarioId);
    if (!usuario || !Array.isArray(usuario.avisosDisponibilidad) || usuario.avisosDisponibilidad.length === 0) {
        return;
    }

    const reservaDate = new Date(fecha);
    const normalizedReservaDia = new Date(
        reservaDate.getFullYear(),
        reservaDate.getMonth(),
        reservaDate.getDate(),
    ).getTime();
    const franjaReserva = resolveFranjaKey(horaInicio);

    let changed = false;
    usuario.avisosDisponibilidad.forEach((aviso) => {
        if (!['activo', 'notificado'].includes(aviso.estado)) {
            return;
        }
        const avisoDia = new Date(aviso.dia);
        const normalizedAvisoDia = new Date(
            avisoDia.getFullYear(),
            avisoDia.getMonth(),
            avisoDia.getDate(),
        ).getTime();
        if (normalizedAvisoDia !== normalizedReservaDia) {
            return;
        }
        if (aviso.franja && aviso.franja !== franjaReserva) {
            return;
        }
        aviso.estado = 'convertido';
        changed = true;
    });

    if (changed) {
        await usuario.save();
    }
};

const ESTADOS_RESERVA = [
    'pendiente',
    'confirmada',
    'rechazada',
    'cancelada',
    'expirada',
    'pendiente_cierre',
    'completada',
    'no_show_usuario',
    'cancelada_tardia_usuario',
    'cancelada_por_complejo',
    'incidencia',
];
const ESTADOS_SIN_INGRESO = ['cancelada', 'rechazada', 'expirada'];
const DIA_MS = 24 * 60 * 60 * 1000;

// El campo `fecha` de una reserva se guarda como medianoche UTC del dia de
// calendario pretendido (ver comentario de `parseFecha` en
// canchas-admin-web/src/app/features/dashboard/dashboard.component.ts). Por
// eso "desde"/"hasta" (strings 'YYYY-MM-DD' que ya representan ese mismo dia
// de calendario) se parsean tambien como medianoche UTC: asi el rango
// [desde, hasta] coincide exactamente con los dias de calendario que ve el
// admin en la web/app, sin corrimientos de zona horaria.
const parseFechaRango = (raw) => new Date(`${raw}T00:00:00.000Z`);

const rangoAnterior = (start, end) => {
    const lengthDays = Math.round((end.getTime() - start.getTime()) / DIA_MS) + 1;
    const prevEnd = new Date(start.getTime() - DIA_MS);
    const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * DIA_MS);
    return { start: prevStart, end: prevEnd };
};

const agregarMetricasRango = async (matchBase, start, end) => {
    const match = { ...matchBase, fecha: { $gte: start, $lte: end } };

    const [facetResult] = await Reservas.aggregate([
        { $match: match },
        {
            $facet: {
                totalesPorEstado: [
                    { $group: { _id: '$estado', count: { $sum: 1 } } },
                ],
                ingreso: [
                    { $match: { estado: { $nin: ESTADOS_SIN_INGRESO } } },
                    { $group: { _id: null, total: { $sum: '$precioTotal' } } },
                ],
                serieDiaria: [
                    { $match: { estado: { $nin: ESTADOS_SIN_INGRESO } } },
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: '%Y-%m-%d', date: '$fecha', timezone: 'UTC' },
                            },
                            ingreso: { $sum: '$precioTotal' },
                            reservas: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ],
                porSede: [
                    {
                        $group: {
                            _id: '$complejo',
                            reservas: { $sum: 1 },
                            ingreso: {
                                $sum: {
                                    $cond: [{ $in: ['$estado', ESTADOS_SIN_INGRESO] }, 0, '$precioTotal'],
                                },
                            },
                        },
                    },
                ],
                pendientes: [
                    { $match: { estado: 'pendiente' } },
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            masAntiguaFechaCreacion: { $min: '$fechaCreacion' },
                        },
                    },
                ],
            },
        },
    ]);

    const totalesPorEstado = Object.fromEntries(ESTADOS_RESERVA.map((estado) => [estado, 0]));
    for (const { _id, count } of facetResult.totalesPorEstado) {
        if (_id && Object.prototype.hasOwnProperty.call(totalesPorEstado, _id)) {
            totalesPorEstado[_id] = count;
        }
    }

    const totalReservas = Object.values(totalesPorEstado).reduce((sum, n) => sum + n, 0);

    return {
        ingresoTotal: facetResult.ingreso[0]?.total ?? 0,
        totalReservas,
        totalesPorEstado,
        serieDiaria: facetResult.serieDiaria.map((item) => ({
            fecha: item._id,
            ingreso: item.ingreso,
            reservas: item.reservas,
        })),
        porSede: facetResult.porSede
            .filter((item) => item._id)
            .map((item) => ({
                complejo: String(item._id),
                reservas: item.reservas,
                ingreso: item.ingreso,
            })),
        pendientes: {
            count: facetResult.pendientes[0]?.count ?? 0,
            masAntiguaFechaCreacion: facetResult.pendientes[0]?.masAntiguaFechaCreacion ?? null,
        },
    };
};

const obtenerDashboardMetricas = async (req = request, res = response) => {
    try {
        const { desde, hasta } = req.query;
        const start = parseFechaRango(desde);
        const end = parseFechaRango(hasta);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            return res.status(400).json({
                ok: false,
                error: 'El rango de fechas no es valido (desde debe ser anterior o igual a hasta)',
            });
        }

        const matchBase = {};

        if (req.usuarioAuth?.rol === 'ADMIN') {
            const complejosAdministrados = await Complejos.find({
                $or: [
                    { administrador: req.usuarioAuth._id },
                    { administradores: req.usuarioAuth._id },
                ],
            }).select('_id');

            const complejoIds = complejosAdministrados.map((item) => item._id);

            if (complejoIds.length === 0) {
                return res.status(200).json({
                    ok: true,
                    rango: { desde, hasta },
                    actual: {
                        ingresoTotal: 0,
                        totalReservas: 0,
                        totalesPorEstado: Object.fromEntries(
                            ESTADOS_RESERVA.map((estado) => [estado, 0]),
                        ),
                        serieDiaria: [],
                        porSede: [],
                        pendientes: { count: 0, masAntiguaFechaCreacion: null },
                    },
                    ingresoAnterior: 0,
                });
            }

            matchBase.complejo = { $in: complejoIds };
        }

        const previo = rangoAnterior(start, end);

        const [actual, anterior] = await Promise.all([
            agregarMetricasRango(matchBase, start, end),
            agregarMetricasRango(matchBase, previo.start, previo.end),
        ]);

        return res.status(200).json({
            ok: true,
            rango: { desde, hasta },
            actual,
            ingresoAnterior: anterior.ingresoTotal,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerReservas = async (req = request, res = response) => {
    const query = {};
    const { cancha, complejo, usuario, estado } = req.query;

    if (cancha) query.cancha = cancha;
    if (complejo) query.complejo = complejo;
    if (usuario) query.usuario = usuario;
    if (estado) query.estado = estado;

    try {
        if (req.usuarioAuth?.rol === 'ADMIN') {
            const complejosAdministrados = await Complejos.find({
                $or: [
                    { administrador: req.usuarioAuth._id },
                    { administradores: req.usuarioAuth._id },
                ],
            }).select('_id');

            const complejoIds = complejosAdministrados.map((item) => item._id);

            if (complejoIds.length === 0) {
                return res.status(200).json({
                    ok: true,
                    total: 0,
                    reservas: [],
                });
            }

            if (query.complejo && !complejoIds.some((id) => String(id) === String(query.complejo))) {
                return res.status(403).json({
                    ok: false,
                    error: 'No puedes consultar reservas de un complejo que no administras',
                });
            }

            query.complejo = query.complejo || { $in: complejoIds };
        }

        await syncReservationsForQuery(query);

        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            populateReservaQuery(Reservas.find(query))
                .sort({ fecha: 1, horaInicio: 1 })
        ]);

        return res.status(200).json({
            ok: true,
            total,
            reservas
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const obtenerMisReservas = async (req = request, res = response) => {
    try {
        const usuarioId = req.usuarioAuth?._id;
        const { estado } = req.query;
        const query = {
            usuario: usuarioId,
        };

        if (estado) {
            query.estado = estado;
        }

        await syncReservationsForQuery(query);

        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            populateReservaQuery(Reservas.find(query))
                .sort({ fecha: 1, horaInicio: 1 }),
        ]);
        const reservasConReview = await attachUserReviewSummariesToReservas({
            reservas,
            userId: usuarioId,
        });

        return res.status(200).json({
            ok: true,
            total,
            reservas: reservasConReview,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

const cancelarMiReserva = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const usuarioId = String(req.usuarioAuth?._id || '');

        const reserva = await Reservas.findById(id)
            .populate('usuario')
            .populate('complejo')
            .populate('cancha')
            .populate('deporte');

        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada'
            });
        }

        await syncReservationLifecycle(reserva);

        if (String(reserva.usuario?._id || reserva.usuario || '') !== usuarioId) {
            return res.status(403).json({
                ok: false,
                error: 'No puedes cancelar una reserva que no te pertenece'
            });
        }

        if (reserva.estado === 'cancelada') {
            return res.status(400).json({
                ok: false,
                error: 'La reserva ya estaba cancelada'
            });
        }

        if (['completada', 'pendiente_cierre', 'no_show_usuario', 'cancelada_tardia_usuario', 'cancelada_por_complejo', 'incidencia'].includes(reserva.estado)) {
            return res.status(400).json({
                ok: false,
                error: 'No puedes cancelar una reserva que ya esta en cierre operativo o cerrada'
            });
        }

        reserva.estado = 'cancelada';
        await reserva.save();

        return res.status(200).json({
            ok: true,
            reserva,
            msg: 'Reserva cancelada correctamente',
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

const obtenerReserva = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        let reserva = await Reservas.findById(id)
            .then((item) => populateReservaQuery(item));

        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada'
            });
        }

        await syncReservationLifecycle(reserva);
        await refreshReservationPermissions(reserva);
        reserva = await attachUserReviewSummaryToReserva({
            reserva,
            userId: req.usuarioAuth?._id || null,
        });

        return res.status(200).json({
            ok: true,
            total: 1,
            reserva
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const cerrarReserva = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { closureReason, closureNotes, attendance, behavior, internalComment } = req.body || {};

        if (!CLOSURE_STATES.includes(String(closureReason || '').trim())) {
            return res.status(400).json({
                ok: false,
                error: 'Debes indicar un motivo de cierre valido',
            });
        }

        let reserva = await Reservas.findById(id);
        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada',
            });
        }

        await syncReservationLifecycle(reserva);
        reserva = await Reservas.findById(id);

        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada',
            });
        }

        if (!['confirmada', 'pendiente_cierre'].includes(reserva.estado)) {
            return res.status(400).json({
                ok: false,
                error: 'La reserva no esta disponible para cierre operativo',
            });
        }

        const endAt = getReservationEndAt(reserva);
        if (reserva.estado === 'confirmada' &&
            endAt != null &&
            endAt.getTime() > Date.now()) {
            return res.status(400).json({
                ok: false,
                error: 'La reserva todavia no termina su franja horaria y aun no puede cerrarse',
            });
        }

        await closeReservation({
            reserva,
            closedBy: req.usuarioAuth?._id || null,
            closureReason: String(closureReason).trim(),
            closureNotes,
            evaluation: {
                attendance,
                behavior,
                internalComment,
            },
        });

        const reservaActualizada = await Reservas.findById(id).then((item) => populateReservaQuery(item));

        return res.status(200).json({
            ok: true,
            reserva: reservaActualizada,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const crearReviewComplejo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { rating, comentario, tags } = req.body || {};
        const userId = req.usuarioAuth?._id;

        let reserva = await Reservas.findById(id);
        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada',
            });
        }

        await syncReservationLifecycle(reserva);
        await refreshReservationPermissions(reserva);
        reserva = await Reservas.findById(id);

        if (String(reserva.usuario || '') !== String(userId || '')) {
            return res.status(403).json({
                ok: false,
                error: 'No puedes resenar una reserva que no te pertenece',
            });
        }

        if (!USER_REVIEW_ALLOWED_STATES.includes(reserva.estado) || !reserva.userCanReviewComplex) {
            return res.status(400).json({
                ok: false,
                error: 'Esta reserva ya no permite resenar al complejo',
            });
        }

        const numericRating = Number(rating || 0);
        if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({
                ok: false,
                error: 'El rating debe estar entre 1 y 5',
            });
        }

        const existing = await ComplexReview.findOne({ reservationId: reserva._id });
        if (existing) {
            return res.status(409).json({
                ok: false,
                error: 'Ya existe una resena asociada a esta reserva',
            });
        }

        const review = await ComplexReview.create({
            reservationId: reserva._id,
            userId: reserva.usuario,
            complejoId: reserva.complejo,
            rating: numericRating,
            comentario: String(comentario || '').trim(),
            tags: normalizeReviewTags(tags),
        });

        await recalculateComplexRating(reserva.complejo);
        reserva.userReviewedComplexAt = review.createdAt || new Date();
        reserva.userCanReviewComplex = false;
        await reserva.save();
        await refreshReservationPermissions(reserva);

        let reservaActualizada = await Reservas.findById(id).then((item) => populateReservaQuery(item));
        reservaActualizada = await attachUserReviewSummaryToReserva({
            reserva: reservaActualizada,
            userId,
        });

        return res.status(201).json({
            ok: true,
            review: buildComplexReviewPayload(review, reserva),
            reserva: reservaActualizada,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerReviewComplejoReserva = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const userId = req.usuarioAuth?._id;

        const reserva = await Reservas.findById(id);
        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada',
            });
        }

        if (String(reserva.usuario || '') !== String(userId || '')) {
            return res.status(403).json({
                ok: false,
                error: 'No puedes consultar una resena que no te pertenece',
            });
        }

        const review = await ComplexReview.findOne({ reservationId: reserva._id })
            .populate('userId', 'nombre apellido fotoUrl nombre_archivo_imagen');

        return res.status(200).json({
            ok: true,
            review: buildComplexReviewPayload(review, reserva),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const editarReviewComplejo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { rating, comentario, tags } = req.body || {};
        const userId = req.usuarioAuth?._id;

        const reserva = await Reservas.findById(id);
        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada',
            });
        }

        const review = await ComplexReview.findOne({ reservationId: reserva._id });
        if (!review) {
            return res.status(404).json({
                ok: false,
                error: 'La resena no existe para esta reserva',
            });
        }

        if (String(review.userId || '') !== String(userId || '')) {
            return res.status(403).json({
                ok: false,
                error: 'No puedes editar una resena que no te pertenece',
            });
        }

        const reviewWindowEndsAt = reserva.reviewWindowEndsAt ? new Date(reserva.reviewWindowEndsAt) : null;
        if (!reviewWindowEndsAt || reviewWindowEndsAt.getTime() <= Date.now()) {
            return res.status(400).json({
                ok: false,
                error: 'La ventana de edicion de la resena ya termino',
            });
        }

        if (rating !== undefined) {
            const numericRating = Number(rating || 0);
            if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
                return res.status(400).json({
                    ok: false,
                    error: 'El rating debe estar entre 1 y 5',
                });
            }
            review.rating = numericRating;
        }

        if (comentario !== undefined) {
            review.comentario = String(comentario || '').trim();
        }

        if (tags !== undefined) {
            review.tags = normalizeReviewTags(tags);
        }

        await review.save();
        await recalculateComplexRating(reserva.complejo);

        let reservaActualizada = await Reservas.findById(id).then((item) => populateReservaQuery(item));
        reservaActualizada = await attachUserReviewSummaryToReserva({
            reserva: reservaActualizada,
            userId,
        });

        return res.status(200).json({
            ok: true,
            review: buildComplexReviewPayload(review, reserva),
            reserva: reservaActualizada,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const evaluarUsuarioReserva = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { attendance, behavior, internalComment } = req.body || {};

        if (attendance !== undefined && !USER_ATTENDANCE_VALUES.includes(String(attendance).trim())) {
            return res.status(400).json({
                ok: false,
                error: 'El valor de asistencia no es valido',
            });
        }

        if (behavior !== undefined && !USER_BEHAVIOR_VALUES.includes(String(behavior).trim())) {
            return res.status(400).json({
                ok: false,
                error: 'El valor de comportamiento no es valido',
            });
        }

        let reserva = await Reservas.findById(id);
        if (!reserva) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada',
            });
        }

        await syncReservationLifecycle(reserva);
        reserva = await Reservas.findById(id);

        if (!reserva || !USER_EVALUATION_ALLOWED_STATES.includes(reserva.estado)) {
            return res.status(400).json({
                ok: false,
                error: 'Esta reserva no permite evaluacion operativa del usuario',
            });
        }

        const event = await upsertUserEvaluationForReservation({
            reserva,
            attendance,
            behavior,
            internalComment,
        });

        const usuario = await Usuarios.findById(reserva.usuario);

        return res.status(200).json({
            ok: true,
            event,
            reputationSummary: buildUserReputationSummaryPayload(usuario || {}),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const repetirReserva = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const reservaBase = await Reservas.findById(id);

        if (!reservaBase) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada',
            });
        }

        if (String(reservaBase.usuario || '') !== String(req.usuarioAuth?._id || '')) {
            return res.status(403).json({
                ok: false,
                error: 'No puedes repetir una reserva que no te pertenece',
            });
        }

        req.body = {
            complejo: reservaBase.complejo,
            cancha: reservaBase.cancha,
            deporte: reservaBase.deporte,
            fecha: req.body?.fecha || reservaBase.fecha,
            horaInicio: req.body?.horaInicio || reservaBase.horaInicio,
            horaFin: req.body?.horaFin || reservaBase.horaFin,
            observaciones: String(
                req.body?.observaciones ||
                reservaBase.observaciones ||
                ''
            ).trim(),
        };

        return guardarReserva(req, res);
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const crearWaitlistReserva = async (req = request, res = response) => {
    try {
        const usuarioId = req.usuarioAuth?._id;
        const { cancha, complejo, fecha, horaInicio, horaFin, observaciones = '', sourceReservationId = null } = req.body || {};

        if (!usuarioId) {
            return res.status(401).json({
                ok: false,
                error: 'Debes iniciar sesion para unirte a la lista de espera',
            });
        }

        const item = await ReservationWaitlist.create({
            usuario: usuarioId,
            cancha,
            complejo,
            fecha,
            horaInicio,
            horaFin,
            observaciones: String(observaciones || '').trim(),
            sourceReservationId,
        });

        return res.status(201).json({
            ok: true,
            waitlist: item,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerMiWaitlist = async (req = request, res = response) => {
    try {
        const items = await ReservationWaitlist.find({
            usuario: req.usuarioAuth?._id,
        })
            .populate('complejo', 'nombre direccion')
            .populate('cancha', 'nombre tipoDeporte')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            ok: true,
            total: items.length,
            waitlist: items,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    guardarReserva,
    obtenerReserva,
    obtenerReservasCancha,
    obtenerDisponibilidadCancha,
    obtenerDisponibilidadAgregada,
    actualizarReserva,
    obtenerReservas,
    obtenerDashboardMetricas,
    obtenerMisReservas,
    cancelarMiReserva,
    cerrarReserva,
    obtenerReviewComplejoReserva,
    crearReviewComplejo,
    editarReviewComplejo,
    evaluarUsuarioReserva,
    repetirReserva,
    crearWaitlistReserva,
    obtenerMiWaitlist,
    crearAvisoDisponibilidad,
    obtenerMisAvisosDisponibilidad,
    obtenerEstadoAvisosDisponibilidad,
    eliminarAvisoDisponibilidad,
}
