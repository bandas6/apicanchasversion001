const { enviarPushAUsuario } = require('./push-sender');

/// Push del modulo social de equipos.
///
/// Punto 5.3 del checklist 2026-09-02: cuando alguien pedia entrar a un
/// equipo, el capitan no se enteraba por ningun lado — `equipos.controller.js`
/// no tenia una sola llamada a push, a diferencia de `reservas.controller.js`.
/// La cadena de envio ya existia y estaba probada (`push-sender.js`), asi que
/// esto es conectar un caso mas, no infraestructura nueva.
///
/// Mismo criterio que `push-reservas.js` en dos cosas:
/// - Los textos siguen a los del aviso in-app; si la push dice una cosa y la
///   bandeja otra, el usuario cree que son dos eventos distintos.
/// - El bloque `data` lleva `{tipo, entityId}`, las claves que la app resuelve
///   en `resolveNotificationDestination` para navegar al tocar la push.

const nombreDe = (usuario, fallback = 'Alguien') => {
    if (!usuario || typeof usuario === 'string') return fallback;
    const nombre = String(usuario.nombre || '').trim();
    const apellido = String(usuario.apellido || '').trim();
    const completo = [nombre, apellido].filter(Boolean).join(' ');
    return completo || fallback;
};

/**
 * Avisa al capitan que alguien pidio entrar a su equipo.
 *
 * Nunca lanza: un fallo de push no puede tumbar la solicitud, que ya quedo
 * guardada. Devuelve el resultado para que el llamador lo registre si quiere.
 */
const notificarSolicitudDeUnion = async ({ equipo, solicitante, membresiaId }) => {
    const capitanId = equipo?.capitan?._id || equipo?.capitan;
    if (!capitanId) {
        console.warn('[push] Equipo sin capitan, no se notifica la solicitud');
        return { ok: false, reason: 'sin_capitan' };
    }

    const equipoNombre = String(equipo?.nombre || '').trim() || 'tu equipo';
    const quien = nombreDe(solicitante);

    const resultado = await enviarPushAUsuario(capitanId, {
        title: 'Nueva solicitud',
        body: `${quien} quiere entrar a ${equipoNombre}.`,
        data: {
            tipo: 'equipo',
            entityId: String(membresiaId || ''),
            estado: 'solicitud_pendiente',
        },
    });

    // Mismo motivo que en push-reservas: ante una push que no llega, un log
    // vacio no distingue "no se ejecuto", "faltan credenciales" y "el usuario
    // no tiene dispositivos registrados".
    const detalle = resultado.ok
        ? `enviados=${resultado.sent} fallidos=${resultado.failed ?? 0}`
        : `motivo=${resultado.reason}`;
    console.log(`[push] Solicitud de union -> ${detalle}`);

    return resultado;
};

module.exports = {
    nombreDe,
    notificarSolicitudDeUnion,
};
