const { Schema, model } = require('mongoose');

const DireccionSchema = new Schema({
    calle: {
        type: String,
        required: true,
    },
    ciudad: {
        type: String,
        required: true,
    },
    estado: {
        type: String,
        required: true,
    },
    codigoPostal: {
        type: String,
        required: true,
    },
    pais: {
        type: String,
        required: true,
    }
}, { _id: false });  // No creamos un ID propio para cada dirección

const UsuarioSchema = new Schema({
    nombres: {
        type: String,
        required: true,
    },
    apellidos: {
        type: String,
        required: true,
    },
    correo: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    img: {
        type: String,
    },
    direcciones: {
        type: [DireccionSchema],
    },
    ordenes: [{
        type: Schema.Types.ObjectId,
        ref: 'Orden',
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: 'Producto',
    }],
    fechaCreacion: {
        type: Date,
        default: Date.now,
    },
    fechaActualizacion: {
        type: Date,
    },
    rol: {
        type: String,
        default: 'USER_ROL',
    },
    estado: {
        type: Boolean,
        default: true,
    },
    google: {
        type: Boolean,
        default: false,
    },
});

// Método para modificar la respuesta JSON del modelo
UsuarioSchema.methods.toJSON = function () {
    const { __v, password, _id, estado, ...user } = this.toObject();
    user.uid = _id;
    return user;
}

module.exports = model('Usuario', UsuarioSchema);
