const { Schema, model } = require('mongoose');

// Fase 5 (docs/equipos-social-plan.md en canchas-app-flutter): doble
// confirmacion de resultado. Decision fundacional 3 del plan: un resultado
// en disputa (los capitanes reportan marcadores distintos) no se arbitra
// en v1 -- el reto queda "en_disputa" y no puntua, sin resolucion manual
// ni automatica. No hay UI de arbitraje que construir, es un estado
// terminal como cualquier otro.
//
// Cada capitan reporta el marcador completo (goles del equipo retador y
// goles del equipo retado, SIEMPRE en ese orden fijo) en vez de "mis
// goles"/"goles del rival" -- comparar 2 reportes en el mismo marco de
// referencia es una comparacion directa; comparar "propios/rival" de cada
// capitan exige invertir uno de los 2 antes de comparar, mas superficie
// para un bug de signo.
const ESTADOS_RESULTADO = ['pendiente', 'confirmado', 'en_disputa'];

const ReporteSchema = new Schema({
    golesRetador: { type: Number, default: null, min: 0 },
    golesRetado: { type: Number, default: null, min: 0 },
    reportadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    reportadoEn: { type: Date, default: null },
}, { _id: false });

const ResultadoRetoSchema = new Schema({
    // unique: nunca hay mas de un ResultadoReto por Reto -- se upsertea el
    // mismo documento con cada reporte, no se crea uno nuevo por capitan.
    reto: {
        type: Schema.Types.ObjectId,
        ref: 'Reto',
        required: true,
        unique: true,
        index: true,
    },
    reporteRetador: { type: ReporteSchema, default: () => ({}) },
    reporteRetado: { type: ReporteSchema, default: () => ({}) },
    estado: {
        type: String,
        enum: ESTADOS_RESULTADO,
        default: 'pendiente',
    },
}, { timestamps: true });

ResultadoRetoSchema.methods.toJSON = function () {
    const { __v, _id, ...resultado } = this.toObject();
    resultado.uid = _id;
    return resultado;
};

module.exports = {
    ResultadoReto: model('ResultadoReto', ResultadoRetoSchema),
    ESTADOS_RESULTADO,
};
