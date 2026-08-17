// Reglas de autorizacion de retos, extraidas como funciones puras (sin
// acceso a DB) para poder testearlas sin mongodb-memory-server -- mismo
// criterio que helpers/equipos-social.js. "Quien puede retar en nombre de
// un equipo" reusa directamente puedeGestionarEquipo (es el mismo capitan-o-
// admin de siempre), no se duplica aca.

/**
 * Dos equipos pueden retarse si son distintos y juegan el mismo deporte --
 * un reto entre equipos de deportes distintos no tiene partido posible.
 */
const puedenRetarse = ({ equipoRetadorId, equipoRetadoId, deporteRetadorId, deporteRetadoId }) => {
    if (String(equipoRetadorId) === String(equipoRetadoId)) return false;
    return String(deporteRetadorId) === String(deporteRetadoId);
};

/**
 * Responder un reto (aceptar/rechazar): solo el capitan del equipo retado
 * (o admin) -- el retador ya expreso su intencion al crearlo, no puede
 * autoaceptarse su propio reto.
 */
const puedeResponderReto = ({ capitanRetadoId, usuarioId, esAdmin }) => {
    if (esAdmin) return true;
    return String(capitanRetadoId) === String(usuarioId);
};

/**
 * Vincular la reserva real o cancelar un reto: cualquiera de los 2
 * capitanes (coordinar la cancha es cosa de ambos lados, no solo de quien
 * reto primero), o admin.
 */
const puedeGestionarReto = ({ capitanRetadorId, capitanRetadoId, usuarioId, esAdmin }) => {
    if (esAdmin) return true;
    const uid = String(usuarioId);
    return String(capitanRetadorId) === uid || String(capitanRetadoId) === uid;
};

module.exports = {
    puedenRetarse,
    puedeResponderReto,
    puedeGestionarReto,
};
