const { Schema, model } = require('mongoose');

const RoleChangeAuditSchema = new Schema({
    actorUsuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    actorCorreo: {
        type: String,
        trim: true,
        default: '',
    },
    usuarioObjetivo: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    correoObjetivo: {
        type: String,
        trim: true,
        default: '',
    },
    rolAnterior: {
        type: String,
        required: true,
    },
    rolNuevo: {
        type: String,
        required: true,
    },
    fechaCambio: {
        type: Date,
        default: Date.now,
    },
}, {
    collection: 'role_change_audits',
});

RoleChangeAuditSchema.methods.toJSON = function () {
    const { __v, _id, ...audit } = this.toObject();
    audit.uid = _id;
    return audit;
};

module.exports = model('RoleChangeAudit', RoleChangeAuditSchema);
