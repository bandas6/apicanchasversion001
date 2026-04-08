const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HorarioSchema = new Schema({
    hora: {
        type: String,
        required: true
    },
    estado: {
        type: Number,
        enum: [0, 1, 2, 3, 4],
        default: 1,
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
    usuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
    },
    dia: {
        type: String,
        enum: ['Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado', 'Domingo'],
    },
    fecha: {
        type: Date,
    },
    fechaCreacion: {
        type: Date,
        default: Date.now
    },
    horaInicio: {
        type: String,
    },
    horaFin: {
        type: String,
    },
    deporte: {
        type: Schema.Types.ObjectId,
        ref: 'Deporte',
    },
    estado: {
        type: String,
        enum: [
            'pendiente',
            'confirmada',
            'rechazada',
            'cancelada',
            'expirada',
            'pendiente_cierre',
            'completada',
            'no_show_usuario',
            'cancelada_tardia_usuario',
            'cancelada_por_complejo',
            'incidencia',
        ],
        default: 'pendiente',
    },
    closedAt: {
        type: Date,
        default: null,
    },
    closedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null,
    },
    closureReason: {
        type: String,
        enum: [
            'completada',
            'no_show_usuario',
            'cancelada_tardia_usuario',
            'cancelada_por_complejo',
            'incidencia',
        ],
        default: null,
    },
    closureNotes: {
        type: String,
        trim: true,
        default: '',
    },
    reviewWindowEndsAt: {
        type: Date,
        default: null,
    },
    userCanReviewComplex: {
        type: Boolean,
        default: false,
    },
    complexCanEvaluateUser: {
        type: Boolean,
        default: false,
    },
    userReviewedComplexAt: {
        type: Date,
        default: null,
    },
    complexEvaluatedUserAt: {
        type: Date,
        default: null,
    },
    observaciones: {
        type: String,
        trim: true,
    },
    precioTotal: {
        type: Number,
        default: 0,
    },
    horariosUno: {
        horario: {
            type: [HorarioSchema],
            default: []
        },
        guardado: {
            type: Boolean,
            default: false,
        }
    },
    horariosDos: {
        horario: {
            type: [HorarioSchema],
            default: []
        },
        guardado: {
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

module.exports = mongoose.model('Reserva', ReservasSchema);
