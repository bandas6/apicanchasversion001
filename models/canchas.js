const { Schema, model } = require('mongoose');

const CanchasSchema = new Schema({
    nombre: {
        type: String,
    },
    descripcion: {
        type: String,
    },
    tipoDeporte: {
        type: String,
    },
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
        required: [true, 'El complejo es obligatorio'],
    },
    img: {
        type: String,
    },
    _id: {
        type: Schema.Types.ObjectId,
        auto: true,
    },
    fechasDisponibles: [{
        type: Date,
    }],
    reserva:{
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


CanchasSchema.methods.toJSON = function () {
    const { __v, _id, ...cancha } = this.toObject();
    cancha.uid = _id;
    return cancha;
}

module.exports = model('Cancha', CanchasSchema);
