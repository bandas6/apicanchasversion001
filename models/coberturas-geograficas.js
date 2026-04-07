const { Schema, model } = require('mongoose');

const BoundsSchema = new Schema({
    north: {
        type: Number,
        required: true,
    },
    south: {
        type: Number,
        required: true,
    },
    east: {
        type: Number,
        required: true,
    },
    west: {
        type: Number,
        required: true,
    },
}, { _id: false });

const CoberturaGeograficaSchema = new Schema({
    pais: {
        type: String,
        required: true,
        trim: true,
    },
    ciudad: {
        type: String,
        required: true,
        trim: true,
    },
    slug: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    bounds: {
        type: BoundsSchema,
        required: true,
    },
    activo: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

CoberturaGeograficaSchema.methods.toJSON = function () {
    const { __v, _id, ...coverage } = this.toObject();
    coverage.uid = _id;
    return coverage;
};

module.exports = model('CoberturaGeografica', CoberturaGeograficaSchema);
