const { Schema, model } = require('mongoose');

const COMPLEX_REVIEW_TAGS = [
    'limpieza',
    'puntualidad',
    'atencion',
    'estado_cancha',
];

const ComplexReviewSchema = new Schema({
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
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },
    comentario: {
        type: String,
        trim: true,
        maxlength: 280,
        default: '',
    },
    tags: [{
        type: String,
        enum: COMPLEX_REVIEW_TAGS,
    }],
    moderationStatus: {
        type: String,
        enum: ['visible', 'reported', 'hidden'],
        default: 'visible',
        index: true,
    },
    reportReason: {
        type: String,
        trim: true,
        default: '',
    },
    reportedAt: {
        type: Date,
        default: null,
    },
    reportedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null,
    },
    moderationNotes: {
        type: String,
        trim: true,
        default: '',
    },
    moderatedAt: {
        type: Date,
        default: null,
    },
    moderatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null,
    },
}, {
    timestamps: true,
    collection: 'complex_reviews',
});

ComplexReviewSchema.methods.toJSON = function () {
    const { __v, _id, ...review } = this.toObject();
    review.uid = _id;
    return review;
};

module.exports = {
    ComplexReview: model('ComplexReview', ComplexReviewSchema),
    COMPLEX_REVIEW_TAGS,
};
