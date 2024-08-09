const { Schema, model } = require('mongoose');

const CarritoProductoSchema = new Schema({
    productoId: {
        type: Schema.Types.ObjectId,
        ref: 'Producto',
        required: true,
    },
    cantidad: {
        type: Number,
        required: true,
    },
}, { _id: false });

const CarritoSchema = new Schema({
    usuarioId: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    productos: [CarritoProductoSchema],
    fechaCreacion: {
        type: Date,
        default: Date.now,
    },
    fechaActualizacion: {
        type: Date,
    }
});

// Método para modificar la respuesta JSON del modelo
CarritoSchema.methods.toJSON = function () {
    const { __v, _id, ...carrito } = this.toObject();
    carrito.uid = _id;
    return carrito;
}

module.exports = model('Carrito', CarritoSchema);
