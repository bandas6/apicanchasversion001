const { request, response } = require('express');
const AdminGeneralAudit = require('../models/admin-general-audits');
const Reservas = require('../models/reservas');
const ReservationWaitlist = require('../models/reservation-waitlists');

const obtenerAuditoriaAdminGeneral = async (req = request, res = response) => {
    try {
        const { limit = 20, desde = 0, action, resourceType, actor, target } = req.query;
        const query = {};

        if (action) {
            query.action = action;
        }

        if (resourceType) {
            query.resourceType = resourceType;
        }

        if (actor) {
            query.actorUsuario = actor;
        }

        if (target) {
            query.targetUsuario = target;
        }

        const [total, auditorias] = await Promise.all([
            AdminGeneralAudit.countDocuments(query),
            AdminGeneralAudit.find(query)
                .populate('actorUsuario', 'nombre apellido correo rol')
                .populate('targetUsuario', 'nombre apellido correo rol estado')
                .sort({ createdAt: -1 })
                .skip(Number(desde))
                .limit(Number(limit)),
        ]);

        return res.status(200).json({
            ok: true,
            total,
            auditorias,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerDashboardOperacion = async (req = request, res = response) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const [reservas, waitlistCount] = await Promise.all([
            Reservas.find({
                fecha: { $gte: startOfMonth },
            }).select('estado precioTotal'),
            ReservationWaitlist.countDocuments({ estado: 'activa' }),
        ]);

        const summary = {
            waitlistCount,
            ingresosMes: 0,
            reservasPorEstado: {},
            noShowRate: 0,
            cancelacionTardiaRate: 0,
        };
        let noShowCount = 0;
        let lateCancelCount = 0;

        for (const reserva of reservas) {
            const estado = String(reserva.estado || 'desconocido');
            summary.reservasPorEstado[estado] = Number(summary.reservasPorEstado[estado] || 0) + 1;
            if (estado === 'completada') {
                summary.ingresosMes += Number(reserva.precioTotal || 0);
            }
            if (estado === 'no_show_usuario') {
                noShowCount += 1;
            }
            if (estado === 'cancelada_tardia_usuario') {
                lateCancelCount += 1;
            }
        }

        const totalOperativas = ['completada', 'no_show_usuario', 'cancelada_tardia_usuario']
            .reduce((acc, key) => acc + Number(summary.reservasPorEstado[key] || 0), 0);

        if (totalOperativas > 0) {
            summary.noShowRate = Number(((noShowCount / totalOperativas) * 100).toFixed(2));
            summary.cancelacionTardiaRate = Number(((lateCancelCount / totalOperativas) * 100).toFixed(2));
        }

        return res.status(200).json({
            ok: true,
            summary,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    obtenerAuditoriaAdminGeneral,
    obtenerDashboardOperacion,
};
