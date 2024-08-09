const { Schema, model } = require('mongoose');

// Esquema para las reseñas de productos
const ReviewSchema = new Schema({
    usuarioId: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    comentario: {
        type: String,
    },
    calificacion: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },
    fechaCreacion: {
        type: Date,
        default: Date.now,
    }
}, { _id: false });  // No creamos un ID propio para cada reseña

const ProductoSchema = new Schema({
    nombre: {
        type: String,
        required: true,
    },
    descripcion: {
        type: String,
        required: true,
    },
    precio: {
        type: Number,
        required: true,
    },
    categoria: {
        type: Schema.Types.ObjectId,
        ref: 'Categoria',
        required: true,
    },
    stock: {
        type: Number,
        required: true,
    },
    imagenes: {
        type: [String],
        required: true,
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
    },
    reseñas: [ReviewSchema],
    atributos: {
        type: Map,
        of: String,  // Ej: {"tamaño": "L", "color": "rojo"}
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
ProductoSchema.methods.toJSON = function () {
    const { __v, _id, ...producto } = this.toObject();
    producto.uid = _id;
    return producto;
}

module.exports = model('Producto', ProductoSchema);
