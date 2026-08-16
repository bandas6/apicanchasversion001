const { request, response } = require('express');
const Equipos = require('../models/equipos');
const { EquipoMembresia } = require('../models/equipo-membresias');
const Deportes = require('../models/deportes');
const { ADMIN_ROLES, tieneRol } = require('../middlewares/validar-roles');
const {
    puedeGestionarEquipo,
    puedeResponderMembresia,
    puedeExpulsarMiembro,
    puedeSalirDelEquipo,
} = require('../helpers/equipos-social');

const ROSTER_POPULATE = { path: 'usuario', select: 'nombre apellido nombre_archivo_imagen' };

const esAdmin = (req) => tieneRol(req.usuarioAuth, ADMIN_ROLES);

// Fase 1 (docs/equipos-social-plan.md): antes de crear una membresia
// 'aceptada' (por creacion de equipo, invitacion aceptada o solicitud
// aceptada) se chequea explicitamente que el usuario no tenga ya un equipo
// aceptado en ese deporte, para devolver un 400 legible en vez de dejar
// que el indice unico parcial de EquipoMembresia tire un error crudo de
// Mongo. El indice sigue siendo la garantia real contra condiciones de
// carrera.
const tieneEquipoAceptadoEnDeporte = async (usuarioId, deporteId) => {
    const existente = await EquipoMembresia.findOne({
        usuario: usuarioId,
        deporte: deporteId,
        estado: 'aceptada',
    });
    return Boolean(existente);
};

