// Reglas de autorizacion de equipos/membresias, extraidas como funciones
// puras (sin acceso a DB) para poder testearlas sin mongodb-memory-server,
// que este repo no tiene instalado -- mismo criterio que
// helpers/reservation-reputation.js.

/**
 * Quien puede crear/editar/borrar un equipo: su capitan, o un admin.
 */
const puedeGestionarEquipo = ({ capitanId, usuarioId, esAdmin }) => {
    if (esAdmin) return true;
    return String(capitanId) === String(usuarioId);
};

/**
 * Una membresia pendiente la resuelve quien NO la inicio:
 * - 'solicitud' (el jugador pidio unirse) -> la acepta/rechaza el capitan.
 * - 'invitacion' (el capitan invito) -> la acepta/rechaza el jugador
 *   invitado.
 */
const puedeResponderMembresia = ({ origen, capitanId, membresiaUsuarioId, usuarioId, esAdmin }) => {
    if (esAdmin) return true;

    if (origen === 'solicitud') {
        return String(capitanId) === String(usuarioId);
    }

    if (origen === 'invitacion') {
        return String(membresiaUsuarioId) === String(usuarioId);
    }

    return false;
};

/**
 * Expulsar un miembro: solo el capitan (o admin), y nunca al capitan mismo
 * -- para sacarse a si mismo, el capitan borra el equipo (fuera de alcance
 * de Fase 1 tocar aca transferencia de capitania).
 */
const puedeExpulsarMiembro = ({ capitanId, usuarioId, esAdmin, membresiaRol }) => {
    if (membresiaRol === 'capitan') return false;
    if (esAdmin) return true;
    return String(capitanId) === String(usuarioId);
};

/**
 * Salir del equipo: cualquier miembro puede salir de su propia membresia,
 * excepto el capitan (mismo motivo que puedeExpulsarMiembro).
 */
const puedeSalirDelEquipo = ({ membresiaRol }) => membresiaRol !== 'capitan';

/**
 * Equipos/social (entrega 33) es exclusivo del rol jugador (USER): ADMIN/DEV
 * no crean equipos, no piden unirse y no pueden ser invitados. Un solo
 * predicado para las 3 verificaciones (crear equipo, pedir unirse, invitar a
 * alguien) en vez de repetir el string 'USER' suelto en el controller.
 */
const puedeParticiparEnEquipos = ({ rol }) => rol === 'USER';

/**
 * Filtro de la busqueda publica de equipos (GET /equipos) para un usuario
 * con sesion.
 *
 * Dos exclusiones, por dos motivos distintos:
 *
 * - **Bloqueos** (ya existia): no se muestran equipos capitaneados por
 *   alguien con quien hay bloqueo en cualquier direccion.
 * - **Mis propios equipos** (nuevo): la busqueda existe para *encontrar un
 *   equipo al que sumarse*. Un equipo del que ya soy capitan o miembro
 *   aceptado no es un resultado util: la unica accion que ofrece el detalle
 *   ahi es "ya estas adentro". Ocupa lugar en la lista y, desde que Buscar
 *   es una pestaña de primer nivel (40c), es lo primero que ve el usuario.
 *
 * Lo que SI se sigue mostrando es un equipo donde tengo una solicitud o una
 * invitacion pendiente: ahi el detalle si dice algo util ("ya pediste
 * entrar", "te invitaron") y esconderlo dejaria al usuario sin forma de
 * volver a ese equipo desde la busqueda.
 *
 * Se separa del controller como funcion pura para poder testear la forma
 * del query sin mongodb-memory-server, mismo criterio que el resto de este
 * archivo.
 */
const construirFiltroBusquedaEquipos = ({
    base = {},
    viewerId = null,
    idsBloqueados = [],
    idsEquiposPropios = [],
} = {}) => {
    const query = { ...base };

    // Un solo `capitan` en el query: si se asignaran por separado el filtro
    // de bloqueos y el de "no soy yo", el segundo pisaria al primero y los
    // equipos de un usuario bloqueado volverian a aparecer.
    const capitanesExcluidos = [...new Set([
        ...idsBloqueados.map(String),
        ...(viewerId ? [String(viewerId)] : []),
    ])];
    if (capitanesExcluidos.length > 0) {
        query.capitan = { $nin: capitanesExcluidos };
    }

    // El filtro por capitan no alcanza: tambien hay que excluir los equipos
    // donde soy miembro aceptado sin ser el capitan.
    const equiposExcluidos = [...new Set(idsEquiposPropios.map(String))];
    if (equiposExcluidos.length > 0) {
        query._id = { $nin: equiposExcluidos };
    }

    return query;
};

module.exports = {
    puedeGestionarEquipo,
    puedeResponderMembresia,
    puedeExpulsarMiembro,
    puedeSalirDelEquipo,
    puedeParticiparEnEquipos,
    construirFiltroBusquedaEquipos,
};
