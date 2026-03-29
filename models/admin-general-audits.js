const { Schema, model } = require('mongoose');

const AdminGeneralAuditSchema = new Schema({
    actorUsuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    actorCorreo: {
        type: String,
        default: '',
        trim: true,
    },
    action: {
        type: String,
        required: true,
        trim: true,
    },
    resourceType: {
        type: String,
        required: true,
        trim: true,
    },
    resourceId: {
        type: String,
        default: '',
        trim: true,
    },
    targetUsuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
    },
    targetCorreo: {
        type: String,
        default: '',
        trim: true,
    },
    summary: {
        type: String,
        default: '',
        trim: true,
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = model('AdminGeneralAudit', AdminGeneralAuditSchema);
