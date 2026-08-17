const { request, response } = require('express');
const { Reto } = require('../models/retos');
const Equipos = require('../models/equipos');
const Usuarios = require('../models/usuarios');
const Reserva = require('../models/reservas');
const { ADMIN_ROLES, tieneRol } = require('../middlewares/validar-roles');
const { hayBloqueoEntrePar } = require('../helpers/bloqueos');
const { puedeGestionarEquipo } = require('../helpers/equipos-social');
const {
    puedenRetarse,
    puedeResponderReto,
    puedeGestionarReto,
} = require('../helpers/retos-social');

const esAdmin = (req) => tieneRol(req.usuarioAuth, ADMIN_ROLES);

const RETO_POPULATE = [
    {
        path: 'equipoRetador',
        select: 'nombre nombreArchivoImagen capitan deporte',
        populate: { path: 'capitan', select: 'nombre apellido nombre_archivo_imagen' },
    },
    {
        path: 'equipoRetado',
        select: 'nombre nombreArchivoImagen capitan deporte',
        populate: { path: 'capitan', select: 'nombre apellido nombre_archivo_imagen' },
    },
    { path: 'deporte', select: 'nombre' },
];

// Un reto solo puede vincular una reserva que ya este confirmada -- una
// reserva 'pendiente' (todavia esperando que el complejo la confirme) no es
// todavia "real" en el sentido de la decision fundacional 2 del plan.
const ESTADO_RESERVA_VINCULABLE = 'confirmada';

// Que estados de reto "retienen" de verdad la reserva que tienen vinculada
// -- un reto cancelado/rechazado/caducado no deberia seguir bloqueando que
// esa misma reserva se use en otro reto distinto. Se usa tanto para el
// check de "reserva ya usada" (vincularReserva) como para el picker del
// frontend (obtenerReservasVinculadas).
const ESTADOS_RETO_QUE_RETIENEN_RESERVA = ['aceptado', 'jugado'];

