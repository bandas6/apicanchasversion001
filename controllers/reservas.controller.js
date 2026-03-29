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

    return Number((durationHours * Number(cancha.precioHora || 0)).toFixed(2));
};

const sameCalendarDay = (a, b) => (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
);

const buildAvailabilitySlots = ({ cancha, fecha, reservas = [], identityApproved = true }) => {
    const diaSemana = getDayOfWeek(fecha);
    const tarifas = Array.isArray(cancha.tarifas) ? cancha.tarifas : [];
    const disponibilidad = Array.isArray(cancha.disponibilidadSemanal)
        ? cancha.disponibilidadSemanal
        : [];

    const baseSlots = tarifas
        .filter((item) => item?.activo !== false && Number(item?.diaSemana) === diaSemana)
        .map((item) => ({
            horaInicio: item.horaInicio,
            horaFin: item.horaFin,
            precio: Number(item.precio || 0),
            tipo: 'tarifa',
        }));

    const fallbackSlots = disponibilidad
        .filter((item) => item?.disponible !== false && Number(item?.diaSemana) === diaSemana)
        .map((item) => ({
            horaInicio: item.horaInicio,
            horaFin: item.horaFin,
            precio: Number(cancha.precioHora || 0),
            tipo: 'base',
        }));

    const slots = (baseSlots.length > 0 ? baseSlots : fallbackSlots)
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
                if (!['pendiente', 'confirmada'].includes(item.estado)) {
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

        return {
            ...slot,
            disponible,
            motivo,
        };
    });
};

const guardarReserva = async (req = request, res = response) => {
    try {
        const data = req.body;
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
            estado: { $in: ['pendiente', 'confirmada'] },
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

            const reservaActivaExistente = await Reservas.findOne({
                usuario: data.usuario,
                estado: { $in: ['pendiente', 'confirmada'] },
            });

            if (reservaActivaExistente) {
                return res.status(409).json({
                    ok: false,
                    error: 'Este usuario ya tiene una reserva activa y no puede crear otra hasta finalizarla o cancelarla'
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

        if (data.usuario && complejo) {
            const limiteDiario = Number(complejo.maxReservasPorUsuarioPorDia || 1);

            const reservasActivasDelDia = await Reservas.countDocuments({
                usuario: data.usuario,
                complejo: complejo._id,
                fecha: {
                    $gte: startOfDay,
                    $lt: endOfDay,
                },
                estado: { $in: ['pendiente', 'confirmada'] },
            });

            if (reservasActivasDelDia >= limiteDiario) {
                return res.status(409).json({
                    ok: false,
                    error: `Este usuario ya alcanzo el maximo de ${limiteDiario} reserva(s) activa(s) para este dia en el complejo`
                });
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
        const reservas = await Reservas.findByIdAndUpdate(id, { ...req.body }, { new: true })
            .populate('usuario')
            .populate('complejo')
            .populate('cancha')
            .populate('deporte');

        if (!reservas) {
            return res.status(404).json({
                ok: false,
                error: 'Reserva no encontrada'
            });
        }

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_RESERVA',
            resourceType: 'reserva',
            resourceId: reservas._id,
            targetUsuario: reservas.usuario?._id || reservas.usuario || null,
            summary: 'Reserva actualizada por superadmin',
            metadata: {
                camposActualizados: Object.keys(req.body || {}),
                estado: reservas.estado,
            },
        });

        return res.status(200).json({
            ok: true,
            reservas
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
            estado: { $in: ['pendiente', 'confirmada'] },
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
        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            Reservas.find(query)
                .populate('usuario')
                .populate('complejo')
                .populate('cancha')
                .populate('deporte')
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

        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            Reservas.find(query)
                .populate('usuario')
                .populate('complejo')
                .populate('cancha')
                .populate('deporte')
                .sort({ fecha: 1, horaInicio: 1 }),
        ]);

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
