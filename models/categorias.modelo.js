const { Schema, model } = require('mongoose');

const CategoriasSchema = new Schema({
    nombre: {
        type: String,
        required: true,
    },
    descripcion: {
        type: String,
    },
    estado:{
        type:boolean,
        default: true,  // Por defecto, categorías activas
    },
    imagenes: {
        type: [String],
    },
    parentCategoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Categoria',
        default: null,  // Null para las categorías de nivel superior
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
CategoriasSchema.methods.toJSON = function () {
    const { __v, _id, ...categoria } = this.toObject();
    categoria.uid = _id;
    return categoria;
}

module.exports = model('Categoria', CategoriasSchema);
