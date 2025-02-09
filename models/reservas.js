const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HorarioSchema = new Schema({
    hora: {
        type: String,
        required: true // La hora es requerida
    },
    estado: {
        type: Number,
        enum: [0, 1, 2, 3, 4], // 0: no disponible, 1: disponible 2:Solicitado 3:reservado 4:cancelado
        default: 1, // Por defecto, las horas están disponibles
        required: true
    },
    guardado: {
        type: Boolean,
        default: false,
    },
    semana: {
        type: String
    },
    usuarios: [{
        usuario: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario'
        },
        aceptado: {
            type: Boolean,
            default: false
        },
        fechaCreacion: {
            type: Date,
            default: Date.now
        }
    }]
});

const ReservasSchema = new Schema({
    dia: {
        type: String,
        enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    },
    fechaCreacion: {
        type: Date,
        default: Date.now
    },
    horariosUno: {
        horario:{
            type: [HorarioSchema], // Lista de horarios basada en el subesquema HorarioSchema
            default: [] // Por defecto, la lista de horarios es vacía
        },
        guardado:{
            type: Boolean,
            default: false,
        }
    },
    horariosDos: {
        horario:{
            type: [HorarioSchema], // Lista de horarios basada en el subesquema HorarioSchema
            default: [] // Por defecto, la lista de horarios es vacía
        },
        guardado:{
            type: Boolean,
            default: false,
        }
    },
    cancha: {
        type: Schema.Types.ObjectId,
        ref: 'Cancha',
    },
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
    },
});

ReservasSchema.methods.toJSON = function () {
    const { __v, _id, ...reserva } = this.toObject();
    reserva.uid = _id;
    return reserva;
}

// Exportar el modelo
module.exports = mongoose.model('Reserva', ReservasSchema);
