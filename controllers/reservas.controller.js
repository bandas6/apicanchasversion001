const { request, response } = require("express");
const Reservas = require("../models/reservas");
const Canchas = require("../models/canchas");
const Complejos = require("../models/complejos");
const Usuarios = require("../models/usuarios");
const { ADMIN_ROLES, usuarioAdministraComplejo } = require("../middlewares/validar-roles");
const { auditAdminGeneralAction } = require("../helpers/audit-admin-general");
require("../models/deportes");

const parseHourToMinutes = (value = '') => {
    const [hour = '0', minute = '0'] = String(value).split(':');
    return (Number(hour) * 60) + Number(minute);
};

const hasTimeConflict = ({ startA, endA, startB, endB }) => {
    return startA < endB && startB < endA;
};

const getDayOfWeek = (date) => {
    const jsDay = new Date(date).getDay();
    return jsDay === 0 ? 7 : jsDay;
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

const buildAvailabilitySlots = ({ cancha, fecha, reservas = [], identityApproved = true }) => {
    const diaSemana = getDayOfWeek(fecha);
    const tarifasEspeciales = Array.isArray(cancha.tarifasEspeciales) ? cancha.tarifasEspeciales : [];
    const disponibilidad = Array.isArray(cancha.disponibilidadSemanal)
        ? cancha.disponibilidadSemanal
        : [];

    const baseSlots = disponibilidad
        .filter((item) => item?.disponible !== false && Number(item?.diaSemana) === diaSemana)
        .map((item) => ({
            horaInicio: item.horaInicio,
            horaFin: item.horaFin,
            precio: Number(cancha.precioHoraBase || cancha.precioHora || 0),
            tipo: 'base',
        }));

    const fallbackSlots = Array.isArray(cancha.tarifas) ? cancha.tarifas : [];
    const slots = (baseSlots.length > 0
        ? baseSlots
        : fallbackSlots
            .filter((item) => item?.activo !== false && Number(item?.diaSemana) === diaSemana)
            .map((item) => ({
                horaInicio: item.horaInicio,
                horaFin: item.horaFin,
                precio: Number(item.precio || cancha.precioHoraBase || cancha.precioHora || 0),
                tipo: 'legacy',
            })))
        .filter((item) => item.horaInicio && item.horaFin);

    const now = new Date();
    const isToday = sameCalendarDay(now, fecha);
    const currentMinutes = parseHourToMinutes(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

    return slots.map((slot) => {
        const startMinutes = parseHourToMinutes(slot.horaInicio);
        const endMinutes = parseHourToMinutes(slot.horaFin);
        let disponible = true;
        let motivo = 'disponible';

        if (cancha.activa === false) {
            disponible = false;
            motivo = 'cancha_inactiva';
        } else if (cancha.enMantenimiento === true) {
            disponible = false;
            motivo = 'mantenimiento';
        } else if (!identityApproved) {
            disponible = false;
            motivo = 'identidad_no_aprobada';
        } else if (isToday && endMinutes <= currentMinutes) {
            disponible = false;
            motivo = 'horario_pasado';
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
            precio: Number(
                tarifaEspecialAplicable?.precio ||
                slot.precio ||
                cancha.precioHoraBase ||
                cancha.precioHora ||
                0
            ),
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

        if (endMinutes <= startMinutes) {
            return res.status(400).json({
                ok: false,
                error: 'La hora de fin debe ser mayor a la hora de inicio'
            });
        }

        const reservaDate = new Date(data.fecha);
        const startOfDay = new Date(reservaDate.getFullYear(), reservaDate.getMonth(), reservaDate.getDate());
        const endOfDay = new Date(reservaDate.getFullYear(), reservaDate.getMonth(), reservaDate.getDate() + 1);

        const reservasExistentes = await Reservas.find({
            cancha: data.cancha,
            fecha: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            estado: 'confirmada',
        });

        const hayConflicto = reservasExistentes.some((item) => {
            const existingStart = parseHourToMinutes(item.horaInicio);
            const existingEnd = parseHourToMinutes(item.horaFin);

            return hasTimeConflict({
                startA: startMinutes,
                endA: endMinutes,
                startB: existingStart,
                endB: existingEnd,
            });
        });

        if (hayConflicto) {
            return res.status(409).json({
                ok: false,
                error: 'Ya existe una reserva en ese rango horario para esta cancha'
            });
        }

        if (!data.usuario && usuarioAuth?.rol === 'USER_ROL') {
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

            if (usuario.rol !== 'USER_ROL') {
                return res.status(400).json({
                    ok: false,
                    error: 'Solo se pueden asignar reservas a usuarios con USER_ROL'
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

        const complejo = data.complejo
            ? await Complejos.findById(data.complejo)
            : null;

        if (usuarioAuth && ADMIN_ROLES.includes(usuarioAuth.rol)) {
            if (usuarioAuth.rol === 'ADMIN_GENERAL_ROL') {
                // Superadmin puede operar sobre cualquier complejo.
            } else {
            const complejoId = complejo?._id || cancha.complejo;
            const canManage = await usuarioAdministraComplejo(usuarioAuth._id, complejoId);

            if (!canManage) {
                return res.status(403).json({
                    ok: false,
                    error: 'No puedes crear reservas en un complejo que no administras'
                });
            }
            }
        }

        const precioTotal = calculateReservaPrice({
            cancha,
            fecha: data.fecha,
            horaInicio: data.horaInicio,
            horaFin: data.horaFin,
        });

        const reserva = new Reservas({
            ...data,
            precioTotal,
        });

        await reserva.save();

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

        if (hasReservationExpired(reservaActual)) {
            reservaActual.estado = 'expirada';
            if (!String(reservaActual.observaciones || '').trim()) {
                reservaActual.observaciones = RESERVA_EXPIRADA_POR_TIEMPO;
            }
            await reservaActual.save();

            return res.status(409).json({
                ok: false,
                error: 'La solicitud ya expiro porque el horario solicitado ya paso sin confirmacion'
            });
        }

        const nextState = String(req.body?.estado || reservaActual.estado || '').trim();

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

        const reserva = await Reservas.findByIdAndUpdate(id, { ...req.body }, { new: true })
            .populate('usuario')
            .populate('complejo')
            .populate('cancha')
            .populate('deporte');

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
            reserva
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
        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            Reservas.find(query)
                .populate('usuario')
                .populate('complejo')
                .populate('cancha')
                .populate('deporte')
                .sort({ fecha: 1, horaInicio: 1 })
        ]);

        await expirePendingReservations(reservas);

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
        const cancha = await Canchas.findById(id);

        if (!cancha) {
            return res.status(404).json({
                ok: false,
                error: 'Cancha no encontrada'
            });
        }

        const targetDate = fecha ? new Date(fecha) : new Date();
        if (Number.isNaN(targetDate.getTime())) {
            return res.status(400).json({
                ok: false,
                error: 'La fecha enviada no es valida'
            });
        }

        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        const reservas = await Reservas.find({
            cancha: id,
            fecha: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            estado: 'confirmada',
        }).sort({ horaInicio: 1 });

        const identityApproved = req.usuarioAuth?.rol && req.usuarioAuth.rol !== 'USER_ROL'
            ? true
            : req.usuarioAuth?.identidadEstado === 'aprobada';

        const franjas = buildAvailabilitySlots({
            cancha,
            fecha: targetDate,
            reservas,
            identityApproved,
        });

        return res.status(200).json({
            ok: true,
            cancha,
            fecha: startOfDay.toISOString(),
            franjas,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

const obtenerReservas = async (req = request, res = response) => {
    const query = {};
    const { cancha, complejo, usuario, estado } = req.query;

    if (cancha) query.cancha = cancha;
    if (complejo) query.complejo = complejo;
    if (usuario) query.usuario = usuario;
    if (estado) query.estado = estado;

    try {
        if (req.usuarioAuth?.rol === 'ADMIN_ROL') {
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

        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            Reservas.find(query)
                .populate('usuario')
                .populate('complejo')
                .populate('cancha')
                .populate('deporte')
                .sort({ fecha: 1, horaInicio: 1 })
        ]);

        await expirePendingReservations(reservas);

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

        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            Reservas.find(query)
                .populate('usuario')
                .populate('complejo')
                .populate('cancha')
                .populate('deporte')
                .sort({ fecha: 1, horaInicio: 1 }),
        ]);

        await expirePendingReservations(reservas);

        return res.status(200).json({
            ok: true,
            total,
            reservas,
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

        if (hasReservationExpired(reserva)) {
            reserva.estado = 'expirada';
            if (!String(reserva.observaciones || '').trim()) {
                reserva.observaciones = RESERVA_EXPIRADA_POR_TIEMPO;
            }
            await reserva.save();

            return res.status(409).json({
                ok: false,
                error: 'La solicitud ya expiro porque el horario solicitado ya paso sin confirmacion'
            });
        }

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

        if (reserva.estado === 'completada') {
            return res.status(400).json({
                ok: false,
                error: 'No puedes cancelar una reserva completada'
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

        await expirePendingReservations([reserva]);

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

module.exports = {
    guardarReserva,
    obtenerReserva,
    obtenerReservasCancha,
    obtenerDisponibilidadCancha,
    actualizarReserva,
    obtenerReservas,
    obtenerMisReservas,
    cancelarMiReserva,
}
