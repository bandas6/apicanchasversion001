const { Schema, model } = require('mongoose');

const diasYHorasSchema = new Schema({
    dias: { type: String },
    horas: { type: String }
}, { _id: false }); // _id: false para no crear _id para subdocumentos

const UsuarioSchema = new Schema({
    nombre: {
        type: String,
        // required: [true, 'El nombre es obligatorio']
    },
    apellido: {
        type: String,
        // required: [true, 'El apellido es obligatorio']
    },
    correo: {
        type: String,
        // required: [true, 'El correo es obligatorio'],
    },
    password: {
        type: String,
        // required: [true, 'La contraseña es obligatoria'],
    },
    posicion: {
        type: String,
    },  
    puntuacion: {
        type: Number,
    },
    valoracion: {
        type: Number,
        default: 0
    },
    reliabilityScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
    },
    attendanceCount: {
        type: Number,
        min: 0,
        default: 0,
    },
    lateCount: {
        type: Number,
        min: 0,
        default: 0,
    },
    noShowCount: {
        type: Number,
        min: 0,
        default: 0,
    },
    lateCancelCount: {
        type: Number,
        min: 0,
        default: 0,
    },
    reliabilityBadge: {
        type: String,
        enum: ['confiable', 'normal', 'con incidencias'],
        default: 'confiable',
    },
    bio: {
        type: String,
        trim: true,
        default: '',
    },
    ciudad: {
        type: String,
        trim: true,
        default: '',
    },
    nivelJuego: {
        type: String,
        trim: true,
        default: '',
    },
    pieDominante: {
        type: String,
        trim: true,
        default: '',
    },
    estiloJuego: {
        type: String,
        trim: true,
        default: '',
    },
    disponibilidadHabitual: {
        type: String,
        trim: true,
        default: '',
    },
    deportesFavoritos: [{
        type: String,
        trim: true,
    }],
    deportesPrincipales: [{
        type: String,
        trim: true,
    }],
    zonaPreferida: {
        type: String,
        trim: true,
        default: '',
    },
    horariosPreferidos: [{
        type: String,
        trim: true,
    }],
    tipoCanchaPreferida: {
        type: String,
        trim: true,
        default: '',
    },
    fotoUrl: {
        type: String,
        trim: true,
        default: '',
    },
    nombre_archivo_imagen: {
        type: String,
    },
    rol: {
        type: String,
        default: 'USER_ROL',
    },
    diasYHoras: diasYHorasSchema,
    estado: {
        type: Boolean,
        default: true
    },
    equipo_id: {
        type: Schema.Types.ObjectId,
        ref: 'Equipo',
    },
    complejosFavoritos: [{
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
    }],
    canchasFavoritas: [{
        type: Schema.Types.ObjectId,
        ref: 'Cancha',
    }],
    filtrosGuardados: [{
        nombre: { type: String, trim: true, default: '' },
        scope: { type: String, trim: true, default: 'home' },
        payload: { type: Schema.Types.Mixed, default: {} },
        createdAt: { type: Date, default: Date.now },
    }],
    devicePushTokens: [{
        token: { type: String, trim: true, default: '' },
        platform: { type: String, trim: true, default: '' },
        updatedAt: { type: Date, default: Date.now },
    }],
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
    },
    google: {
        type: Boolean,
        default: false
    },
    refreshTokenHash: {
        type: String,
        default: '',
    },
    identidadVerificada: {
        type: Boolean,
        default: false,
    },
    identidadEstado: {
        type: String,
        default: 'no_enviada',
    },
    identidadTipoDocumento: {
        type: String,
        trim: true,
        default: '',
    },
    identidadNumeroDocumento: {
        type: String,
        trim: true,
        default: '',
    },
    identidadNombreCompleto: {
        type: String,
        trim: true,
        default: '',
    },
    identidadDocumentoFrontalUrl: {
        type: String,
        trim: true,
        default: '',
    },
    identidadDocumentoPosteriorUrl: {
        type: String,
        trim: true,
        default: '',
    },
    identidadSelfieUrl: {
        type: String,
        trim: true,
        default: '',
    },
    identidadObservaciones: {
        type: String,
        trim: true,
        default: '',
    },
    identidadSolicitadaAt: {
        type: Date,
        default: null,
    },
    identidadIntentos: {
        type: Number,
        default: 0,
    },
    identidadVerificadaAt: {
        type: Date,
        default: null,
    },
    identidadVerificadaPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
    }
});

UsuarioSchema.index({ rol: 1, estado: 1 });
UsuarioSchema.index({ ciudad: 1, estado: 1 });


UsuarioSchema.methods.toJSON = function () {
    const { __v, _id, password, refreshTokenHash, ...usuario } = this.toObject();
    usuario.imagenUrl = usuario.fotoUrl || usuario.nombre_archivo_imagen || '';
    usuario.uid = _id;
    return usuario;
}
module.exports = model('Usuario', UsuarioSchema)
