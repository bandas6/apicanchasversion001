const { request, response } = require('express');
const AdminGeneralAudit = require('../models/admin-general-audits');

const obtenerAuditoriaAdminGeneral = async (req = request, res = response) => {
    try {
        const { limit = 20, desde = 0, action, resourceType, actor, target } = req.query;
        const query = {};

        if (action) {
            query.action = action;
        }

        if (resourceType) {
            query.resourceType = resourceType;
        }

        if (actor) {
            query.actorUsuario = actor;
        }

        if (target) {
            query.targetUsuario = target;
        }

        const [total, auditorias] = await Promise.all([
            AdminGeneralAudit.countDocuments(query),
            AdminGeneralAudit.find(query)
                .populate('actorUsuario', 'nombre apellido correo rol')
                .populate('targetUsuario', 'nombre apellido correo rol estado')
                .sort({ createdAt: -1 })
                .skip(Number(desde))
                .limit(Number(limit)),
        ]);

        return res.status(200).json({
            ok: true,
            total,
            auditorias,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    obtenerAuditoriaAdminGeneral,
};
