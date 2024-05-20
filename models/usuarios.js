const { Schema, model } = require('mongoose');

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
        unique: true
    },
    password: { 
        type: String,
        // required: [true, 'La contraseña es obligatoria'],
    },
    img: { 
        type: String,
    },
    rol: { 
        type: String,
        required: true,
        default:'USER_ROL',
    },
    
    estado: { 
        type: Boolean,
        default: true
    },
    equipo_id: { 
        type: Schema.Types.ObjectId,
        ref: 'Equipo',
    },
    google: { 
        type: Boolean,
        default: false
    }
});


UsuarioSchema.methods.toJSON = function () {
    const { __v, password, _id , estado, ...user } = this.toObject();
    user.uid = _id;
    return user;
}

module.exports = model('Usuario', UsuarioSchema)