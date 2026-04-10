const { Schema, model } = require('mongoose');

const DisponibilidadSemanalSchema = new Schema({
    diaSemana: {
        type: Number,
        min: 1,
        max: 7,
        required: true,
    },
    horaInicio: {
        type: String,
        required: true,
    },
    horaFin: {
        type: String,
        required: true,
    },
    disponible: {
        type: Boolean,
        default: true,
    },
}, { _id: false });

const TarifaHorarioSchema = new Schema({
    diaSemana: {
        type: Number,
        min: 1,
        max: 7,
        required: true,
    },
    horaInicio: {
        type: String,
        required: true,
    },
    horaFin: {
        type: String,
        required: true,
    },
    precio: {
        type: Number,
        min: 0,
        required: true,
    },
    moneda: {
        type: String,
        default: 'COP',
        trim: true,
    },
    activo: {
        type: Boolean,
        default: true,
    },
}, { _id: false });

const TarifaEspecialSchema = new Schema({
    diasSemana: {
        type: [Number],
        default: [],
    },
    horaInicio: {
        type: String,
        required: true,
    },
    horaFin: {
        type: String,
        required: true,
    },
    precio: {
        type: Number,
        min: 0,
        required: true,
    },
    moneda: {
        type: String,
        default: 'COP',
        trim: true,
    },
    activo: {
        type: Boolean,
        default: true,
    },
}, { _id: false });

const BloqueNoDisponibleSchema = new Schema({
    fecha: {
        type: String,
        trim: true,
    },
    horaInicio: {
        type: String,
        required: true,
    },
    horaFin: {
        type: String,
        required: true,
    },
    motivo: {
        type: String,
        trim: true,
        default: '',
    },
    activo: {
        type: Boolean,
        default: true,
    },
}, { _id: false });

const CanchasSchema = new Schema({
    nombre: {
        type: String,
        trim: true,
    },
    descripcion: {
        type: String,
    },
    tipoDeporte: {
        type: String,
    },
    deporte: {
        type: Schema.Types.ObjectId,
        ref: 'Deporte',
    },
    deportes: [{
        type: Schema.Types.ObjectId,
        ref: 'Deporte',
    }],
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
        required: [true, 'El complejo es obligatorio'],
    },
    capacidad: {
        type: Number,
        default: 0,
    },
    precioHora: {
        type: Number,
        default: 0,
    },
    precioHoraBase: {
        type: Number,
        default: 0,
    },
    duracionSlotMinutos: {
        type: Number,
        default: 60,
        min: 30,
    },
    pasoSlotMinutos: {
        type: Number,
        default: 60,
        min: 30,
    },
    reservaMinimaMinutos: {
        type: Number,
        default: 60,
        min: 30,
    },
    reservaMaximaMinutos: {
        type: Number,
        default: 120,
        min: 30,
    },
    tarifas: {
        type: [TarifaHorarioSchema],
        default: [],
    },
    tarifasEspeciales: {
        type: [TarifaEspecialSchema],
        default: [],
    },
    img: {
        type: String,
    },
    _id: {
        type: Schema.Types.ObjectId,
        auto: true,
    },
    eliminado: {
        type: Boolean,
        default: false,
    },
    activa: {
        type: Boolean,
        default: true,
    },
    enMantenimiento: {
        type: Boolean,
        default: false,
    },
    fechasDisponibles: [{
        type: Date,
    }],
    disponibilidadSemanal: {
        type: [DisponibilidadSemanalSchema],
        default: [],
    },
    bloquesNoDisponibles: {
        type: [BloqueNoDisponibleSchema],
        default: [],
    },
    reserva: {
        type: Boolean,
        default: false,
    },
    solicitudes: [{
        type: Schema.Types.ObjectId,
        ref: 'Solicitud',
    }],
    dias: [{
        type: String,
        enum: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
        required: [true, 'Los dias son obligatorios'],
    }]
});

CanchasSchema.index({ complejo: 1, eliminado: 1 });
CanchasSchema.index({ complejo: 1, activa: 1, enMantenimiento: 1 });

CanchasSchema.methods.toJSON = function () {
    const { __v, _id, ...cancha } = this.toObject();
    cancha.uid = _id;
    return cancha;
}

module.exports = model('Cancha', CanchasSchema);
