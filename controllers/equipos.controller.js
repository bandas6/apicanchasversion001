const { request, response } = require('express');
const Equipos = require('../models/equipos');
const { EquipoMembresia } = require('../models/equipo-membresias');
const Deportes = require('../models/deportes');
const Usuarios = require('../models/usuarios');
const { ADMIN_ROLES, tieneRol } = require('../middlewares/validar-roles');
const { uploadBufferToCloudinary } = require('../helpers/cloudinary');
const { CATALOGOS_PERFIL, normalizeCatalogValue } = require('../helpers/profile-catalogs');
const { resolveIdsBloqueados, hayBloqueoEntrePar } = require('../helpers/bloqueos');
const {
    puedeGestionarEquipo,
    puedeResponderMembresia,
    puedeExpulsarMiembro,
    puedeSalirDelEquipo,
    puedeParticiparEnEquipos,
} = require('../helpers/equipos-social');

// Fase 3: zona es opcional -- un equipo creado sin zona simplemente no
// aparece filtrado por zona en la busqueda, no se le inventa un valor.
// Devuelve undefined si vino un valor pero no matchea el catalogo (para que
// el caller responda 400), '' si no vino nada.
const normalizarZonaEquipo = (zona) => {
    const normalizado = String(zona || '').trim();
    if (!normalizado) {
        return '';
    }

    return normalizeCatalogValue(normalizado, CATALOGOS_PERFIL.zonas) || undefined;
};

const buildEquipoEscudoPublicId = (equipoId) =>
    `escudo-${String(equipoId || '').trim()}-${Date.now()}`.replace(/[^a-zA-Z0-9-_]/g, '_');

