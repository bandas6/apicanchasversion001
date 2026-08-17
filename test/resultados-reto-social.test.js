const test = require('node:test');
const assert = require('node:assert/strict');

const {
    identificarLadoReportante,
    resolveEstadoResultado,
} = require('../helpers/resultados-reto-social');

test('identificarLadoReportante: devuelve el lado correcto o null si no es ninguno de los 2', () => {
    assert.equal(
        identificarLadoReportante({ capitanRetadorId: 'c1', capitanRetadoId: 'c2', usuarioId: 'c1' }),
        'retador',
    );
    assert.equal(
        identificarLadoReportante({ capitanRetadorId: 'c1', capitanRetadoId: 'c2', usuarioId: 'c2' }),
        'retado',
    );
    assert.equal(
        identificarLadoReportante({ capitanRetadorId: 'c1', capitanRetadoId: 'c2', usuarioId: 'admin1' }),
        null,
        'un admin no tiene un lado propio, no puede reportar en nombre de nadie',
    );
});

test('resolveEstadoResultado: pendiente si falta algun reporte', () => {
    assert.equal(
        resolveEstadoResultado({ reporteRetador: {}, reporteRetado: {} }),
        'pendiente',
    );
    assert.equal(
        resolveEstadoResultado({
            reporteRetador: { golesRetador: 2, golesRetado: 1 },
            reporteRetado: {},
        }),
        'pendiente',
        'con un solo capitan reportando, todavia no hay nada que comparar',
    );
});

test('resolveEstadoResultado: confirmado si los 2 marcadores coinciden', () => {
    assert.equal(
        resolveEstadoResultado({
            reporteRetador: { golesRetador: 2, golesRetado: 1 },
            reporteRetado: { golesRetador: 2, golesRetado: 1 },
        }),
        'confirmado',
    );
});

test('resolveEstadoResultado: en_disputa si los 2 marcadores no coinciden', () => {
    assert.equal(
        resolveEstadoResultado({
            reporteRetador: { golesRetador: 2, golesRetado: 1 },
            reporteRetado: { golesRetador: 1, golesRetado: 1 },
        }),
        'en_disputa',
    );
});

test('resolveEstadoResultado: un 0-0 real no se confunde con "sin reportar" (0 != null)', () => {
    assert.equal(
        resolveEstadoResultado({
            reporteRetador: { golesRetador: 0, golesRetado: 0 },
            reporteRetado: { golesRetador: 0, golesRetado: 0 },
        }),
        'confirmado',
    );
});
