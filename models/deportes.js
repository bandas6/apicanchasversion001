const { Schema, model } = require('mongoose');

const DeportesSchema = new Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del deporte es obligatorio'],
        trim: true,
        unique: true,
    },
    slug: {
        type: String,
        lowercase: true,
        trim: true,
        unique: true,
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

DeportesSchema.pre('validate', function (next) {
    if (this.nombre) {
        this.nombre = String(this.nombre).trim();
    }

    if (!this.slug && this.nombre) {
        this.slug = this.nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    next();
});

DeportesSchema.methods.toJSON = function () {
    const { __v, _id, ...deporte } = this.toObject();
    deporte.uid = _id;
    return deporte;
}

module.exports = model('Deporte', DeportesSchema);