const ROSTER_POPULATE = { path: 'usuario', select: 'nombre apellido nombre_archivo_imagen' };
// Pantalla 5 (Solicitudes del equipo) muestra 'Identidad validada' -- el
// roster (D4) no, asi que ese select no carga identidadEstado de mas.
const SOLICITUD_POPULATE = {
    path: 'usuario',
    select: 'nombre apellido nombre_archivo_imagen identidadEstado',
};

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
        if (!puedeParticiparEnEquipos({ rol: req.usuarioAuth.rol })) {
            return res.status(403).json({ ok: false, error: 'Solo los usuarios jugadores pueden crear equipos' });
        }

        const { nombre, deporte, descripcion, nombreArchivoImagen, zona } = req.body;
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

        const zonaNormalizada = normalizarZonaEquipo(zona);
        if (zonaNormalizada === undefined) {
            return res.status(400).json({ ok: false, error: 'Debes seleccionar una zona valida' });
        }

        const equipo = new Equipos({
            nombre,
            deporte,
            descripcion,
            nombreArchivoImagen,
            zona: zonaNormalizada,
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
        const { limit = 20, desde = 0, deporte, zona, q } = req.query;
        const query = { estado: true };
        const normalizedQuery = String(q || '').trim();

        if (deporte) {
            query.deporte = deporte;
        }

        if (zona) {
            query.zona = zona;
        }

        if (normalizedQuery) {
            query.nombre = new RegExp(
                normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
        }

        // Fase 3: si hay sesion, excluir equipos capitaneados por alguien con
        // relacion de bloqueo (en cualquier direccion) con quien busca.
        if (req.usuarioAuth) {
            const viewerId = req.usuarioAuth._id;
            const meBloquearon = await Usuarios.find({ usuariosBloqueados: viewerId }).select('_id');
            const idsBloqueo = resolveIdsBloqueados(
                req.usuarioAuth.usuariosBloqueados || [],
                meBloquearon.map((u) => u._id),
            );
            if (idsBloqueo.length > 0) {
                query.capitan = { $nin: idsBloqueo };
            }
        }

        const [total, equipos] = await Promise.all([
            Equipos.countDocuments(query),
            Equipos.find(query)
                .populate('deporte', 'nombre')
                .populate('capitan', 'nombre apellido')
                .skip(Number(desde))
                .limit(Number(limit)),
        ]);

        // E2 (Mis equipos) y ahora tambien la busqueda publica muestran
        // 'Fútbol 5 · 8 jugadores' -- mismo criterio de conteo agrupado que
        // obtenerMisEquipos/obtenerMisSolicitudes, jugadoresCount como campo
        // hermano de cada equipo (no anidado en el doc de Equipo).
        const conteos = await EquipoMembresia.aggregate([
            { $match: { equipo: { $in: equipos.map((e) => e._id) }, estado: 'aceptada' } },
            { $group: { _id: '$equipo', total: { $sum: 1 } } },
        ]);
        const conteoPorEquipo = new Map(conteos.map((item) => [String(item._id), item.total]));

        const equiposConConteo = equipos.map((equipo) => ({
            ...equipo.toJSON(),
            jugadoresCount: conteoPorEquipo.get(String(equipo._id)) || 0,
        }));

        return res.status(200).json({ ok: true, total, equipos: equiposConConteo });
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

        // D4 (Detalle de equipo, plantel): tambien muestra a quien esta
        // invitado pero todavia no acepto ('Invitación enviada'), no solo a
        // los miembros ya aceptados -- por eso el roster no es solo
        // estado:'aceptada'.
        const roster = await EquipoMembresia.find({
            equipo: id,
            $or: [
                { estado: 'aceptada' },
                { origen: 'invitacion', estado: 'pendiente' },
            ],
        })
            .populate(ROSTER_POPULATE)
            .sort({ rol: 1, createdAt: 1 });

        // Fase 3: este endpoint ahora es genuinamente publico/descubrible
        // (busqueda de equipos) -- las invitaciones pendientes solo las ve
        // quien ya pertenece al equipo o un admin. Un visitante que solo
        // esta mirando el equipo desde la busqueda no deberia ver a quien
        // invitaron.
        const usuarioAuthId = req.usuarioAuth ? String(req.usuarioAuth._id) : null;
        const perteneceAlEquipo = usuarioAuthId
            ? roster.some((m) => m.estado === 'aceptada'
                && String(m.usuario?._id || m.usuario) === usuarioAuthId)
            : false;
        const puedeVerPendientes = perteneceAlEquipo || Boolean(req.usuarioAuth && esAdmin(req));

        let rosterVisible = puedeVerPendientes
            ? roster
            : roster.filter((m) => m.estado === 'aceptada');

        // Fase 3 (B3): un visitante que no pertenece al equipo no deberia
        // ver en el plantel a alguien con quien tiene bloqueo reciproco --
        // no aplica si ya sos parte del equipo (ocultarte a un companero de
        // tu propio plantel rompe la funcionalidad basica del equipo, el
        // bloqueo es sobre descubrimiento, no sobre membresias existentes).
        if (usuarioAuthId && !perteneceAlEquipo) {
            const meBloquearon = await Usuarios.find({ usuariosBloqueados: usuarioAuthId }).select('_id');
            const idsBloqueo = resolveIdsBloqueados(
                req.usuarioAuth.usuariosBloqueados || [],
                meBloquearon.map((u) => u._id),
            );
            if (idsBloqueo.length > 0) {
                rosterVisible = rosterVisible.filter((m) =>
                    !idsBloqueo.includes(String(m.usuario?._id || m.usuario)));
            }
        }

        // Fase 3: la busqueda publica necesita saber que boton mostrar en el
        // detalle (Solicitar unirme / Ya sos parte / Solicitud enviada /
        // Ya tenes equipo de este deporte) sin que el frontend tenga que
        // cruzar esto a mano contra Mis equipos/Mis solicitudes.
        let miEstado = null;
        if (usuarioAuthId) {
            const miMembresiaAceptada = roster.find((m) => m.estado === 'aceptada'
                && String(m.usuario?._id || m.usuario) === usuarioAuthId);

            if (miMembresiaAceptada) {
                miEstado = miMembresiaAceptada.rol === 'capitan' ? 'capitan' : 'miembro';
            } else {
                const miPendiente = await EquipoMembresia.findOne({
                    equipo: id,
                    usuario: usuarioAuthId,
                    estado: 'pendiente',
                });

                if (miPendiente) {
                    miEstado = miPendiente.origen === 'invitacion'
                        ? 'invitacion_pendiente'
                        : 'solicitud_pendiente';
                } else if (await tieneEquipoAceptadoEnDeporte(usuarioAuthId, equipo.deporte)) {
                    miEstado = 'ya_tengo_equipo_de_este_deporte';
                } else {
                    miEstado = 'disponible';
                }
            }
        }

        return res.status(200).json({ ok: true, equipo, roster: rosterVisible, miEstado });
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

        const { nombre, descripcion, nombreArchivoImagen, zona } = req.body;
        if (nombre !== undefined) equipo.nombre = nombre;
        if (descripcion !== undefined) equipo.descripcion = descripcion;
        if (nombreArchivoImagen !== undefined) equipo.nombreArchivoImagen = nombreArchivoImagen;
        if (zona !== undefined) {
            const zonaNormalizada = normalizarZonaEquipo(zona);
            if (zonaNormalizada === undefined) {
                return res.status(400).json({ ok: false, error: 'Debes seleccionar una zona valida' });
            }
            equipo.zona = zonaNormalizada;
        }
        await equipo.save();

        return res.status(200).json({ ok: true, equipo });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

const actualizarFotoEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const equipo = await Equipos.findById(id);

        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (!puedeGestionarEquipo({ capitanId: equipo.capitan, usuarioId: req.usuarioAuth._id, esAdmin: esAdmin(req) })) {
            return res.status(403).json({ ok: false, error: 'No podes modificar un equipo que no te pertenece' });
        }

        const fotoFile = req.file;
        if (!fotoFile?.buffer) {
            return res.status(400).json({ ok: false, error: 'Debes adjuntar una imagen' });
        }

        const result = await uploadBufferToCloudinary({
            buffer: fotoFile.buffer,
            folder: 'canchas/equipos/escudo',
            publicId: buildEquipoEscudoPublicId(id),
        });

        equipo.nombreArchivoImagen = result?.secure_url || '';
        await equipo.save();

        return res.status(200).json({ ok: true, equipo, nombreArchivoImagen: equipo.nombreArchivoImagen });
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

        const activas = membresias.filter(
            (membresia) => membresia.equipo && membresia.equipo.estado,
        );

        // E2 (Mis equipos) muestra 'Fútbol 5 · 8 jugadores' -- el conteo del
        // plantel completo de cada equipo, no solo si el propio usuario esta
        // adentro. Un aggregate agrupado evita N consultas sueltas.
        const conteos = await EquipoMembresia.aggregate([
            {
                $match: {
                    equipo: { $in: activas.map((m) => m.equipo._id) },
                    estado: 'aceptada',
                },
            },
            { $group: { _id: '$equipo', total: { $sum: 1 } } },
        ]);
        const conteoPorEquipo = new Map(
            conteos.map((item) => [String(item._id), item.total]),
        );

        const equipos = activas.map((membresia) => ({
            equipo: membresia.equipo,
            rol: membresia.rol,
            jugadoresCount: conteoPorEquipo.get(String(membresia.equipo._id)) || 0,
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

        if (!puedeParticiparEnEquipos({ rol: req.usuarioAuth.rol })) {
            return res.status(403).json({ ok: false, error: 'Solo los usuarios jugadores pueden unirse a un equipo' });
        }

        const equipo = await Equipos.findById(id);
        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (String(equipo.capitan) === String(usuarioId)) {
            return res.status(400).json({ ok: false, error: 'Ya sos el capitan de este equipo' });
        }

        // B3 (docs/equipos-social-fase3.md): si hay bloqueo reciproco con el
        // capitan, no se puede ni pedir entrar -- la hoja de bloqueo promete
        // 'no van a poder mandarse invitaciones o solicitudes'.
        const capitanParaBloqueo = await Usuarios.findById(equipo.capitan).select('usuariosBloqueados');
        if (hayBloqueoEntrePar(req.usuarioAuth, capitanParaBloqueo)) {
            return res.status(400).json({ ok: false, error: 'No podes enviar una solicitud a este equipo' });
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

        // Defensa en profundidad: /jugadores (listado de Invitar jugador) ya
        // filtra por rol:'USER', pero este endpoint recibe el usuarioId
        // directo del body -- sin este chequeo, nada impide invitar a un
        // ADMIN/DEV pasando su id a mano.
        const usuarioObjetivo = await Usuarios.findById(usuarioId).select('rol estado usuariosBloqueados');
        if (!usuarioObjetivo || !usuarioObjetivo.estado || !puedeParticiparEnEquipos({ rol: usuarioObjetivo.rol })) {
            return res.status(400).json({ ok: false, error: 'Solo podes invitar a usuarios jugadores' });
        }

        // B3: bloqueo reciproco entre quien invita (el capitan) y el
        // invitado impide la invitacion, misma promesa que en solicitudes.
        if (hayBloqueoEntrePar(req.usuarioAuth, usuarioObjetivo)) {
            return res.status(400).json({ ok: false, error: 'No podes invitar a este jugador' });
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
        // 'Te esperan' (pantalla 6, M1) son las invitaciones que todavia no
        // respondiste; 'Lo que enviaste' (M2) muestra tus propias solicitudes
        // en sus 3 estados (pendiente/aceptada/rechazada), no solo las
        // pendientes -- por eso el origen decide el filtro de estado, no una
        // condicion unica para toda la consulta. Las membresias 'creacion'
        // (sos capitan) nunca matchean ninguna de las 2 ramas.
        const membresias = await EquipoMembresia.find({
            usuario: req.usuarioAuth._id,
            $or: [
                { origen: 'invitacion', estado: 'pendiente' },
                { origen: 'solicitud' },
            ],
        })
            .sort({ createdAt: -1 })
            .populate({
                path: 'equipo',
                select: 'nombre nombreArchivoImagen deporte capitan',
                populate: [
                    { path: 'deporte', select: 'nombre' },
                    { path: 'capitan', select: 'nombre apellido' },
                ],
            });

        // M1 (pantalla 6) muestra 'Fútbol 7 · 9 jugadores' por invitacion
        // recibida -- jugadoresCount va como campo hermano de 'equipo' en
        // cada solicitud (mismo criterio que obtenerMisEquipos), no
        // mezclado dentro del doc de Equipo.
        const equipoIds = membresias
            .filter((m) => m.equipo)
            .map((m) => m.equipo._id);
        const conteos = await EquipoMembresia.aggregate([
            { $match: { equipo: { $in: equipoIds }, estado: 'aceptada' } },
            { $group: { _id: '$equipo', total: { $sum: 1 } } },
        ]);
        const conteoPorEquipo = new Map(
            conteos.map((item) => [String(item._id), item.total]),
        );

        const solicitudes = membresias.map((membresia) => ({
            ...membresia.toJSON(),
            jugadoresCount: membresia.equipo
                ? conteoPorEquipo.get(String(membresia.equipo._id)) || 0
                : 0,
        }));

        return res.status(200).json({ ok: true, solicitudes });
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
            .populate(SOLICITUD_POPULATE);

        return res.status(200).json({ ok: true, solicitudes });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

// Pantalla 4 (Invitar jugador, I2): la lista de resultados de busqueda tiene
// que distinguir 'ya esta en el equipo' de 'ya tiene invitacion pendiente'
// de 'disponible' -- sin esto el capitan invita al vacio (puede reenviar una
// invitacion que ya mando). Mismo shape que obtenerSolicitudesDeEquipo, pero
// filtrando por el otro origen.
const obtenerInvitacionesDeEquipo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const equipo = await Equipos.findById(id);

        if (!equipo || !equipo.estado) {
            return res.status(404).json({ ok: false, error: 'Equipo no encontrado' });
        }

        if (!puedeGestionarEquipo({ capitanId: equipo.capitan, usuarioId: req.usuarioAuth._id, esAdmin: esAdmin(req) })) {
            return res.status(403).json({ ok: false, error: 'Solo el capitan puede ver las invitaciones del equipo' });
        }

        const invitaciones = await EquipoMembresia.find({ equipo: id, origen: 'invitacion', estado: 'pendiente' })
            .populate(SOLICITUD_POPULATE);

        return res.status(200).json({ ok: true, invitaciones });
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
    actualizarFotoEquipo,
    eliminarEquipo,
    obtenerMisEquipos,
    solicitarUnirseEquipo,
    invitarJugador,
    obtenerMisSolicitudes,
    obtenerSolicitudesDeEquipo,
    obtenerInvitacionesDeEquipo,
    responderMembresia,
    salirDelEquipo,
    expulsarMiembro,
    cancelarSolicitud,
};
