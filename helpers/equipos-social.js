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

module.exports = {
    puedeGestionarEquipo,
    puedeResponderMembresia,
    puedeExpulsarMiembro,
    puedeSalirDelEquipo,
};
