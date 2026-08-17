const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PUNTOS_VICTORIA,
    PUNTOS_EMPATE,
    PUNTOS_DERROTA,
    resolveIncrementosPuntuacion,
} = require('../helpers/puntuacion-social');

test('resolveIncrementosPuntuacion: gana el retador', () => {
    const incrementos = resolveIncrementosPuntuacion({ golesRetador: 3, golesRetado: 1 });
    assert.deepEqual(incrementos.retador, {
        puntuacion: PUNTOS_VICTORIA,
        victorias: 1,
        derrotas: 0,
        empates: 0,
    });
    assert.deepEqual(incrementos.retado, {
        puntuacion: PUNTOS_DERROTA,
        victorias: 0,
        derrotas: 1,
        empates: 0,
    });
});

test('resolveIncrementosPuntuacion: gana el retado', () => {
    const incrementos = resolveIncrementosPuntuacion({ golesRetador: 1, golesRetado: 4 });
    assert.deepEqual(incrementos.retador, {
        puntuacion: PUNTOS_DERROTA,
        victorias: 0,
        derrotas: 1,
        empates: 0,
    });
    assert.deepEqual(incrementos.retado, {
        puntuacion: PUNTOS_VICTORIA,
        victorias: 1,
        derrotas: 0,
        empates: 0,
    });
});

test('resolveIncrementosPuntuacion: empate reparte el mismo incremento a los 2 lados', () => {
    const incrementos = resolveIncrementosPuntuacion({ golesRetador: 2, golesRetado: 2 });
    assert.deepEqual(incrementos.retador, {
        puntuacion: PUNTOS_EMPATE,
        victorias: 0,
        derrotas: 0,
        empates: 1,
    });
    assert.deepEqual(incrementos.retado, incrementos.retador);
});

test('resolveIncrementosPuntuacion: un 0-0 tambien es empate, no un caso especial', () => {
    const incrementos = resolveIncrementosPuntuacion({ golesRetador: 0, golesRetado: 0 });
    assert.equal(incrementos.retador.empates, 1);
    assert.equal(incrementos.retado.empates, 1);
});
