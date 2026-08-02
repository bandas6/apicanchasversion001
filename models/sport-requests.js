const { Schema, model } = require('mongoose');

const SportRequestSchema = new Schema({
    nombre: {
        type: String,
        trim: true,
        required: true,
    },
    descripcion: {
        type: String,
        trim: true,
        default: '',
    },
    solicitante: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
        default: null,
    },
    estado: {
        type: String,
        enum: ['pendiente', 'aprobado', 'rechazado'],
        default: 'pendiente',
    },
    deporteCreado: {
        type: Schema.Types.ObjectId,
        ref: 'Deporte',
        default: null,
    },
    revisadoPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null,
    },
    revisadoAt: {
        type: Date,
        default: null,
    },
    respuestaRevision: {
        type: String,
        trim: true,
        default: '',
    },
}, {
    timestamps: true,
    collection: 'sport_requests',
});

SportRequestSchema.index({ solicitante: 1, estado: 1 });
SportRequestSchema.index({ estado: 1, createdAt: -1 });

SportRequestSchema.methods.toJSON = function () {
    const { __v, _id, ...solicitud } = this.toObject();
    solicitud.uid = _id;
    return solicitud;
};

module.exports = model('SportRequest', SportRequestSchema);
