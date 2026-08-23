const Usuarios = require('../models/usuarios');

/// Capa de entrega de notificaciones push (FCM).
///
/// Hasta ahora el ecosistema tenia todo menos esto: la app registra su token
/// de dispositivo (`POST /usuarios/me/push-token`) y el backend lo guarda en
/// `usuario.devicePushTokens`, pero nadie enviaba nada. El resultado era que
/// un aviso importante —"tu reserva fue confirmada"— solo se veia si el
/// usuario abria la app por su cuenta.
///
/// Diseño deliberado: si no hay credenciales de Firebase configuradas, este
/// modulo NO explota ni tumba el request que lo llamo — registra una vez que
/// esta desactivado y devuelve un resultado con el motivo. Asi el backend
/// sigue corriendo igual en local, en tests y en cualquier entorno donde
/// todavia no se cargaron las credenciales, que es exactamente el estado
/// actual del proyecto.

// Codigos que FCM devuelve cuando un token ya no sirve (app desinstalada,
// token rotado, dispositivo borrado). Hay que dejar de guardarlos: si no, la
// lista de tokens del usuario crece para siempre con basura y cada envio
// desperdicia cuota reintentando destinos muertos.
const INVALID_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
]);

let cachedMessaging;
let messagingResolved = false;
let missingConfigLogged = false;

/**
 * Lee las credenciales de servicio desde el entorno.
 *
 * Se aceptan dos formas porque los hostings las exponen distinto:
 * - `FIREBASE_SERVICE_ACCOUNT`: el JSON completo en una variable (lo comodo en
 *   Render/Heroku, que no dejan subir archivos sueltos).
 * - `GOOGLE_APPLICATION_CREDENTIALS`: ruta a un archivo, el default de las
 *   librerias de Google.
 */
const readServiceAccount = () => {
    const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error(
            '[push] FIREBASE_SERVICE_ACCOUNT no es un JSON valido, se ignora:',
            error.message,
        );
        return null;
    }
};

/**
 * Devuelve el cliente de mensajeria, o `null` si el push no esta configurado.
 * Se resuelve una sola vez y se cachea (incluido el caso `null`) para no
 * reintentar la inicializacion en cada envio.
 */
const getMessaging = () => {
    if (messagingResolved) return cachedMessaging;
    messagingResolved = true;

    const serviceAccount = readServiceAccount();
    const hasDefaultCredentials = Boolean(
        String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim(),
    );

    if (!serviceAccount && !hasDefaultCredentials) {
        cachedMessaging = null;
        return cachedMessaging;
    }

    try {
        // `require` diferido a proposito: si la dependencia no esta instalada
        // en un entorno, el resto del backend tiene que seguir funcionando.
        const admin = require('firebase-admin');

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: serviceAccount
                    ? admin.credential.cert(serviceAccount)
                    : admin.credential.applicationDefault(),
            });
        }

        cachedMessaging = admin.messaging();
    } catch (error) {
        console.error(
            '[push] No fue posible inicializar firebase-admin:',
            error.message,
        );
        cachedMessaging = null;
    }

    return cachedMessaging;
};

/** Normaliza y deduplica los tokens guardados de un usuario. */
const collectUserTokens = (usuario) => {
    const tokens = (usuario?.devicePushTokens || [])
        .map((item) => String(item?.token || '').trim())
        .filter((token) => token.length > 0);

    return [...new Set(tokens)];
};

/**
 * Dada la lista de tokens a los que se envio y la respuesta de FCM, decide
 * cuales hay que borrar. Se separa de la parte de I/O para poder testearla.
 */
const resolveInvalidTokens = (tokens, responses) => {
    if (!Array.isArray(tokens) || !Array.isArray(responses)) return [];

    return tokens.filter((token, index) => {
        const result = responses[index];
        if (!result || result.success) return false;

        const code = result.error?.code || result.error?.errorInfo?.code || '';
        return INVALID_TOKEN_ERROR_CODES.has(code);
    });
};

/**
 * FCM exige que todos los valores de `data` sean strings: un numero o un
 * `null` colado ahi hace fallar el envio entero con `invalid-argument`.
 */
const normalizeDataPayload = (data = {}) => {
    return Object.entries(data).reduce((acc, [key, value]) => {
        if (value === undefined || value === null) return acc;
        acc[key] = String(value);
        return acc;
    }, {});
};

const removeTokensFromUsuario = async (usuarioId, tokensToRemove) => {
    if (!tokensToRemove.length) return;

    await Usuarios.updateOne(
        { _id: usuarioId },
        { $pull: { devicePushTokens: { token: { $in: tokensToRemove } } } },
    );
};

/**
 * Envia una push a todos los dispositivos registrados de un usuario.
 *
 * Nunca lanza: los llamadores son handlers de reservas y un fallo de entrega
 * no puede hacer fallar la operacion de negocio que ya se completo (confirmar
 * una reserva tiene que funcionar aunque Firebase este caido).
 */
const enviarPushAUsuario = async (usuarioId, { title, body, data = {} } = {}) => {
    try {
        const messaging = getMessaging();
        if (!messaging) {
            if (!missingConfigLogged) {
                missingConfigLogged = true;
                console.warn(
                    '[push] Envio desactivado: falta FIREBASE_SERVICE_ACCOUNT o '
                    + 'GOOGLE_APPLICATION_CREDENTIALS. Los avisos solo se veran al abrir la app.',
                );
            }
            return { ok: false, reason: 'not_configured', sent: 0 };
        }

        const usuario = await Usuarios.findById(usuarioId).select('devicePushTokens');
        const tokens = collectUserTokens(usuario);
        if (!tokens.length) {
            return { ok: false, reason: 'no_tokens', sent: 0 };
        }

        const response = await messaging.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: normalizeDataPayload(data),
        });

        const invalidTokens = resolveInvalidTokens(tokens, response.responses);
        await removeTokensFromUsuario(usuarioId, invalidTokens);

        return {
            ok: true,
            sent: response.successCount || 0,
            failed: response.failureCount || 0,
            removedTokens: invalidTokens.length,
        };
    } catch (error) {
        // Se traga el error a proposito (ver doc de la funcion), pero se
        // registra para poder diagnosticar.
        console.error('[push] Error enviando notificacion:', error.message);
        return { ok: false, reason: 'error', error: error.message, sent: 0 };
    }
};

/** Solo para tests: vuelve a leer la configuracion en el proximo envio. */
const resetPushSenderCacheForTests = () => {
    cachedMessaging = undefined;
    messagingResolved = false;
    missingConfigLogged = false;
};

module.exports = {
    INVALID_TOKEN_ERROR_CODES,
    collectUserTokens,
    resolveInvalidTokens,
    normalizeDataPayload,
    enviarPushAUsuario,
    resetPushSenderCacheForTests,
};
