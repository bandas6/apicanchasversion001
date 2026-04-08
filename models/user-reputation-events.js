const { Schema, model } = require('mongoose');

const USER_ATTENDANCE_VALUES = [
    'asistio',
    'llego_tarde',
    'no_asistio',
];

const USER_BEHAVIOR_VALUES = [
    'correcto',
    'conflictivo',
];

const UserReputationEventSchema = new Schema({
    reservationId: {
        type: Schema.Types.ObjectId,
        ref: 'Reserva',
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true,
    },
    complejoId: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
        required: true,
        index: true,
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
        required: true,
    },
    attendance: {
        type: String,
        enum: USER_ATTENDANCE_VALUES,
        required: true,
    },
    behavior: {
        type: String,
        enum: USER_BEHAVIOR_VALUES,
        default: 'correcto',
    },
    internalComment: {
        type: String,
        trim: true,
        maxlength: 280,
        default: '',
    },
}, {
    timestamps: true,
    collection: 'user_reputation_events',
});

UserReputationEventSchema.methods.toJSON = function () {
    const { __v, _id, ...event } = this.toObject();
    event.uid = _id;
    return event;
};

module.exports = {
    UserReputationEvent: model('UserReputationEvent', UserReputationEventSchema),
    USER_ATTENDANCE_VALUES,
    USER_BEHAVIOR_VALUES,
};
