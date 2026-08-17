const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveIdsBloqueados, hayBloqueoEntrePar } = require('../helpers/bloqueos');

test('resolveIdsBloqueados: combina ambas direcciones sin duplicados', () => {
    const resultado = resolveIdsBloqueados(['a', 'b'], ['b', 'c']);
    assert.deepEqual([...resultado].sort(), ['a', 'b', 'c']);
});

test('resolveIdsBloqueados: castea a string (ObjectId-like)', () => {
    const objectIdLike = { toString: () => 'x1' };
    const resultado = resolveIdsBloqueados([objectIdLike], []);
    assert.deepEqual(resultado, ['x1']);
});

test('resolveIdsBloqueados: sin bloqueos en ninguna direccion devuelve vacio', () => {
    assert.deepEqual(resolveIdsBloqueados([], []), []);
    assert.deepEqual(resolveIdsBloqueados(), []);
});

test('hayBloqueoEntrePar: detecta el bloqueo sin importar quien bloqueo a quien', () => {
    const a = { _id: 'a1', usuariosBloqueados: ['b1'] };
    const b = { _id: 'b1', usuariosBloqueados: [] };
    assert.equal(hayBloqueoEntrePar(a, b), true, 'a bloqueo a b');
    assert.equal(hayBloqueoEntrePar(b, a), true, 'mismo par, orden invertido');
});

test('hayBloqueoEntrePar: sin bloqueo en ninguna direccion da false', () => {
    const a = { _id: 'a1', usuariosBloqueados: [] };
    const b = { _id: 'b1', usuariosBloqueados: [] };
    assert.equal(hayBloqueoEntrePar(a, b), false);
});
