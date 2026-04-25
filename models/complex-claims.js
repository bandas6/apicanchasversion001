const { Schema, model } = require('mongoose');

const ComplexClaimSchema = new Schema({
    complejo: {
        type: Schema.Types.ObjectId,
        ref: 'Complejo',
        required: true,
    },
    solicitante: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    estado: {
        type: String,
        enum: ['pendiente', 'aprobado', 'rechazado'],
        default: 'pendiente',
    },
    tipoRelacion: {
        type: String,
        trim: true,
        required: true,
    },
    nombreSolicitante: {
        type: String,
        trim: true,
        required: true,
    },
    telefonoSolicitante: {
        type: String,
        trim: true,
        required: true,
    },
    correoSolicitante: {
        type: String,
        trim: true,
        required: true,
    },
    nombreComercial: {
        type: String,
        trim: true,
        required: true,
    },
    razonSocial: {
        type: String,
        trim: true,
        default: '',
    },
    documentoFiscal: {
        type: String,
        trim: true,
        default: '',
    },
    pruebaControl: {
        type: String,
        trim: true,
        required: true,
    },
    documentoRespaldoUrl: {
        type: String,
        trim: true,
        default: '',
    },
    observaciones: {
        type: String,
        trim: true,
        default: '',
    },
    revisadoPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null,
    },
    revisadoAt: {
        type: Date,
        default: null,
    },
    respuestaRevision: {
        type: String,
        trim: true,
        default: '',
    },
}, {
    timestamps: true,
    collection: 'complex_claims',
});

ComplexClaimSchema.index({ complejo: 1, estado: 1 });
ComplexClaimSchema.index({ solicitante: 1, estado: 1 });

ComplexClaimSchema.methods.toJSON = function () {
    const { __v, _id, ...claim } = this.toObject();
    claim.uid = _id;
    return claim;
};

module.exports = model('ComplexClaim', ComplexClaimSchema);
