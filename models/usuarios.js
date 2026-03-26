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
    bio: {
        type: String,
        trim: true,
        default: '',
    },
    ciudad: {
        type: String,
        trim: true,
        default: '',
    },
    nivelJuego: {
        type: String,
        trim: true,
        default: '',
    },
    deportesFavoritos: [{
        type: String,
        trim: true,
    }],
    fotoUrl: {
        type: String,
        trim: true,
        default: '',
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
    const { __v, _id, password, ...usuario } = this.toObject();
    usuario.imagenUrl = usuario.fotoUrl || usuario.nombre_archivo_imagen || '';
    usuario.uid = _id;
    return usuario;
}
module.exports = model('Usuario', UsuarioSchema)
