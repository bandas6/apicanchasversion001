const { Schema, model } = require('mongoose');

const CentroMensajesSchema = new Schema({
    tipo: {
        type: String,
        enum: ['TIP', 'BANNER', 'ALERTA', 'NOTIFICACION'],
        default: 'TIP',
    },
    titulo: {
        type: String,
        trim: true,
        default: '',
    },
    texto: {
        type: String,
        trim: true,
        required: [true, 'El texto del mensaje es obligatorio'],
    },
    imagenUrl: {
        type: String,
        trim: true,
        default: '',
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
        enum: ['NONE', 'COMPLEJOS', 'RESERVAS', 'COMPLEJO', 'URL'],
        default: 'NONE',
    },
    ctaTargetId: {
        type: String,
        trim: true,
        default: '',
    },
    ctaUrl: {
        type: String,
        trim: true,
        default: '',
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
    layout: {
        type: String,
        enum: ['SOLO_TEXTO', 'IMAGEN_TEXTO', 'SOLO_IMAGEN'],
        default: 'SOLO_TEXTO',
    },
    posicion: {
        type: String,
        enum: ['TOP', 'CENTER', 'BOTTOM'],
        default: 'TOP',
    },
    descartable: {
        type: Boolean,
        default: true,
    },
    bloqueante: {
        type: Boolean,
        default: false,
    },
    duracionMs: {
        type: Number,
        default: 5000,
    },
    modoEntrega: {
        type: String,
        enum: ['INMEDIATO', 'ROTACION'],
        default: 'INMEDIATO',
    },
    frecuenciaMinutos: {
        type: Number,
        default: 5,
    },
    cooldownMinutos: {
        type: Number,
        default: 60,
    },
    prioridad: {
        type: Number,
        default: 50,
    },
    maxImpresionesPorUsuario: {
        type: Number,
        default: 0,
    },
    maxImpresionesTotales: {
        type: Number,
        default: 0,
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
    estado: {
        type: String,
        enum: [
            'BORRADOR',
            'PENDIENTE_APROBACION',
            'PROGRAMADO',
            'ACTIVO',
            'PAUSADO',
            'RECHAZADO',
            'FINALIZADO',
        ],
        default: 'BORRADOR',
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
    aprobada: {
        type: Boolean,
        default: false,
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
    collection: 'pistahomes',
});

CentroMensajesSchema.methods.toJSON = function () {
    const { __v, _id, ...mensaje } = this.toObject();
    mensaje.uid = _id;
    mensaje.alcanceTipo = mensaje.scope;
    mensaje.ctaTargetTipo = mensaje.ctaTarget;
    mensaje.revisadaPor = mensaje.aprobadaPor;
    mensaje.revisadaAt = mensaje.aprobadaAt;
    return mensaje;
};

module.exports = model('CentroMensaje', CentroMensajesSchema);
