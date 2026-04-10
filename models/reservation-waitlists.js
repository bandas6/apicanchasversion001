const { Schema, model } = require('mongoose');

const ReservationWaitlistSchema = new Schema({
    usuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true,
    },
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
        required: true,
        index: true,
    },
    cancha: {
        type: Schema.Types.ObjectId,
        ref: 'Cancha',
        required: true,
        index: true,
    },
    fecha: {
        type: Date,
        required: true,
        index: true,
    },
    horaInicio: {
        type: String,
        required: true,
    },
    horaFin: {
        type: String,
        required: true,
    },
    observaciones: {
        type: String,
        trim: true,
        default: '',
    },
    sourceReservationId: {
        type: Schema.Types.ObjectId,
        ref: 'Reserva',
        default: null,
    },
    estado: {
        type: String,
        enum: ['activa', 'notificada', 'convertida', 'cancelada'],
        default: 'activa',
        index: true,
    },
}, {
    timestamps: true,
    collection: 'reservation_waitlists',
});

ReservationWaitlistSchema.index({
    usuario: 1,
    cancha: 1,
    fecha: 1,
    horaInicio: 1,
    horaFin: 1,
}, { unique: true });

ReservationWaitlistSchema.methods.toJSON = function () {
    const { __v, _id, ...item } = this.toObject();
    item.uid = _id;
    return item;
};

module.exports = model('ReservationWaitlist', ReservationWaitlistSchema);
