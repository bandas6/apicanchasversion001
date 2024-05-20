const { Schema, model } = require('mongoose');

const EquiposSchema = new Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio']
    },
    img: { 
        type: String,
    },
    estado: { 
        type: Boolean,
        default: true
    },
    valoracion: { 
        type: Number,
        default: 0
    },
    jugadores: [{
        id: {type: Schema.Types.ObjectId,ref: 'Usuario'},
        aceptado: {type: Boolean, default: false}
    }], 
    reto: [{
        equipo: { type: Schema.Types.ObjectId, ref: 'Equipo' },
        usuario: { type: Schema.Types.ObjectId, ref: 'Usuario' },
        aceptado: { type: Boolean, default: false }
    }],
    usuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: [true, 'el usuario es obligatorio'],
    },
});


EquiposSchema.methods.toJSON = function () {
    const { __v, _id , ...equipo } = this.toObject();
    equipo.uid = _id;
    return equipo;
}

module.exports = model('Equipo', EquiposSchema)