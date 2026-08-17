const test = require('node:test');
const assert = require('node:assert/strict');
const Usuario = require('../models/usuarios');
const { obtenerCapitanId, obtenerDeporteReservaId, esMismoDeporte } = require('../controllers/retos.controller');

const {
    puedenRetarse,
    puedeResponderReto,
    puedeGestionarReto,
} = require('../helpers/retos-social');

test('puedenRetarse: mismo deporte y equipos distintos, si; mismo equipo o deportes distintos, no', () => {
    assert.equal(
        puedenRetarse({
            equipoRetadorId: 'e1',
            equipoRetadoId: 'e2',
            deporteRetadorId: 'd1',
            deporteRetadoId: 'd1',
        }),
        true,
    );
    assert.equal(
        puedenRetarse({
            equipoRetadorId: 'e1',
            equipoRetadoId: 'e1',
            deporteRetadorId: 'd1',
            deporteRetadoId: 'd1',
        }),
        false,
        'un equipo no puede retarse a si mismo',
    );
    assert.equal(
        puedenRetarse({
            equipoRetadorId: 'e1',
            equipoRetadoId: 'e2',
            deporteRetadorId: 'd1',
            deporteRetadoId: 'd2',
        }),
        false,
        'deportes distintos no tienen partido posible',
    );
});

test('puedeResponderReto: el capitan del equipo retado puede, el retador no', () => {
    assert.equal(
        puedeResponderReto({ capitanRetadoId: 'c2', usuarioId: 'c2', esAdmin: false }),
        true,
    );
    assert.equal(
        puedeResponderReto({ capitanRetadoId: 'c2', usuarioId: 'c1', esAdmin: false }),
        false,
        'el capitan retador no puede autoaceptar su propio reto',
    );
});

test('puedeResponderReto: un admin siempre puede', () => {
    assert.equal(
        puedeResponderReto({ capitanRetadoId: 'c2', usuarioId: 'admin1', esAdmin: true }),
        true,
    );
});

test('puedeGestionarReto: cualquiera de los 2 capitanes puede, un tercero no', () => {
    assert.equal(
        puedeGestionarReto({ capitanRetadorId: 'c1', capitanRetadoId: 'c2', usuarioId: 'c1', esAdmin: false }),
        true,
    );
    assert.equal(
        puedeGestionarReto({ capitanRetadorId: 'c1', capitanRetadoId: 'c2', usuarioId: 'c2', esAdmin: false }),
        true,
    );
    assert.equal(
        puedeGestionarReto({ capitanRetadorId: 'c1', capitanRetadoId: 'c2', usuarioId: 'u3', esAdmin: false }),
        false,
        'un jugador ajeno a los 2 equipos no puede coordinar ni cancelar el reto',
    );
});

test('puedeGestionarReto: un admin siempre puede', () => {
    assert.equal(
        puedeGestionarReto({ capitanRetadorId: 'c1', capitanRetadoId: 'c2', usuarioId: 'admin1', esAdmin: true }),
        true,
    );
});

test('obtenerCapitanId: extrae el _id real cuando el capitan viene poblado', () => {
    const capitan = new Usuario({ nombre: 'Test', apellido: 'User', correo: 'a@a.com' });
    const uid = String(capitan._id);

    assert.equal(
        puedeGestionarReto({
            capitanRetadorId: capitan,
            capitanRetadoId: 'c2',
            usuarioId: uid,
            esAdmin: false,
        }),
        false,
        'String() sobre el documento poblado no coincide con su ObjectId',
    );

    assert.equal(String(obtenerCapitanId({ capitan })), uid);
    assert.equal(
        puedeGestionarReto({
            capitanRetadorId: obtenerCapitanId({ capitan }),
            capitanRetadoId: 'c2',
            usuarioId: uid,
            esAdmin: false,
        }),
        true,
    );
});

test('obtenerDeporteReservaId: usa el deporte de la cancha si la reserva antigua no lo tiene', () => {
    assert.equal(
        obtenerDeporteReservaId({ deporte: 'basket-reserva', cancha: { deporte: 'basket-cancha' } }),
        'basket-reserva',
    );
    assert.equal(
        obtenerDeporteReservaId({ cancha: { deporte: 'basket-cancha' } }),
        'basket-cancha',
    );
});

test('esMismoDeporte: compara por nombre normalizado si faltan ids legacy', () => {
    assert.equal(
        esMismoDeporte({
            reserva: { cancha: { tipoDeporte: 'Basketball' } },
            reto: { deporte: { nombre: 'Baloncesto' } },
        }),
        true,
    );
    assert.equal(
        esMismoDeporte({
            reserva: { cancha: { tipoDeporte: 'Basketball' } },
            reto: { deporte: { nombre: 'Futbol 5' } },
        }),
        false,
    );
});
