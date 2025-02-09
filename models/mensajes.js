// models/Mensaje.js
const { Schema, model } = require('mongoose');

const MensajeSchema = new Schema({
    remitente: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    destinatario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    contenido: {
        type: String,
        required: true
    },
    fechaEnvio: {
        type: Date,
        default: Date.now
    }
});

MensajeSchema.methods.toJSON = function () {
    const { __v, _id, ...mensaje } = this.toObject();
    mensaje.uid = _id;
    return mensaje;
}

module.exports = model('Mensaje', MensajeSchema);
