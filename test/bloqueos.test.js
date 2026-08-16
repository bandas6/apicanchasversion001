const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveIdsBloqueados } = require('../helpers/bloqueos');

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
