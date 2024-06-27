const { Schema, model } = require('mongoose');

const SolicitudSchema = new Schema({

    usuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
    },
    administrador:{
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
    },
    complejo:{
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
    },
    cancha: {
        type: Schema.Types.ObjectId,
        ref: 'Cancha',
    },
    fechaSeleccionada: {
        type: Date,
    },
    fechaCreacion: {
        type: Date,
        default: Date.now
    },
    fechaActualizacion: {
        type: Date
    },
    aceptado: {
        type: Boolean,
        default: false
    },
    estado:{
        type: Number,
        default: 1
    },
    mensaje: {
        type: String,
        default: ''
    }

});


SolicitudSchema.methods.toJSON = function () {
    const { __v, _id, ...solicitud } = this.toObject();
    solicitud.uid = _id;
    return solicitud;
}

module.exports = model('Solicitud', SolicitudSchema);
