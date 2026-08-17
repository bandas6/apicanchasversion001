// Fase 6 (docs/equipos-social-plan.md en canchas-app-flutter): puntuacion
// visible de un equipo. Formula v1, deliberadamente simple: puntos estilo
// liga (3 al ganar, 1 al empatar, 0 al perder), nada de Elo -- eso es
// ajuste fino para mas adelante si el sistema se usa de verdad.
//
// Se calcula UNA sola vez por reto, en el momento exacto en que
// ResultadoReto pasa a 'confirmado' (ver controllers/resultados-reto.controller.js)
// -- nunca sobre un resultado 'en_disputa' (decision fundacional 3 del
// plan: eso queda "sin puntuar", no hay resolucion que recalcule despues).

const PUNTOS_VICTORIA = 3;
const PUNTOS_EMPATE = 1;
const PUNTOS_DERROTA = 0;

/**
 * Incrementos de puntuacion/record para cada lado de un reto confirmado,
 * a partir del marcador ya coincidente de los 2 capitanes (mismo marco de
 * referencia que ResultadoReto: golesRetador/golesRetado, nunca
 * "propios/rival"). Forma de objeto listo para `$inc` de Mongoose.
 */
const resolveIncrementosPuntuacion = ({ golesRetador, golesRetado }) => {
    if (golesRetador > golesRetado) {
        return {
            retador: { puntuacion: PUNTOS_VICTORIA, victorias: 1, derrotas: 0, empates: 0 },
            retado: { puntuacion: PUNTOS_DERROTA, victorias: 0, derrotas: 1, empates: 0 },
        };
    }
    if (golesRetador < golesRetado) {
        return {
            retador: { puntuacion: PUNTOS_DERROTA, victorias: 0, derrotas: 1, empates: 0 },
            retado: { puntuacion: PUNTOS_VICTORIA, victorias: 1, derrotas: 0, empates: 0 },
        };
    }
    return {
        retador: { puntuacion: PUNTOS_EMPATE, victorias: 0, derrotas: 0, empates: 1 },
        retado: { puntuacion: PUNTOS_EMPATE, victorias: 0, derrotas: 0, empates: 1 },
    };
};

module.exports = {
    PUNTOS_VICTORIA,
    PUNTOS_EMPATE,
    PUNTOS_DERROTA,
    resolveIncrementosPuntuacion,
};
