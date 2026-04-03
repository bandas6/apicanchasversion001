const { Schema, model } = require('mongoose');

const PistasHomeSchema = new Schema({
    texto: {
        type: String,
        trim: true,
        required: [true, 'El texto de la pista es obligatorio'],
    },
    iconoKey: {
        type: String,
        trim: true,
        default: 'explore',
    },
    ctaLabel: {
        type: String,
        trim: true,
        default: '',
    },
    ctaTarget: {
        type: String,
        enum: ['NONE', 'COMPLEJOS', 'RESERVAS', 'COMPLEJO'],
        default: 'NONE',
    },
    scope: {
        type: String,
        enum: ['GLOBAL', 'COMPLEJO'],
        default: 'GLOBAL',
    },
    audiencia: {
        type: String,
        enum: ['ALL', 'AUTHENTICATED', 'USER_ROL', 'ADMIN_ROL', 'ADMIN_GENERAL_ROL'],
        default: 'ALL',
    },
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
        default: null,
    },
    complejoNombre: {
        type: String,
        trim: true,
        default: '',
    },
    activo: {
        type: Boolean,
        default: true,
    },
    aprobada: {
        type: Boolean,
        default: false,
    },
    estadoRevision: {
        type: String,
        enum: ['pendiente', 'aprobada', 'rechazada'],
        default: 'pendiente',
    },
    observacionesRevision: {
        type: String,
        trim: true,
        default: '',
    },
    orden: {
        type: Number,
        default: 0,
    },
    fechaInicio: {
        type: Date,
        default: null,
    },
    fechaFin: {
        type: Date,
        default: null,
    },
    creadaPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    aprobadaPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null,
    },
    aprobadaAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

PistasHomeSchema.methods.toJSON = function () {
    const { __v, _id, ...pista } = this.toObject();
    pista.uid = _id;
    return pista;
};

module.exports = model('PistaHome', PistasHomeSchema);
