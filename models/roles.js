const { Schema, model } = require('mongoose');

const RolesSchema = new Schema({
    rol: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    etiqueta: {
        type: String,
        default: '',
        trim: true,
    },
    descripcion: {
        type: String,
        default: '',
        trim: true,
    },
}, {
    collection: 'roles',
    timestamps: true,
});

module.exports = model('Role', RolesSchema);
