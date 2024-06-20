const { Schema, model } = require('mongoose');

const PartidosSchema = new Schema({
    jugado: {
        type: Boolean,
        default: false
    },
    resultado: {
        equipoUno: { type: Number },
        equipoDos: { type: Number },
    },
    equipos: {
        equipoUno: { type: Schema.Types.ObjectId, ref: 'Equipo' },
        equipoDos: { type: Schema.Types.ObjectId, ref: 'Equipo' }
    },
    usuarios: {
        usuarioUno: { type: Schema.Types.ObjectId, ref: 'Usuario' },
        usuarioDos: { type: Schema.Types.ObjectId, ref: 'Usuario' }
    },
});


// PartidosSchema.methods.toJSON = function () {
//     const { __v, _id, ...partido } = this.toObject();
//     partido.uid = _id;
//     return equipo;
// }

module.exports = model('Partido', PartidosSchema)