const crearReto = async (req = request, res = response) => {
    try {
        const { equipoRetadorId, equipoRetadoId, mensaje = '', fechaPropuesta } = req.body;
        const usuarioId = req.usuarioAuth._id;

        const [equipoRetador, equipoRetado] = await Promise.all([
            Equipos.findById(equipoRetadorId),
            Equipos.findById(equipoRetadoId),
        ]);

        if (!equipoRetador || !equipoRetador.estado) {
            return res.status(404).json({ ok: false, error: 'Tu equipo no existe' });
        }
        if (!equipoRetado || !equipoRetado.estado) {
            return res.status(404).json({ ok: false, error: 'El equipo retado no existe' });
        }

        if (!puedeGestionarEquipo({ capitanId: equipoRetador.capitan, usuarioId, esAdmin: esAdmin(req) })) {
            return res.status(403).json({ ok: false, error: 'Solo el capitan puede retar en nombre de su equipo' });
        }

        if (!puedenRetarse({
            equipoRetadorId,
            equipoRetadoId,
            deporteRetadorId: equipoRetador.deporte,
            deporteRetadoId: equipoRetado.deporte,
        })) {
            return res.status(400).json({
                ok: false,
                error: 'Los equipos tienen que ser distintos y jugar el mismo deporte',
            });
        }

        // Mismo criterio que invitar/solicitar unirse (B3, Fase 3): si hay
        // bloqueo reciproco entre los 2 capitanes, no se puede retar.
        const capitanRetado = await Usuarios.findById(equipoRetado.capitan).select('usuariosBloqueados');
        if (hayBloqueoEntrePar(req.usuarioAuth, capitanRetado)) {
            return res.status(400).json({ ok: false, error: 'No podes retar a este equipo' });
        }

        const yaPendiente = await Reto.findOne({
            equipoRetador: equipoRetadorId,
            equipoRetado: equipoRetadoId,
            estado: 'pendiente',
        });
        if (yaPendiente) {
            return res.status(400).json({ ok: false, error: 'Ya tenes un reto pendiente con este equipo' });
        }

        const reto = await new Reto({
            equipoRetador: equipoRetadorId,
            equipoRetado: equipoRetadoId,
            deporte: equipoRetador.deporte,
            creadoPor: usuarioId,
            mensaje,
            fechaPropuesta: fechaPropuesta || null,
        }).save();

        return res.status(201).json({ ok: true, reto });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const obtenerRetosDeEquipo = async (req = request, res = response) => {
    try {
        const { equipoId } = req.params;
        const equipo = await Equipos.findById(equipoId);
        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (!puedeGestionarEquipo({ capitanId: equipo.capitan, usuarioId: req.usuarioAuth._id, esAdmin: esAdmin(req) })) {
            return res.status(403).json({ ok: false, error: 'Solo el capitan puede ver los retos del equipo' });
        }

        const retos = await Reto.find({
            $or: [{ equipoRetador: equipoId }, { equipoRetado: equipoId }],
        })
            .sort({ createdAt: -1 })
            .populate(RETO_POPULATE);

        return res.status(200).json({ ok: true, retos });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const obtenerReto = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const reto = await Reto.findById(id).populate(RETO_POPULATE).populate('reserva');
        if (!reto) {
            return res.status(404).json({ ok: false, error: 'Reto no encontrado' });
        }

        const autorizado = puedeGestionarReto({
            capitanRetadorId: reto.equipoRetador.capitan,
            capitanRetadoId: reto.equipoRetado.capitan,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
        });
        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'No podes ver este reto' });
        }

        return res.status(200).json({ ok: true, reto });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const responderReto = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { aceptar } = req.body;

        const reto = await Reto.findById(id)
            .populate('equipoRetador', 'capitan')
            .populate('equipoRetado', 'capitan');
        if (!reto) {
            return res.status(404).json({ ok: false, error: 'Reto no encontrado' });
        }

        if (reto.estado !== 'pendiente') {
            return res.status(400).json({ ok: false, error: 'Este reto ya fue respondido' });
        }

        const autorizado = puedeResponderReto({
            capitanRetadoId: reto.equipoRetado.capitan,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
        });
        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'Solo el capitan del equipo retado puede responder' });
        }

        reto.estado = aceptar ? 'aceptado' : 'rechazado';
        reto.respondidoPor = req.usuarioAuth._id;
        if (aceptar) {
            reto.aceptadoEn = new Date();
        }
        await reto.save();

        return res.status(200).json({ ok: true, reto });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const vincularReserva = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { reservaId } = req.body;

        const reto = await Reto.findById(id)
            .populate('equipoRetador', 'capitan')
            .populate('equipoRetado', 'capitan');
        if (!reto) {
            return res.status(404).json({ ok: false, error: 'Reto no encontrado' });
        }

        const autorizado = puedeGestionarReto({
            capitanRetadorId: reto.equipoRetador.capitan,
            capitanRetadoId: reto.equipoRetado.capitan,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
        });
        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'No podes coordinar la reserva de este reto' });
        }

        if (reto.estado !== 'aceptado') {
            return res.status(400).json({ ok: false, error: 'El reto tiene que estar aceptado para vincular una reserva' });
        }

        const reserva = await Reserva.findById(reservaId);
        if (!reserva) {
            return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
        }

        // Coordinar la cancha es responsabilidad de quien representa a cada
        // equipo: la reserva tiene que estar a nombre de uno de los 2
        // capitanes, no de cualquier miembro del plantel (mismo alcance que
        // el resto de las acciones de gestion de un reto).
        const reservaEsDeUnCapitan = [reto.equipoRetador.capitan, reto.equipoRetado.capitan]
            .map(String)
            .includes(String(reserva.usuario));
        if (!reservaEsDeUnCapitan) {
            return res.status(400).json({ ok: false, error: 'La reserva tiene que estar a nombre de uno de los 2 capitanes' });
        }

        if (String(reserva.deporte) !== String(reto.deporte)) {
            return res.status(400).json({ ok: false, error: 'La reserva es de un deporte distinto al del reto' });
        }

        if (reserva.estado !== ESTADO_RESERVA_VINCULABLE) {
            return res.status(400).json({ ok: false, error: 'Solo se puede vincular una reserva confirmada' });
        }

        // Solo un reto 'vivo' (aceptado/jugado) sostiene de verdad el
        // vinculo -- uno cancelado/rechazado/caducado que alguna vez tuvo
        // esta reserva no deberia seguir bloqueando que se reuse en otro
        // reto distinto.
        const reservaYaUsada = await Reto.findOne({
            reserva: reservaId,
            _id: { $ne: reto._id },
            estado: { $in: ESTADOS_RETO_QUE_RETIENEN_RESERVA },
        });
        if (reservaYaUsada) {
            return res.status(400).json({ ok: false, error: 'Esa reserva ya esta vinculada a otro reto' });
        }

        reto.reserva = reservaId;
        await reto.save();

        return res.status(200).json({ ok: true, reto });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

