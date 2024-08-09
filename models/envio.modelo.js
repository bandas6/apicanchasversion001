const { Schema, model } = require('mongoose');

const EnvioSchema = new Schema({
    ordenId: {
        type: Schema.Types.ObjectId,
        ref: 'Orden',
        required: true,
    },
    numeroSeguimiento: {
        type: String,
        required: true,
    },
    transportista: {
        type: String,
        required: true,
    },
    estado: {
        type: String,
        enum: ['en tránsito', 'entregado'],
        default: 'en tránsito',
    },
    fechaCreacion: {
        type: Date,
        default: Date.now,
    },
    fechaActualizacion: {
        type: Date,
    }
});

// Método para modificar la respuesta JSON del modelo
EnvioSchema.methods.toJSON = function () {
    const { __v, _id, ...envio } = this.toObject();
    envio.uid = _id;
    return envio;
}

module.exports = model('Envio', EnvioSchema);
