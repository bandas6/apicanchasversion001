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
    fechasDisponibles: [{
        type: Date,
    }],
    solicitudes: [{
        type: Schema.Types.ObjectId,
        ref: 'Solicitud',
    }]
});


CanchasSchema.methods.toJSON = function () {
    const { __v, _id, ...cancha } = this.toObject();
    cancha.uid = _id;
    return cancha;
}

module.exports = model('Cancha', CanchasSchema);