// B5 (brief de diseño de Fase 4): un capitan vinculo la reserva equivocada
// y quiere corregirla sin cancelar el reto entero (que borraria tambien la
// aceptacion y el mensaje). Mismos autorizados que vincular.
const desvincularReserva = async (req = request, res = response) => {
    try {
        const { id } = req.params;

        const reto = await Reto.findById(id)
            .populate('equipoRetador', 'capitan')
            .populate('equipoRetado', 'capitan');
        if (!reto) {
            return res.status(404).json({ ok: false, error: 'Reto no encontrado' });
        }

        const autorizado = puedeGestionarReto({
            capitanRetadorId: reto.equipoRetador.capitan,
            capitanRetadoId: reto.equipoRetado.capitan,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
        });
        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'No podes coordinar la reserva de este reto' });
        }

        if (reto.estado !== 'aceptado') {
            return res.status(400).json({ ok: false, error: 'El reto tiene que estar aceptado' });
        }

        if (!reto.reserva) {
            return res.status(400).json({ ok: false, error: 'Este reto no tiene una reserva vinculada' });
        }

        reto.reserva = null;
        await reto.save();

        return res.status(200).json({ ok: true, reto });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const marcarJugado = async (req = request, res = response) => {
    try {
        const { id } = req.params;

        const reto = await Reto.findById(id)
            .populate('equipoRetador', 'capitan')
            .populate('equipoRetado', 'capitan');
        if (!reto) {
            return res.status(404).json({ ok: false, error: 'Reto no encontrado' });
        }

        const autorizado = puedeGestionarReto({
            capitanRetadorId: reto.equipoRetador.capitan,
            capitanRetadoId: reto.equipoRetado.capitan,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
        });
        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'No podes marcar este reto como jugado' });
        }

        if (reto.estado !== 'aceptado') {
            return res.status(400).json({ ok: false, error: 'El reto tiene que estar aceptado' });
        }

        if (!reto.reserva) {
            return res.status(400).json({ ok: false, error: 'Todavia no hay una reserva vinculada a este reto' });
        }

        const reserva = await Reserva.findById(reto.reserva).select('fecha');
        if (!reserva || !reserva.fecha || reserva.fecha.getTime() > Date.now()) {
            return res.status(400).json({ ok: false, error: 'Todavia no llego la fecha de la reserva vinculada' });
        }

        reto.estado = 'jugado';
        await reto.save();

        return res.status(200).json({ ok: true, reto });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const cancelarReto = async (req = request, res = response) => {
    try {
        const { id } = req.params;

        const reto = await Reto.findById(id)
            .populate('equipoRetador', 'capitan')
            .populate('equipoRetado', 'capitan');
        if (!reto) {
            return res.status(404).json({ ok: false, error: 'Reto no encontrado' });
        }

        const autorizado = puedeGestionarReto({
            capitanRetadorId: reto.equipoRetador.capitan,
            capitanRetadoId: reto.equipoRetado.capitan,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
        });
        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'No podes cancelar este reto' });
        }

        if (!['pendiente', 'aceptado'].includes(reto.estado)) {
            return res.status(400).json({ ok: false, error: 'Este reto ya no se puede cancelar' });
        }

        reto.estado = 'cancelado';
        await reto.save();

        return res.status(200).json({ ok: true, reto });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

// Picker de "Vincular reserva" (pantalla 34d/35d del diseño): antes de
// listar mis reservas confirmadas para elegir, el frontend necesita saber
// cuales ya estan vinculadas a un reto vivo, para mostrarlas deshabilitadas
// en vez de dejar que el usuario elija una y recien enterarse en el 400 de
// vincularReserva.
const obtenerReservasVinculadas = async (req = request, res = response) => {
    try {
        const ids = String(req.query.ids || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);

        if (ids.length === 0) {
            return res.status(200).json({ ok: true, vinculadas: [] });
        }

        const retos = await Reto.find({
            reserva: { $in: ids },
            estado: { $in: ESTADOS_RETO_QUE_RETIENEN_RESERVA },
        }).select('reserva');

        const vinculadas = [...new Set(retos.map((reto) => String(reto.reserva)))];

        return res.status(200).json({ ok: true, vinculadas });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

module.exports = {
    crearReto,
    obtenerRetosDeEquipo,
    obtenerReto,
    responderReto,
    vincularReserva,
    desvincularReserva,
    marcarJugado,
    cancelarReto,
    obtenerReservasVinculadas,
};