const crearEquipo = async (req = request, res = response) => {
    try {
        const { nombre, deporte, descripcion, nombreArchivoImagen } = req.body;
        const capitanId = req.usuarioAuth._id;

        const deporteDoc = await Deportes.findById(deporte);
        if (!deporteDoc || !deporteDoc.activo) {
            return res.status(400).json({ ok: false, error: 'El deporte indicado no existe' });
        }

        if (await tieneEquipoAceptadoEnDeporte(capitanId, deporte)) {
            return res.status(400).json({
                ok: false,
                error: 'Ya tenes un equipo de este deporte',
            });
        }

        const equipo = new Equipos({
            nombre,
            deporte,
            descripcion,
            nombreArchivoImagen,
            capitan: capitanId,
        });
        await equipo.save();

        await new EquipoMembresia({
            equipo: equipo._id,
            usuario: capitanId,
            deporte,
            rol: 'capitan',
            origen: 'creacion',
            estado: 'aceptada',
        }).save();

        return res.status(201).json({ ok: true, equipo });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const obtenerEquipos = async (req = request, res = response) => {
    try {
        const { limit = 20, desde = 0, deporte, q } = req.query;
        const query = { estado: true };
        const normalizedQuery = String(q || '').trim();

        if (deporte) {
            query.deporte = deporte;
        }

        if (normalizedQuery) {
            query.nombre = new RegExp(
                normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
        }

        const [total, equipos] = await Promise.all([
            Equipos.countDocuments(query),
            Equipos.find(query)
                .populate('deporte', 'nombre')
                .populate('capitan', 'nombre apellido')
                .skip(Number(desde))
                .limit(Number(limit)),
        ]);

        return res.status(200).json({ ok: true, total, equipos });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const obtenerEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;

        const equipo = await Equipos.findById(id)
            .populate('deporte', 'nombre')
            .populate('capitan', 'nombre apellido nombre_archivo_imagen');

        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        const roster = await EquipoMembresia.find({ equipo: id, estado: 'aceptada' })
            .populate(ROSTER_POPULATE)
            .sort({ rol: 1, createdAt: 1 });

        return res.status(200).json({ ok: true, equipo, roster });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const actualizarEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const equipo = await Equipos.findById(id);

        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (!puedeGestionarEquipo({ capitanId: equipo.capitan, usuarioId: req.usuarioAuth._id, esAdmin: esAdmin(req) })) {
            return res.status(403).json({ ok: false, error: 'No podes modificar un equipo que no te pertenece' });
        }

        const { nombre, descripcion, nombreArchivoImagen } = req.body;
        if (nombre !== undefined) equipo.nombre = nombre;
        if (descripcion !== undefined) equipo.descripcion = descripcion;
        if (nombreArchivoImagen !== undefined) equipo.nombreArchivoImagen = nombreArchivoImagen;
        await equipo.save();

        return res.status(200).json({ ok: true, equipo });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const eliminarEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const equipo = await Equipos.findById(id);

        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (!puedeGestionarEquipo({ capitanId: equipo.capitan, usuarioId: req.usuarioAuth._id, esAdmin: esAdmin(req) })) {
            return res.status(403).json({ ok: false, error: 'No podes borrar un equipo que no te pertenece' });
        }

        equipo.estado = false;
        await equipo.save();

        // V5 (docs/equipos-social-fase1.md, hallazgo del diseño 32d): D6 le
        // promete al capitan que "se pierden el plantel y las solicitudes
        // pendientes" -- sin esto, las EquipoMembresia (roster, invitaciones,
        // solicitudes) quedaban huerfanas apuntando a un equipo ya inactivo.
        await EquipoMembresia.deleteMany({ equipo: id });

        return res.status(200).json({ ok: true, equipo });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const obtenerMisEquipos = async (req = request, res = response) => {
    try {
        const membresias = await EquipoMembresia.find({
            usuario: req.usuarioAuth._id,
            estado: 'aceptada',
        }).populate({
            path: 'equipo',
            populate: [{ path: 'deporte', select: 'nombre' }],
        });

        const equipos = membresias
            .filter((membresia) => membresia.equipo && membresia.equipo.estado)
            .map((membresia) => ({
                equipo: membresia.equipo,
                rol: membresia.rol,
            }));

        return res.status(200).json({ ok: true, equipos });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const solicitarUnirseEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { mensaje = '' } = req.body;
        const usuarioId = req.usuarioAuth._id;

        const equipo = await Equipos.findById(id);
        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (String(equipo.capitan) === String(usuarioId)) {
            return res.status(400).json({ ok: false, error: 'Ya sos el capitan de este equipo' });
        }

        if (await tieneEquipoAceptadoEnDeporte(usuarioId, equipo.deporte)) {
            return res.status(400).json({ ok: false, error: 'Ya tenes un equipo de este deporte' });
        }

        const yaPendiente = await EquipoMembresia.findOne({ equipo: id, usuario: usuarioId, estado: 'pendiente' });
        if (yaPendiente) {
            return res.status(400).json({ ok: false, error: 'Ya tenes una solicitud pendiente con este equipo' });
        }

        const membresia = await new EquipoMembresia({
            equipo: id,
            usuario: usuarioId,
            deporte: equipo.deporte,
            rol: 'miembro',
            origen: 'solicitud',
            estado: 'pendiente',
            mensaje,
        }).save();

        return res.status(201).json({ ok: true, membresia });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const invitarJugador = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const { usuarioId, mensaje = '' } = req.body;

        const equipo = await Equipos.findById(id);
        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (!puedeGestionarEquipo({ capitanId: equipo.capitan, usuarioId: req.usuarioAuth._id, esAdmin: esAdmin(req) })) {
            return res.status(403).json({ ok: false, error: 'Solo el capitan puede invitar jugadores' });
        }

        if (String(usuarioId) === String(equipo.capitan)) {
            return res.status(400).json({ ok: false, error: 'El capitan ya pertenece al equipo' });
        }

        const yaPendiente = await EquipoMembresia.findOne({ equipo: id, usuario: usuarioId, estado: 'pendiente' });
        if (yaPendiente) {
            return res.status(400).json({ ok: false, error: 'Ya hay una invitacion o solicitud pendiente con este jugador' });
        }

        const membresia = await new EquipoMembresia({
            equipo: id,
            usuario: usuarioId,
            deporte: equipo.deporte,
            rol: 'miembro',
            origen: 'invitacion',
            estado: 'pendiente',
            mensaje,
        }).save();

        return res.status(201).json({ ok: true, membresia });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const obtenerMisSolicitudes = async (req = request, res = response) => {
    try {
        const membresias = await EquipoMembresia.find({
            usuario: req.usuarioAuth._id,
            estado: 'pendiente',
        }).populate({
            path: 'equipo',
            select: 'nombre nombreArchivoImagen deporte',
            populate: [{ path: 'deporte', select: 'nombre' }],
        });

        return res.status(200).json({ ok: true, solicitudes: membresias });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const obtenerSolicitudesDeEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const equipo = await Equipos.findById(id);

        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (!puedeGestionarEquipo({ capitanId: equipo.capitan, usuarioId: req.usuarioAuth._id, esAdmin: esAdmin(req) })) {
            return res.status(403).json({ ok: false, error: 'Solo el capitan puede ver las solicitudes del equipo' });
        }

        const solicitudes = await EquipoMembresia.find({ equipo: id, origen: 'solicitud', estado: 'pendiente' })
            .populate(ROSTER_POPULATE);

        return res.status(200).json({ ok: true, solicitudes });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const responderMembresia = async (req = request, res = response) => {
    try {
        const { id, membresiaId } = req.params;
        const { aceptar } = req.body;

        const equipo = await Equipos.findById(id);
        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        const membresia = await EquipoMembresia.findOne({ _id: membresiaId, equipo: id });
        if (!membresia) {
            return res.status(404).json({ ok: false, error: 'Solicitud no encontrada' });
        }

        if (membresia.estado !== 'pendiente') {
            return res.status(400).json({ ok: false, error: 'Esta solicitud ya fue respondida' });
        }

        const autorizado = puedeResponderMembresia({
            origen: membresia.origen,
            capitanId: equipo.capitan,
            membresiaUsuarioId: membresia.usuario,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
        });

        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'No podes responder esta solicitud' });
        }

        if (!aceptar) {
            membresia.estado = 'rechazada';
            await membresia.save();
            return res.status(200).json({ ok: true, membresia });
        }

        if (await tieneEquipoAceptadoEnDeporte(membresia.usuario, membresia.deporte)) {
            return res.status(400).json({
                ok: false,
                error: 'Ese jugador ya tiene un equipo de este deporte',
            });
        }

        membresia.estado = 'aceptada';
        await membresia.save();

        return res.status(200).json({ ok: true, membresia });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const salirDelEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuarioAuth._id;

        const membresia = await EquipoMembresia.findOne({ equipo: id, usuario: usuarioId, estado: 'aceptada' });
        if (!membresia) {
            return res.status(404).json({ ok: false, error: 'No pertenecés a este equipo' });
        }

        if (!puedeSalirDelEquipo({ membresiaRol: membresia.rol })) {
            return res.status(400).json({
                ok: false,
                error: 'El capitan no puede salir del equipo; borralo si ya no lo queres usar',
            });
        }

        await membresia.deleteOne();

        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

// V4 (docs/equipos-social-fase1.md, hallazgo del diseño 32d): el usuario que
// envio una solicitud ('origen: solicitud') puede retirarla mientras siga
// pendiente. No usa el mismo endpoint que expulsarMiembro porque ahi el
// autorizado es el capitan sobre una membresia 'aceptada' -- aca es el
// propio usuario sobre su propia membresia 'pendiente'.
const cancelarSolicitud = async (req = request, res = response) => {
    try {
        const { membresiaId } = req.params;
        const usuarioId = req.usuarioAuth._id;

        const membresia = await EquipoMembresia.findOne({
            _id: membresiaId,
            usuario: usuarioId,
            origen: 'solicitud',
            estado: 'pendiente',
        });

        if (!membresia) {
            return res.status(404).json({ ok: false, error: 'Solicitud no encontrada' });
        }

        await membresia.deleteOne();

        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const expulsarMiembro = async (req = request, res = response) => {
    try {
        const { id, membresiaId } = req.params;

        const equipo = await Equipos.findById(id);
        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        const membresia = await EquipoMembresia.findOne({ _id: membresiaId, equipo: id, estado: 'aceptada' });
        if (!membresia) {
            return res.status(404).json({ ok: false, error: 'Miembro no encontrado' });
        }

        const autorizado = puedeExpulsarMiembro({
            capitanId: equipo.capitan,
            usuarioId: req.usuarioAuth._id,
            esAdmin: esAdmin(req),
            membresiaRol: membresia.rol,
        });

        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'No podes expulsar a este jugador' });
        }

        await membresia.deleteOne();

        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

module.exports = {
    crearEquipo,
    obtenerEquipos,
    obtenerEquipo,
    actualizarEquipo,
    eliminarEquipo,
    obtenerMisEquipos,
    solicitarUnirseEquipo,
    invitarJugador,
    obtenerMisSolicitudes,
    obtenerSolicitudesDeEquipo,
    responderMembresia,
    salirDelEquipo,
    expulsarMiembro,
    cancelarSolicitud,
};
