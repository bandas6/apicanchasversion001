const { Schema, model } = require('mongoose');

const diasYHorasSchema = new Schema({
    dias: { type: String },
    horas: { type: String }
}, { _id: false }); // _id: false para no crear _id para subdocumentos

const UsuarioSchema = new Schema({
    nombre: {
        type: String,
        // required: [true, 'El nombre es obligatorio']
    },
    apellido: {
        type: String,
        // required: [true, 'El apellido es obligatorio']
    },
    correo: {
        type: String,
        // required: [true, 'El correo es obligatorio'],
    },
    password: {
        type: String,
        // required: [true, 'La contraseña es obligatoria'],
    },
    valoracion: {
        type: Number,
        default: 0
    },
    img: {
        type: String,
    },
    rol: {
        type: String,
        default: 'USER_ROL',
    },
    diasYHoras: diasYHorasSchema,
    estado: {
        type: Boolean,
        default: true
    },
    equipo_id: {
        type: Schema.Types.ObjectId,
        ref: 'Equipo',
    },
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
    },
    google: {
        type: Boolean,
        default: false
    }
});


UsuarioSchema.methods.toJSON = function () {
    const { __v, password, _id, estado, ...user } = this.toObject();
    user.uid = _id;
    return user;
}

module.exports = model('Usuario', UsuarioSchema)