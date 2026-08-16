const { Schema, model } = require('mongoose');

const TIPOS_REPORTE = ['usuario', 'equipo'];
const MOTIVOS_REPORTE = [
    'comportamiento_inapropiado',
    'spam',
    'informacion_falsa',
    'otro',
];
const ESTADOS_REPORTE = ['pendiente', 'revisado'];

// Fase 3 (docs/equipos-social-plan.md): "reportar/bloquear va en la misma
// fase que la busqueda publica, no despues" -- moderacion minima: guarda el
// reporte para revision, no arbitra ni oculta nada automaticamente (eso
// queda para una fase de moderacion mas seria si hace falta).
const ReporteSchema = new Schema({
    reportante: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    tipo: {
        type: String,
        enum: TIPOS_REPORTE,
        required: true,
    },
    // Referencia generica a Usuario o Equipo segun 'tipo' -- no se usa ref
    // fijo por ese motivo (misma tecnica que otros campos polimorficos del
    // repo, ej. SolicitudEquipo en el plan original).
    objetivoId: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    motivo: {
        type: String,
        enum: MOTIVOS_REPORTE,
        required: true,
    },
    mensaje: {
        type: String,
        trim: true,
        default: '',
    },
    estado: {
        type: String,
        enum: ESTADOS_REPORTE,
        default: 'pendiente',
    },
}, { timestamps: true });

ReporteSchema.index({ estado: 1, createdAt: -1 });
ReporteSchema.index({ tipo: 1, objetivoId: 1 });

ReporteSchema.methods.toJSON = function () {
    const { __v, _id, ...reporte } = this.toObject();
    reporte.uid = _id;
    return reporte;
};

module.exports = {
    Reporte: model('Reporte', ReporteSchema),
    TIPOS_REPORTE,
    MOTIVOS_REPORTE,
    ESTADOS_REPORTE,
};
