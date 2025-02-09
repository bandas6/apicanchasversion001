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
    posicion: {
        type: String,
    },  
    puntuacion: {
        type: Number,
    },
    valoracion: {
        type: Number,
        default: 0
    },
    nombre_archivo_imagen: {
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
    const {__v, _id, ...usuario } = this.toObject();
    usuario.uid = _id;
    return usuario;
}
module.exports = model('Usuario', UsuarioSchema)