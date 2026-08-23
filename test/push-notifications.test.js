const test = require('node:test');
const assert = require('node:assert/strict');

const {
    collectUserTokens,
    resolveInvalidTokens,
    normalizeDataPayload,
} = require('../helpers/push-sender');

const {
    formatDiaReserva,
    buildReservationPushContent,
} = require('../helpers/push-reservas');

test('collectUserTokens limpia y deduplica los tokens guardados', () => {
    const tokens = collectUserTokens({
        devicePushTokens: [
            { token: '  abc  ', platform: 'android' },
            { token: 'abc', platform: 'ios' },
            { token: '', platform: 'android' },
            { token: null },
            { token: 'def' },
        ],
    });

    assert.deepEqual(tokens, ['abc', 'def']);
});

test('collectUserTokens tolera un usuario sin tokens', () => {
    assert.deepEqual(collectUserTokens(null), []);
    assert.deepEqual(collectUserTokens({}), []);
});

test('resolveInvalidTokens solo devuelve los tokens que FCM da por muertos', () => {
    const tokens = ['vivo', 'desinstalado', 'fallo-temporal'];
    const responses = [
        { success: true },
        {
            success: false,
            error: { code: 'messaging/registration-token-not-registered' },
        },
        // Un error transitorio no habilita a borrar el token: el dispositivo
        // sigue existiendo y el proximo envio puede funcionar.
        { success: false, error: { code: 'messaging/server-unavailable' } },
    ];

    assert.deepEqual(resolveInvalidTokens(tokens, responses), ['desinstalado']);
});

test('resolveInvalidTokens lee tambien el code anidado en errorInfo', () => {
    const invalid = resolveInvalidTokens(
        ['t1'],
        [
            {
                success: false,
                error: { errorInfo: { code: 'messaging/invalid-registration-token' } },
            },
        ],
    );

    assert.deepEqual(invalid, ['t1']);
});

test('normalizeDataPayload convierte todo a string y descarta vacios', () => {
    // FCM rechaza el envio entero si un valor de `data` no es string.
    const payload = normalizeDataPayload({
        reservaId: 123,
        estado: 'confirmada',
        extra: undefined,
        otro: null,
    });

    assert.deepEqual(payload, { reservaId: '123', estado: 'confirmada' });
});

test('formatDiaReserva lee el dia en UTC, no en la zona del servidor', () => {
    // Las reservas se guardan como medianoche UTC del dia pretendido. Leerlas
    // con getters locales en un servidor por detras de UTC devolveria el dia
    // anterior, y el aviso nombraria un dia equivocado.
    assert.equal(formatDiaReserva(new Date('2026-08-20T00:00:00.000Z')), 'jueves');
    assert.equal(formatDiaReserva(new Date('2026-08-23T00:00:00.000Z')), 'domingo');
});

test('formatDiaReserva devuelve vacio ante una fecha invalida', () => {
    assert.equal(formatDiaReserva(null), '');
    assert.equal(formatDiaReserva(new Date('no-es-fecha')), '');
});

test('buildReservationPushContent nombra la cancha y el turno', () => {
    const contenido = buildReservationPushContent(
        {
            cancha: { nombre: 'Cancha 1' },
            fecha: new Date('2026-08-20T00:00:00.000Z'),
            horaInicio: '19:00',
        },
        'confirmada',
    );

    assert.equal(contenido.title, 'Reserva confirmada');
    assert.equal(
        contenido.body,
        'Tu reserva en Cancha 1 del jueves 19:00 fue confirmada.',
    );
});

test('buildReservationPushContent aguanta una reserva sin datos poblados', () => {
    const contenido = buildReservationPushContent(
        { cancha: '650000000000000000000000' },
        'rechazada',
    );

    assert.equal(contenido.title, 'Solicitud rechazada');
    assert.equal(contenido.body, 'Tu solicitud en tu cancha fue rechazada.');
});

test('buildReservationPushContent no interrumpe por estados sin novedad', () => {
    // `pendiente` es la reserva que el usuario acaba de crear: no hay nada que
    // contarle todavia.
    assert.equal(buildReservationPushContent({}, 'pendiente'), null);
    assert.equal(buildReservationPushContent({}, ''), null);
});

test('buildReservationPushContent cubre los cierres operativos', () => {
    const estados = [
        'completada',
        'no_show_usuario',
        'cancelada_tardia_usuario',
        'cancelada_por_complejo',
        'incidencia',
    ];

    for (const estado of estados) {
        const contenido = buildReservationPushContent(
            { cancha: { nombre: 'Cancha 2' } },
            estado,
        );
        assert.ok(contenido, `${estado} deberia generar un aviso`);
        assert.ok(contenido.title.length > 0);
        assert.ok(contenido.body.includes('Cancha 2'));
    }
});
