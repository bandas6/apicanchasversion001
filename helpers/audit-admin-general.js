const AdminGeneralAudit = require('../models/admin-general-audits');

const auditAdminGeneralAction = async ({
    req,
    action,
    resourceType,
    resourceId = '',
    targetUsuario = null,
    targetCorreo = '',
    summary = '',
    metadata = {},
}) => {
    if (req?.usuarioAuth?.rol !== 'ADMIN_GENERAL_ROL') {
        return;
    }

    await AdminGeneralAudit.create({
        actorUsuario: req.usuarioAuth._id,
        actorCorreo: req.usuarioAuth?.correo || '',
        action,
        resourceType,
        resourceId: String(resourceId || ''),
        targetUsuario,
        targetCorreo,
        summary,
        metadata,
    });
};

module.exports = {
    auditAdminGeneralAction,
};
