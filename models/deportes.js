const { Schema, model } = require('mongoose');

const DeportesSchema = new Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del deporte es obligatorio'],
        trim: true,
    },
    slug: {
        type: String,
        lowercase: true,
        trim: true,
    },
    descripcion: {
        type: String,
        trim: true,
    },
    activo: {
        type: Boolean,
        default: true,
    },
});

DeportesSchema.methods.toJSON = function () {
    const { __v, _id, ...deporte } = this.toObject();
    deporte.uid = _id;
    return deporte;
}

module.exports = model('Deporte', DeportesSchema);
