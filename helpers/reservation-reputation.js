const Reservas = require('../models/reservas');
const Complejos = require('../models/complejos');
const Usuarios = require('../models/usuarios');
const { ComplexReview } = require('../models/complex-reviews');
const { UserReputationEvent } = require('../models/user-reputation-events');

const REVIEW_EDIT_WINDOW_HOURS = 24;
const AUTO_CLOSE_PENDING_HOURS = 12;

const CLOSURE_STATES = [
    'completada',
    'no_show_usuario',
    'cancelada_tardia_usuario',
    'cancelada_por_complejo',
    'incidencia',
];

const USER_REVIEW_ALLOWED_STATES = ['completada'];
const USER_EVALUATION_ALLOWED_STATES = [
    'completada',
    'no_show_usuario',
    'cancelada_tardia_usuario',
];

const parseHourToMinutes = (value = '') => {
    const [hour = '0', minute = '0'] = String(value || '').split(':');
    return (Number(hour) * 60) + Number(minute);
};

const getReservationEndAt = (reserva) => {
    const fecha = new Date(reserva?.fecha);
    if (Number.isNaN(fecha.getTime())) {
        return null;
    }

    const endMinutes = parseHourToMinutes(reserva?.horaFin);
    return new Date(
        fecha.getFullYear(),
        fecha.getMonth(),
        fecha.getDate(),
        Math.floor(endMinutes / 60),
        endMinutes % 60,
        0,
        0,
    );
};

const getPendingClosureDeadline = (reserva) => {
    const endAt = getReservationEndAt(reserva);
    if (!endAt) {
        return null;
    }

    return new Date(endAt.getTime() + (AUTO_CLOSE_PENDING_HOURS * 60 * 60 * 1000));
};

const normalizeText = (value = '') => String(value || '').trim();

const normalizeAttendance = ({ closureReason, attendance }) => {
    const raw = normalizeText(attendance);
    if (raw === 'llego_tarde') {
        return 'llego_tarde';
    }

    if (closureReason === 'no_show_usuario' || closureReason === 'cancelada_tardia_usuario') {
        return 'no_asistio';
    }

    return 'asistio';
};

const normalizeBehavior = (value = '') => (
    normalizeText(value) === 'conflictivo' ? 'conflictivo' : 'correcto'
);

const resolveReliabilityBadge = (score = 100) => {
    if (score >= 80) {
        return 'confiable';
    }
    if (score >= 60) {
        return 'normal';
    }
    return 'con incidencias';
};

const computeReliabilitySummary = (events = []) => {
    let attendanceCount = 0;
    let lateCount = 0;
    let noShowCount = 0;
    let lateCancelCount = 0;
    let reliabilityScore = 100;

    for (const event of events) {
        const closureReason = normalizeText(event?.closureReason);
        const attendance = normalizeText(event?.attendance);
        const behavior = normalizeText(event?.behavior);

        if (closureReason === 'cancelada_tardia_usuario') {
            lateCancelCount += 1;
            reliabilityScore -= 4;
        } else if (closureReason === 'no_show_usuario') {
            noShowCount += 1;
            reliabilityScore -= 8;
        } else if (attendance === 'llego_tarde') {
            lateCount += 1;
            reliabilityScore -= 2;
        } else if (attendance === 'asistio') {
            attendanceCount += 1;
            reliabilityScore += 1;
        }

        if (behavior === 'conflictivo') {
            reliabilityScore -= 10;
        }
    }

    const normalizedScore = Math.max(0, Math.min(100, reliabilityScore));

    return {
        attendanceCount,
        lateCount,
        noShowCount,
        lateCancelCount,
        reliabilityScore: normalizedScore,
        reliabilityBadge: resolveReliabilityBadge(normalizedScore),
        totalEvents: events.length,
    };
};

const recalculateComplexRating = async (complejoId) => {
    if (!complejoId) {
        return null;
    }

    const reviews = await ComplexReview.find({ complejoId }).select('rating');
    const totalResenas = reviews.length;
    const ratingBreakdown = {
        oneStar: 0,
        twoStars: 0,
        threeStars: 0,
        fourStars: 0,
        fiveStars: 0,
    };

    let rating = null;
    if (totalResenas > 0) {
        const total = reviews.reduce((sum, item) => {
            const current = Number(item?.rating || 0);
            if (current === 1) ratingBreakdown.oneStar += 1;
            if (current === 2) ratingBreakdown.twoStars += 1;
            if (current === 3) ratingBreakdown.threeStars += 1;
            if (current === 4) ratingBreakdown.fourStars += 1;
            if (current === 5) ratingBreakdown.fiveStars += 1;
            return sum + current;
        }, 0);
        rating = Number((total / totalResenas).toFixed(2));
    }

    await Complejos.findByIdAndUpdate(complejoId, {
        rating,
        totalResenas,
        ratingBreakdown,
    });

    return { rating, totalResenas, ratingBreakdown };
};

const recalculateUserReliability = async (userId) => {
    if (!userId) {
        return null;
    }

    const events = await UserReputationEvent.find({ userId })
        .sort({ createdAt: 1 })
        .select('attendance behavior closureReason');
    const summary = computeReliabilitySummary(events);

    await Usuarios.findByIdAndUpdate(userId, {
        reliabilityScore: summary.reliabilityScore,
        attendanceCount: summary.attendanceCount,
        lateCount: summary.lateCount,
        noShowCount: summary.noShowCount,
        lateCancelCount: summary.lateCancelCount,
        reliabilityBadge: summary.reliabilityBadge,
    });

    return summary;
};

