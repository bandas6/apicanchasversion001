const test = require('node:test');
const assert = require('node:assert/strict');

const {
    puedeGestionarEquipo,
    puedeResponderMembresia,
    puedeExpulsarMiembro,
    puedeSalirDelEquipo,
    puedeParticiparEnEquipos,
} = require('../helpers/equipos-social');

test('puedeGestionarEquipo: el capitan puede, otro jugador no', () => {
    assert.equal(
        puedeGestionarEquipo({ capitanId: 'c1', usuarioId: 'c1', esAdmin: false }),
        true,
    );
    assert.equal(
        puedeGestionarEquipo({ capitanId: 'c1', usuarioId: 'u2', esAdmin: false }),
        false,
    );
});

test('puedeGestionarEquipo: un admin puede aunque no sea el capitan', () => {
    assert.equal(
        puedeGestionarEquipo({ capitanId: 'c1', usuarioId: 'admin1', esAdmin: true }),
        true,
    );
});

test('puedeResponderMembresia: una solicitud del jugador la responde el capitan', () => {
    assert.equal(
        puedeResponderMembresia({
            origen: 'solicitud',
            capitanId: 'c1',
            membresiaUsuarioId: 'u2',
            usuarioId: 'c1',
            esAdmin: false,
        }),
        true,
    );
    assert.equal(
        puedeResponderMembresia({
            origen: 'solicitud',
            capitanId: 'c1',
            membresiaUsuarioId: 'u2',
            usuarioId: 'u2',
            esAdmin: false,
        }),
        false,
        'el propio jugador no puede aceptar su solicitud',
    );
});

test('puedeResponderMembresia: una invitacion del capitan la responde el jugador invitado', () => {
    assert.equal(
        puedeResponderMembresia({
            origen: 'invitacion',
            capitanId: 'c1',
            membresiaUsuarioId: 'u2',
            usuarioId: 'u2',
            esAdmin: false,
        }),
        true,
    );
    assert.equal(
        puedeResponderMembresia({
            origen: 'invitacion',
            capitanId: 'c1',
            membresiaUsuarioId: 'u2',
            usuarioId: 'c1',
            esAdmin: false,
        }),
        false,
        'el capitan no puede autoaceptar su propia invitacion',
    );
});

test('puedeResponderMembresia: un admin siempre puede', () => {
    assert.equal(
        puedeResponderMembresia({
            origen: 'solicitud',
            capitanId: 'c1',
            membresiaUsuarioId: 'u2',
            usuarioId: 'admin1',
            esAdmin: true,
        }),
        true,
    );
});

test('puedeExpulsarMiembro: el capitan puede expulsar a un miembro, nunca a otro capitan', () => {
    assert.equal(
        puedeExpulsarMiembro({ capitanId: 'c1', usuarioId: 'c1', esAdmin: false, membresiaRol: 'miembro' }),
        true,
    );
    assert.equal(
        puedeExpulsarMiembro({ capitanId: 'c1', usuarioId: 'c1', esAdmin: false, membresiaRol: 'capitan' }),
        false,
        'ni el propio capitan puede expulsarse a si mismo por esta via',
    );
});

test('puedeExpulsarMiembro: un jugador que no es capitan no puede expulsar', () => {
    assert.equal(
        puedeExpulsarMiembro({ capitanId: 'c1', usuarioId: 'u2', esAdmin: false, membresiaRol: 'miembro' }),
        false,
    );
});

test('puedeSalirDelEquipo: cualquier miembro puede salir, el capitan no', () => {
    assert.equal(puedeSalirDelEquipo({ membresiaRol: 'miembro' }), true);
    assert.equal(puedeSalirDelEquipo({ membresiaRol: 'capitan' }), false);
});

test('puedeParticiparEnEquipos: solo el rol USER puede crear/unirse/ser invitado', () => {
    assert.equal(puedeParticiparEnEquipos({ rol: 'USER' }), true);
    assert.equal(puedeParticiparEnEquipos({ rol: 'ADMIN' }), false);
    assert.equal(puedeParticiparEnEquipos({ rol: 'DEV' }), false);
    assert.equal(puedeParticiparEnEquipos({ rol: undefined }), false);
});
