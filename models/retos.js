const { Schema, model } = require('mongoose');

const RetosSchema = new Schema({
    
    usuario: {  
        type: Schema.Types.ObjectId, 
        ref: 'Usuario',
    },
    usuarioRetado: {
        type: Schema.Types.ObjectId, 
        ref: 'Usuario',
    },
    jugado: {
        type: Boolean,
        default: false
    },
    resultado: {
        equipoUno: { type: Number },
        equipoDos: { type: Number },
    },
    fechaCreacion: {
        type: Date,
        default: Date.now
    },
    fechaActualizacion: {
        type: Date
    },
    estado:{
        type: Number,
        default: 1
    },
    aceptado:{
        type: Boolean,
        default: false
    },
    complejo:{
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
    },
    fechaPartido:{
        type: Date,
    }

});

RetosSchema.methods.toJSON = function () {
    const { __v, _id, ...reto } = this.toObject();
    reto.uid = _id;
    return reto;
}

module.exports = model('Reto', RetosSchema)