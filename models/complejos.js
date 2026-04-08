const { Schema, model } = require('mongoose');

const HorarioAtencionSchema = new Schema({
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
    activo: {
        type: Boolean,
        default: true,
    },
}, { _id: false });

const ComplejosSchema = new Schema({
    nombre: {
        type: String,
        trim: true,
    },
    descripcion: {
        type: String,
        trim: true,
    },
    ubicacion: {
        type: String,
    },
    direccion: {
        type: String,
        trim: true,
    },
    telefonoContacto: {
        type: String,
        trim: true,
    },
    whatsappContacto: {
        type: String,
        trim: true,
    },
    latitud: {
        type: String,
    },
    longitud: {
        type: String,
    },
    ubicacionGeo: {
        lat: {
            type: Number,
        },
        lng: {
            type: Number,
        },
    },
    administrador: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: [true, 'El usuario administrador de canchas es obligatorio'],
    },
    administradores: [{
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
    }],
    deportes: [{
        type: Schema.Types.ObjectId,
        ref: 'Deporte',
    }],
    horarioAtencion: {
        type: [HorarioAtencionSchema],
        default: [],
    },
    canchas: [{
        type: Schema.Types.ObjectId,
        ref: 'Cancha'
    }],
    img: {
        type: String,
    },
    imagenes: [{
        type: String,
        trim: true,
    }],
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: null,
    },
    totalResenas: {
        type: Number,
        min: 0,
        default: 0,
    },
    ratingBreakdown: {
        oneStar: { type: Number, min: 0, default: 0 },
        twoStars: { type: Number, min: 0, default: 0 },
        threeStars: { type: Number, min: 0, default: 0 },
        fourStars: { type: Number, min: 0, default: 0 },
        fiveStars: { type: Number, min: 0, default: 0 },
    },
    maxReservasPorUsuarioPorDia: {
        type: Number,
        min: 1,
        default: 1,
    },
    estado: {
        type: Boolean,
        default: true,
    },
});

ComplejosSchema.methods.toJSON = function () {
    const { __v, _id, ...complejo } = this.toObject();
    complejo.uid = _id;
    return complejo;
}

module.exports = model('Complejo', ComplejosSchema);
