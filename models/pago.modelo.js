const { Schema, model } = require('mongoose');

const PagoSchema = new Schema({
    ordenId: {
        type: Schema.Types.ObjectId,
        ref: 'Orden',
        required: true,
    },
    usuarioId: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    monto: {
        type: Number,
        required: true,
    },
    metodoPago: {
        type: String,
        required: true,
    },
    estado: {
        type: String,
        enum: ['completado', 'fallido'],
        default: 'completado',
    },
    transaccionId: {
        type: String,
        required: true,
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
PagoSchema.methods.toJSON = function () {
    const { __v, _id, ...pago } = this.toObject();
    pago.uid = _id;
    return pago;
}

module.exports = model('Pago', PagoSchema);
