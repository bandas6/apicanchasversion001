const { enviarPushAUsuario } = require('./push-sender');

/// Contenido de las push que dispara el ciclo de vida de una reserva.
///
/// Los textos siguen a los que la app ya muestra como aviso in-app
/// (`booking_notifications_sync_service.dart`) a proposito: si la push dice
/// una cosa y la bandeja de avisos otra, el usuario cree que son dos eventos
/// distintos.

const DIAS_SEMANA = [
    'domingo',
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
];

/**
 * Formatea el dia de una reserva leyendo los componentes UTC.
 *
 * `reserva.fecha` se guarda como medianoche UTC del dia de calendario
 * pretendido, asi que leerla con getters locales en un servidor por detras de
 * UTC devuelve el dia anterior — el mismo cruce que documenta
 * `parseCalendarDate` en reservas.controller.js, solo que en el sentido de
 * lectura.
 */
const formatDiaReserva = (fecha) => {
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return '';
    return DIAS_SEMANA[fecha.getUTCDay()] || '';
};

const resolveNombre = (referencia, fallback) => {
    if (!referencia) return fallback;
    if (typeof referencia === 'string') return fallback;
    return String(referencia.nombre || '').trim() || fallback;
};

/**
 * Arma titulo y cuerpo para un cambio de estado. Devuelve `null` cuando el
 * estado no amerita interrumpir al usuario (por ejemplo `pendiente`: la
 * reserva la acaba de crear el, no hay novedad que contarle).
 */
const buildReservationPushContent = (reserva, estado) => {
    const cancha = resolveNombre(reserva?.cancha, 'tu cancha');
    const dia = formatDiaReserva(reserva?.fecha);
    const hora = String(reserva?.horaInicio || '').trim();
    const cuando = [dia && `del ${dia}`, hora].filter(Boolean).join(' ');
    const referencia = cuando ? `en ${cancha} ${cuando}` : `en ${cancha}`;

    switch (estado) {
        case 'confirmada':
            return {
                title: 'Reserva confirmada',
                body: `Tu reserva ${referencia} fue confirmada.`,
            };
        case 'rechazada':
            return {
                title: 'Solicitud rechazada',
                body: `Tu solicitud ${referencia} fue rechazada.`,
            };
        case 'cancelada_por_complejo':
            return {
                title: 'Reserva cancelada',
                body: `Tu reserva ${referencia} fue cancelada por el complejo.`,
            };
        case 'completada':
            return {
                title: 'Califica tu partido',
                body: `Conta como estuvo tu reserva ${referencia}.`,
            };
        case 'no_show_usuario':
            return {
                title: 'Reserva cerrada',
                body: `Tu reserva ${referencia} quedo registrada como no asistida.`,
            };
        case 'cancelada_tardia_usuario':
            return {
                title: 'Reserva cerrada',
                body: `Tu reserva ${referencia} quedo registrada como cancelacion tardia.`,
            };
        case 'incidencia':
            return {
                title: 'Reserva cerrada',
                body: `Tu reserva ${referencia} quedo cerrada con una incidencia operativa.`,
            };
        default:
            return null;
    }
};

/**
 * Notifica al dueño de la reserva un cambio de estado.
 *
 * No lanza y no se espera su resultado en los handlers: la operacion de
 * negocio (confirmar, rechazar, cerrar) ya se completo antes de llegar aca y
 * no puede fallar porque la entrega de la push falle.
 */
const notificarCambioEstadoReserva = async (reserva, estado) => {
    const contenido = buildReservationPushContent(reserva, estado);
    if (!contenido) return { ok: false, reason: 'estado_sin_aviso' };

    const usuarioId = reserva?.usuario?._id || reserva?.usuario;
    if (!usuarioId) {
        console.warn(`[push] Reserva sin usuario, no se notifica (estado: ${estado})`);
        return { ok: false, reason: 'sin_usuario' };
    }

    const resultado = await enviarPushAUsuario(usuarioId, {
        ...contenido,
        // Mismas claves que ya usa el aviso in-app, para que al tocar la push
        // la app pueda abrir la reserva concreta en vez de la bandeja.
        data: {
            tipo: 'reserva',
            reservaId: String(reserva?._id || reserva?.uid || ''),
            estado,
        },
    });

    // Siempre se registra el desenlace, incluso cuando todo sale bien.
    //
    // Antes esta funcion podia terminar sin escribir una sola linea: el aviso
    // de "faltan credenciales" se emite una unica vez por proceso, y el caso
    // "el usuario no tiene tokens" retornaba mudo. El resultado era que ante
    // una push que no llegaba, un log vacio no distinguia entre "no se ejecuto
    // el codigo", "no hay credenciales" y "el usuario no tiene dispositivos
    // registrados" — tres problemas con soluciones distintas.
    const detalle = resultado.ok
        ? `enviados=${resultado.sent} fallidos=${resultado.failed ?? 0}`
        : `motivo=${resultado.reason}`;
    console.log(`[push] Aviso de reserva (${estado}) -> ${detalle}`);

    return resultado;
};

module.exports = {
    DIAS_SEMANA,
    formatDiaReserva,
    buildReservationPushContent,
    notificarCambioEstadoReserva,
};
