const { response } = require('express');
const Complejo = require('../models/complejos');
const Cancha = require('../models/canchas');
const Equipo = require('../models/equipos');
const Reserva = require('../models/reservas');

const ADMIN_ROLES = ['ADMIN_ROL', 'ADMIN_GENERAL_ROL'];

const tieneRol = (usuario, rolesPermitidos = []) => {
    const rol = usuario?.rol || '';
    return rolesPermitidos.includes(rol);
};

const esAdminGeneralRol = (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    if (!tieneRol(req.usuarioAuth, ['ADMIN_GENERAL_ROL'])) {
        return res.status(403).json({
            ok: false,
            msg: 'Esta ruta requiere ADMIN_GENERAL_ROL'
        });
    }

    next();
};

const esAdminRol = (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    if (!tieneRol(req.usuarioAuth, ADMIN_ROLES)) {
        return res.status(403).json({
            msg: 'No tienes permisos para acceder a esta ruta - no es admin',
            ok: false
        });
    }

    next();
};

const usuarioEsJugador = (req, res = response, next) => {
    next();
};

const esMismoUsuarioOAdmin = (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    const requesterId = String(req.usuarioAuth._id);
    const targetId = String(req.params.id || '');

    if (tieneRol(req.usuarioAuth, ADMIN_ROLES) || requesterId === targetId) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        msg: 'No tienes permisos para modificar este usuario'
    });
};

const usuarioAdministraComplejo = async (usuarioId, complejoId) => {
    if (!usuarioId || !complejoId) {
        return false;
    }

    const complejo = await Complejo.findOne({
        _id: complejoId,
        $or: [
            { administrador: usuarioId },
            { administradores: usuarioId },
        ],
    }).select('_id');

    return Boolean(complejo);
};

const puedeGestionarComplejo = async (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    if (!tieneRol(req.usuarioAuth, ADMIN_ROLES)) {
        return res.status(403).json({
            ok: false,
            msg: 'Solo los administradores pueden gestionar complejos'
        });
    }

    if (tieneRol(req.usuarioAuth, ['ADMIN_GENERAL_ROL']) || !req.params.id) {
        return next();
    }

    const canManage = await usuarioAdministraComplejo(req.usuarioAuth._id, req.params.id);

    if (canManage) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        msg: 'No puedes gestionar un complejo que no administras'
    });
};

const puedeGestionarCancha = async (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    if (!tieneRol(req.usuarioAuth, ADMIN_ROLES)) {
        return res.status(403).json({
            ok: false,
            msg: 'Solo los administradores pueden gestionar canchas'
        });
    }

    if (tieneRol(req.usuarioAuth, ['ADMIN_GENERAL_ROL'])) {
        return next();
    }

    let complejoId = req.body.complejo;

    if (!complejoId && req.route?.path === '/complejo/:id') {
        complejoId = req.params.id;
    }

    if (!complejoId && req.params.id) {
        const cancha = await Cancha.findById(req.params.id).select('complejo');

        if (!cancha) {
            return res.status(404).json({
                ok: false,
                msg: 'Cancha no encontrada'
            });
        }

        complejoId = cancha.complejo;
    }

    const canManage = await usuarioAdministraComplejo(req.usuarioAuth._id, complejoId);

    if (canManage) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        msg: 'No puedes gestionar canchas de un complejo que no administras'
    });
};

const puedeGestionarReserva = async (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    if (!tieneRol(req.usuarioAuth, ADMIN_ROLES)) {
        return res.status(403).json({
            ok: false,
            msg: 'Solo los administradores pueden gestionar reservas'
        });
    }

    if (tieneRol(req.usuarioAuth, ['ADMIN_GENERAL_ROL']) || !req.params.id) {
        return next();
    }

    const reserva = await Reserva.findById(req.params.id).select('complejo cancha');

    if (!reserva) {
        return res.status(404).json({
            ok: false,
            msg: 'Reserva no encontrada'
        });
    }

    let complejoId = reserva.complejo;

    if (!complejoId && reserva.cancha) {
        const cancha = await Cancha.findById(reserva.cancha).select('complejo');
        complejoId = cancha?.complejo;
    }

    const canManage = await usuarioAdministraComplejo(req.usuarioAuth._id, complejoId);

    if (canManage) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        msg: 'No puedes gestionar reservas de un complejo que no administras'
    });
};

const puedeGestionarEquipo = async (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    if (tieneRol(req.usuarioAuth, ADMIN_ROLES)) {
        return next();
    }

    if (!req.params.id) {
        const ownerId = String(req.body.usuario || '');
        if (ownerId && ownerId === String(req.usuarioAuth._id)) {
            return next();
        }
        return res.status(403).json({
            ok: false,
            msg: 'Solo puedes crear equipos para tu propio usuario'
        });
    }

    const equipo = await Equipo.findById(req.params.id).select('usuario');

    if (!equipo) {
        return res.status(404).json({
            ok: false,
            msg: 'Equipo no encontrado'
        });
    }

    if (String(equipo.usuario) === String(req.usuarioAuth._id)) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        msg: 'No puedes modificar un equipo que no te pertenece'
    });
};

const puedeLeerMensajesUsuario = (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    const targetId = String(req.params.usuarioId || '');
    const currentId = String(req.usuarioAuth._id || '');

    if (tieneRol(req.usuarioAuth, ADMIN_ROLES) || targetId === currentId) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        msg: 'No puedes leer mensajes de otro usuario'
    });
};

const puedeGestionarSolicitudesComplejo = async (req, res = response, next) => {
    if (!req.usuarioAuth) {
        return res.status(401).json({
            ok: false,
            msg: 'Debes autenticarte para continuar'
        });
    }

    if (!tieneRol(req.usuarioAuth, ADMIN_ROLES)) {
        return res.status(403).json({
            ok: false,
            msg: 'Solo los administradores pueden consultar solicitudes por complejo'
        });
    }

    if (tieneRol(req.usuarioAuth, ['ADMIN_GENERAL_ROL'])) {
        return next();
    }

    const complejoId = req.params.idComplejo || req.body.complejo;
    const canManage = await usuarioAdministraComplejo(req.usuarioAuth._id, complejoId);

    if (canManage) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        msg: 'No puedes consultar solicitudes de un complejo que no administras'
    });
};

module.exports = {
    ADMIN_ROLES,
    tieneRol,
    esAdminRol,
    esAdminGeneralRol,
    usuarioEsJugador,
    esMismoUsuarioOAdmin,
    puedeGestionarComplejo,
    puedeGestionarCancha,
    puedeGestionarReserva,
    puedeGestionarEquipo,
    puedeLeerMensajesUsuario,
    puedeGestionarSolicitudesComplejo,
    usuarioAdministraComplejo,
};
