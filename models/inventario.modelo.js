const { Schema, model } = require('mongoose');

const InventarioSchema = new Schema({
    productoId: {
        type: Schema.Types.ObjectId,
        ref: 'Producto',
        required: true,
    },
    cantidad: {
        type: Number,
        required: true,
    },
    ubicacion: {
        type: String,
    },
    fechaActualizacion: {
        type: Date,
        default: Date.now,
    }
});

// Método para modificar la respuesta JSON del modelo
InventarioSchema.methods.toJSON = function () {
    const { __v, _id, ...inventario } = this.toObject();
    inventario.uid = _id;
    return inventario;
}

module.exports = model('Inventario', InventarioSchema);
