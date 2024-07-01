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
    usuarios: [{
        usuario: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario'
        },
        aceptado: {
            type: Boolean,
            default: false
        }
    }],
    semana: {
        type: String
    }
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
        type: [HorarioSchema], // Lista de horarios basada en el subesquema HorarioSchema
        default: [] // Por defecto, la lista de horarios es vacía
    },
    horariosDos: {
        type: [HorarioSchema], // Lista de horarios basada en el subesquema HorarioSchema
        default: [] // Por defecto, la lista de horarios es vacía
    },
    cancha: {
        type: Schema.Types.ObjectId,
        ref: 'Cancha',
    },
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
    }
});

// Exportar el modelo
const Reserva = mongoose.model('Reserva', ReservasSchema);
module.exports = Reserva;
