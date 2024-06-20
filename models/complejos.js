const { Schema, model } = require('mongoose');

const ComplejosSchema = new Schema({
    nombre: {
        type: String,
    },
    barrio: {
        type: String,
    },
    direccion: {
        type: String,
    },
    latitud:{
        type: String,
    },
    longitud:{
        type: String,
    },
    administrador:{
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: [true,'El usuario administrador de canchas es obligatorio'],    
    },
    canchas: [{
        type: Schema.Types.ObjectId,
        ref: 'Cancha'
    }],
    img:{
        type: String,
    }
});


ComplejosSchema.methods.toJSON = function () {
    const { __v, _id , ...complejo } = this.toObject();
    complejo.uid = _id;
    return complejo;
}

module.exports = model('Complejo', ComplejosSchema);
