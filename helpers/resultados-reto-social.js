// Fase 5: reglas puras (sin DB) para el reporte de resultado de un reto.
// Mismo criterio que helpers/retos-social.js -- testeables con node --test.

/**
 * Que lado del reto es `usuarioId`: 'retador', 'retado', o null si no es
 * capitan de ninguno de los 2. A diferencia de puedeGestionarReto (que
 * tambien deja pasar a un admin, para cancelar/vincular sin importar
 * identidad), reportar un resultado esta atado a QUE lado sos -- un admin
 * no tiene un lado propio, no tiene sentido que reporte en nombre de nadie.
 */
const identificarLadoReportante = ({ capitanRetadorId, capitanRetadoId, usuarioId }) => {
    const uid = String(usuarioId);
    if (String(capitanRetadorId) === uid) return 'retador';
    if (String(capitanRetadoId) === uid) return 'retado';
    return null;
};

/**
 * Decision fundacional 3 del plan: sin arbitraje en v1. 'pendiente' hasta
 * que los 2 capitanes reportaron un marcador completo; 'confirmado' si
 * coinciden (mismo marco de referencia: goles del retador y del retado,
 * nunca "propios/rival"); 'en_disputa' si no coinciden -- estado terminal,
 * no hay resolucion automatica ni manual.
 */
const resolveEstadoResultado = ({ reporteRetador, reporteRetado }) => {
    const retadorCompleto =
        reporteRetador?.golesRetador != null && reporteRetador?.golesRetado != null;
    const retadoCompleto =
        reporteRetado?.golesRetador != null && reporteRetado?.golesRetado != null;

    if (!retadorCompleto || !retadoCompleto) {
        return 'pendiente';
    }

    const coincide =
        reporteRetador.golesRetador === reporteRetado.golesRetador &&
        reporteRetador.golesRetado === reporteRetado.golesRetado;

    return coincide ? 'confirmado' : 'en_disputa';
};

module.exports = {
    identificarLadoReportante,
    resolveEstadoResultado,
};
