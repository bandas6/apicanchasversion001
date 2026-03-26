const { request, response } = require("express");
const Reservas = require("../models/reservas");
const Canchas = require("../models/canchas");
const Usuarios = require("../models/usuarios");
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

const guardarReserva = async (req = request, res = response) => {
    try {
        const data = req.body;

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
            ? await require("../models/complejos").findById(data.complejo)
            : null;

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
    actualizarReserva,
    obtenerReservas,
}
