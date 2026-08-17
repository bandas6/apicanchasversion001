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

ReservasSchema.index({ cancha: 1, fecha: 1, estado: 1 });
ReservasSchema.index({ complejo: 1, fecha: -1, estado: 1 });
ReservasSchema.index({ usuario: 1, fecha: -1 });
ReservasSchema.index({ estado: 1, fecha: 1, horaFin: 1 });
ReservasSchema.index({ reviewWindowEndsAt: 1 });

// B2 (brief de diseño de Fase 4, equipos-social-fase4.md): si la reserva que
// un reto tiene vinculada deja de ser "real" (se cancela, expira, etc.), el
// reto tiene que volver a 'aceptado' sin reserva -- si no, el detalle del
// reto sigue mostrando una cancha que ya no existe. Se centraliza aca (un
// solo lugar, en el modelo) en vez de en cada uno de los varios call sites
// que mutan `estado` (controllers/reservas.controller.js,
// helpers/reservation-reputation.js), para no depender de que cada uno se
// acuerde de avisarle a Reto.
const ESTADOS_RESERVA_VIGENTE_PARA_RETO = ['confirmada', 'completada'];

ReservasSchema.pre('save', function (next) {
    this.$locals = this.$locals || {};
    this.$locals.estadoModificado = this.isModified('estado');
    next();
});

ReservasSchema.post('save', async function (doc) {
    if (!doc.$locals?.estadoModificado) return;
    if (ESTADOS_RESERVA_VIGENTE_PARA_RETO.includes(doc.estado)) return;

    const { Reto } = require('./retos');
    await Reto.updateMany(
        { reserva: doc._id, estado: 'aceptado' },
        { $set: { reserva: null, reservaDesvinculadaEn: new Date() } },
    );
});

ReservasSchema.methods.toJSON = function () {
    const { __v, _id, ...reserva } = this.toObject();
    reserva.uid = _id;
    return reserva;
}

module.exports = mongoose.model('Reserva', ReservasSchema);