const refreshReservationPermissions = async (reserva) => {
    if (!reserva) {
        return null;
    }

    const [review, event] = await Promise.all([
        ComplexReview.findOne({ reservationId: reserva._id }).select('_id createdAt updatedAt'),
        UserReputationEvent.findOne({ reservationId: reserva._id }).select('_id createdAt updatedAt'),
    ]);

    const reviewWindowEndsAt = reserva.reviewWindowEndsAt
        ? new Date(reserva.reviewWindowEndsAt)
        : null;
    const reviewWindowOpen = reviewWindowEndsAt && reviewWindowEndsAt.getTime() > Date.now();

    reserva.userCanReviewComplex = USER_REVIEW_ALLOWED_STATES.includes(reserva.estado)
        && !review
        && Boolean(reviewWindowOpen);
    reserva.complexCanEvaluateUser = USER_EVALUATION_ALLOWED_STATES.includes(reserva.estado)
        && !event;
    reserva.userReviewedComplexAt = review?.updatedAt || review?.createdAt || reserva.userReviewedComplexAt || null;
    reserva.complexEvaluatedUserAt = event?.updatedAt || event?.createdAt || reserva.complexEvaluatedUserAt || null;

    await reserva.save();

    return { review, event, reserva };
};

const upsertUserEvaluationForReservation = async ({
    reserva,
    attendance,
    behavior,
    internalComment,
}) => {
    if (!reserva || !USER_EVALUATION_ALLOWED_STATES.includes(reserva.estado)) {
        return null;
    }

    const event = await UserReputationEvent.findOneAndUpdate(
        { reservationId: reserva._id },
        {
            reservationId: reserva._id,
            userId: reserva.usuario,
            complejoId: reserva.complejo,
            closureReason: reserva.closureReason || reserva.estado,
            attendance: normalizeAttendance({
                closureReason: reserva.closureReason || reserva.estado,
                attendance,
            }),
            behavior: normalizeBehavior(behavior),
            internalComment: normalizeText(internalComment),
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        },
    );

    reserva.complexEvaluatedUserAt = event.updatedAt || event.createdAt || new Date();
    reserva.complexCanEvaluateUser = false;
    await reserva.save();
    await recalculateUserReliability(reserva.usuario);

    return event;
};

const closeReservation = async ({
    reserva,
    closedBy = null,
    closureReason,
    closureNotes = '',
    evaluation = {},
}) => {
    if (!reserva) {
        throw new Error('Reserva no encontrada');
    }

    if (!CLOSURE_STATES.includes(closureReason)) {
        throw new Error('Motivo de cierre no valido');
    }

    const now = new Date();
    reserva.estado = closureReason;
    reserva.closedAt = now;
    reserva.closedBy = closedBy || null;
    reserva.closureReason = closureReason;
    reserva.closureNotes = normalizeText(closureNotes);
    reserva.reviewWindowEndsAt = closureReason === 'completada'
        ? new Date(now.getTime() + (REVIEW_EDIT_WINDOW_HOURS * 60 * 60 * 1000))
        : null;
    await reserva.save();

    if (USER_EVALUATION_ALLOWED_STATES.includes(closureReason)) {
        await upsertUserEvaluationForReservation({
            reserva,
            attendance: evaluation?.attendance,
            behavior: evaluation?.behavior,
            internalComment: evaluation?.internalComment,
        });
    } else {
        reserva.complexCanEvaluateUser = false;
        reserva.complexEvaluatedUserAt = null;
        await reserva.save();
    }

    await refreshReservationPermissions(reserva);
    return reserva;
};

const syncReservationLifecycle = async (reserva, now = new Date()) => {
    if (!reserva) {
        return reserva;
    }

    const endAt = getReservationEndAt(reserva);
    if (!endAt) {
        return reserva;
    }

    if (reserva.estado === 'pendiente' && endAt.getTime() <= now.getTime()) {
        reserva.estado = 'expirada';
        if (!normalizeText(reserva.observaciones)) {
            reserva.observaciones = 'La solicitud vencio porque el horario solicitado ya paso sin confirmacion.';
        }
        await reserva.save();
        return reserva;
    }

    if (reserva.estado === 'confirmada' && endAt.getTime() <= now.getTime()) {
        reserva.estado = 'pendiente_cierre';
        await reserva.save();
        return reserva;
    }

    if (reserva.estado === 'pendiente_cierre') {
        const deadline = getPendingClosureDeadline(reserva);
        if (deadline && deadline.getTime() <= now.getTime()) {
            await closeReservation({
                reserva,
                closureReason: 'completada',
                closureNotes: 'Cierre automatico de respaldo por vencimiento de la ventana operativa.',
            });
        }
    }

    return reserva;
};

const syncReservationsForQuery = async (query = {}) => {
    const reservas = await Reservas.find({
        ...query,
        estado: { $in: ['pendiente', 'confirmada', 'pendiente_cierre'] },
    });

    for (const reserva of reservas) {
        await syncReservationLifecycle(reserva);
    }

    return reservas;
};

const runReservationLifecycleSweep = async () => {
    await syncReservationsForQuery({});
};

module.exports = {
    REVIEW_EDIT_WINDOW_HOURS,
    AUTO_CLOSE_PENDING_HOURS,
    CLOSURE_STATES,
    USER_REVIEW_ALLOWED_STATES,
    USER_EVALUATION_ALLOWED_STATES,
    getReservationEndAt,
    getPendingClosureDeadline,
    normalizeAttendance,
    normalizeBehavior,
    resolveReliabilityBadge,
    computeReliabilitySummary,
    recalculateComplexRating,
    recalculateUserReliability,
    refreshReservationPermissions,
    upsertUserEvaluationForReservation,
    closeReservation,
    syncReservationLifecycle,
    syncReservationsForQuery,
    runReservationLifecycleSweep,
};
