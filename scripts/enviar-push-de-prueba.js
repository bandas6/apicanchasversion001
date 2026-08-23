require('dotenv').config();
const mongoose = require('mongoose');
const { dbConnection } = require('../database/config');
const Usuarios = require('../models/usuarios');
const {
    collectUserTokens,
    enviarPushATokens,
    enviarPushAUsuario,
} = require('../helpers/push-sender');

const MENSAJE_DE_PRUEBA = {
    title: 'Prueba de notificaciones',
    body: 'Si ves esto, la cadena completa de push esta funcionando.',
    data: { tipo: 'diagnostico' },
};

/// Diagnostico de la cadena de push, de punta a punta y por partes.
///
/// Envia una notificacion de prueba usando el MISMO camino que usa el backend
/// cuando se confirma una reserva (`enviarPushAUsuario`), asi que verifica lo
/// que de verdad va a correr en produccion — no una via alternativa.
///
/// A diferencia de "Enviar mensaje de prueba" de la consola de Firebase, este
/// script tambien comprueba las dos piezas que aquella salteaba: que las
/// credenciales del servidor esten bien cargadas y que el token del usuario
/// haya quedado guardado en la base.
///
/// Uso:
///   node scripts/enviar-push-de-prueba.js user1@user.com
///   node scripts/enviar-push-de-prueba.js --token <TOKEN_FCM>
///
/// El modo `--token` envia a un dispositivo concreto sin tocar la base. Sirve
/// para aislar el problema cuando MongoDB no esta disponible (por ejemplo el
/// `querySrv ECONNREFUSED` de Atlas cuando el DNS local no resuelve registros
/// SRV): si con `--token` llega la notificacion, las credenciales del servidor
/// y la entrega de FCM estan bien, y lo que falla es otra cosa.

const run = async () => {
    const [primerArg, segundoArg] = process.argv.slice(2);
    const modoToken = primerArg === '--token';
    const tokenDirecto = modoToken ? String(segundoArg || '').trim() : '';
    const correo = modoToken ? '' : String(primerArg || '').trim().toLowerCase();

    if (!correo && !tokenDirecto) {
        console.error('Falta el correo del usuario (o un token con --token).');
        console.error('Uso: node scripts/enviar-push-de-prueba.js user1@user.com');
        console.error('     node scripts/enviar-push-de-prueba.js --token <TOKEN_FCM>');
        process.exit(1);
    }

    // Se avisa antes de conectarse a la base: si faltan las credenciales, el
    // envio no va a salir y conviene saberlo de entrada, no despues.
    const tieneCredenciales = Boolean(
        String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim()
        || String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim(),
    );

    console.log('--- Diagnostico de push ---');
    console.log(
        `1. Credenciales de Firebase: ${tieneCredenciales ? 'OK' : 'FALTAN'}`,
    );
    if (!tieneCredenciales) {
        console.log(
            '   Cargá FIREBASE_SERVICE_ACCOUNT en .env (el JSON completo en una',
        );
        console.log('   sola linea) o GOOGLE_APPLICATION_CREDENTIALS con la ruta al archivo.');
    }

    if (tokenDirecto) {
        console.log('2. Modo token directo: no se consulta la base');
        console.log(
            `3. Token: ${tokenDirecto.slice(0, 12)}...${tokenDirecto.slice(-6)}`,
        );
        console.log('4. Enviando...');

        const resultado = await enviarPushATokens([tokenDirecto], MENSAJE_DE_PRUEBA);
        console.log('   Resultado:', JSON.stringify(resultado));
        console.log(
            resultado.ok
                ? '\nEnviado. Revisá el dispositivo (con la app en segundo plano).'
                : '\nNo se envio. Revisá el detalle de arriba.',
        );
        return;
    }

    // Se usa `dbConnection()` y no `mongoose.connect()` directo porque ese
    // helper aplica MONGO_DNS_SERVERS: sin eso, en redes cuyo DNS no resuelve
    // los registros SRV que exige `mongodb+srv://`, el script falla con
    // `querySrv ECONNREFUSED` aunque el servidor si conecte.
    await dbConnection();

    const usuario = await Usuarios.findOne({ correo }).select('correo devicePushTokens');
    if (!usuario) {
        console.log(`2. Usuario: NO ENCONTRADO (${correo})`);
        await mongoose.disconnect();
        process.exit(1);
    }

    const tokens = collectUserTokens(usuario);
    console.log(`2. Usuario: OK (${usuario.correo})`);
    console.log(`3. Tokens de dispositivo guardados: ${tokens.length}`);

    if (!tokens.length) {
        console.log(
            '   Sin tokens: el usuario no inicio sesion en un dispositivo que haya',
        );
        console.log('   podido registrarse contra FCM. Revisá el log de la app.');
    } else {
        tokens.forEach((token, index) => {
            // Solo los extremos: alcanza para reconocer cual dispositivo es sin
            // dejar el token entero en la consola.
            console.log(`   [${index + 1}] ${token.slice(0, 12)}...${token.slice(-6)}`);
        });
    }

    console.log('4. Enviando...');
    const resultado = await enviarPushAUsuario(usuario._id, MENSAJE_DE_PRUEBA);

    console.log('   Resultado:', JSON.stringify(resultado));

    if (resultado.ok && resultado.sent > 0) {
        console.log('\nEnviado. Revisá el dispositivo (con la app en segundo plano).');
    } else if (resultado.reason === 'not_configured') {
        console.log('\nNo se envio: faltan las credenciales de Firebase (paso 1).');
    } else if (resultado.reason === 'no_tokens') {
        console.log('\nNo se envio: el usuario no tiene tokens registrados (paso 3).');
    } else {
        console.log('\nNo se envio. Revisá el detalle del resultado de arriba.');
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
