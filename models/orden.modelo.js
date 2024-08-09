const { Schema, model } = require('mongoose');

const OrdenProductoSchema = new Schema({
    productoId: {
        type: Schema.Types.ObjectId,
        ref: 'Producto',
        required: true,
    },
    cantidad: {
        type: Number,
        required: true,
    },
    precio: {
        type: Number,
        required: true,
    },
}, { _id: false });

const OrdenSchema = new Schema({
    usuarioId: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    productos: [OrdenProductoSchema],
    totalMonto: {
        type: Number,
        required: true,
    },
    direccionEnvio: {
        type: String,
        required: true,
    },
    metodoPago: {
        type: String,
        required: true,
    },
    estado: {
        type: String,
        enum: ['pendiente', 'enviado', 'entregado', 'cancelado'],
        default: 'pendiente',
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
OrdenSchema.methods.toJSON = function () {
    const { __v, _id, ...orden } = this.toObject();
    orden.uid = _id;
    return orden;
}

module.exports = model('Orden', OrdenSchema);
