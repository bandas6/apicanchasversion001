const { request, response } = require('express');
const ComplexClaim = require('../models/complex-claims');
const Complejo = require('../models/complejos');
const Usuario = require('../models/usuarios');
const RoleChangeAudit = require('../models/role-change-audits');
const { auditAdminGeneralAction } = require('../helpers/audit-admin-general');
const { uploadBufferToCloudinary } = require('../helpers/cloudinary');

const trimText = (value = '') => String(value || '').trim();

const buildCloudinaryPublicId = (...parts) => parts
    .map((part) => trimText(part).toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .filter(Boolean)
    .join('-');

const uploadClaimDocumentIfPresent = async ({ file, claimId }) => {
    if (!file?.buffer) {
        return '';
    }

    const result = await uploadBufferToCloudinary({
        buffer: file.buffer,
        folder: 'canchas/reclamos-complejos',
        publicId: buildCloudinaryPublicId('reclamo-complejo', claimId, Date.now()),
        resourceType: 'auto',
    });

    return result?.secure_url || '';
};

const populateClaim = (query) => query
    .populate('complejo', 'nombre direccion telefonoContacto whatsappContacto reclamoEstado propiedadVerificada')
    .populate('solicitante', 'nombre apellido correo telefono rol identidadEstado identidadVerificada')
    .populate('revisadoPor', 'nombre apellido correo rol');

const serializeClaim = (claim) => {
    const plain = typeof claim?.toJSON === 'function' ? claim.toJSON() : claim;
    return plain || null;
};

const normalizeClaimPayload = (body = {}, usuarioAuth = {}) => {
    const nombreUsuario = `${usuarioAuth.nombre || ''} ${usuarioAuth.apellido || ''}`.trim();
    return {
        tipoRelacion: trimText(body.tipoRelacion),
        nombreSolicitante: trimText(body.nombreSolicitante) || nombreUsuario,
        telefonoSolicitante: trimText(body.telefonoSolicitante),
        correoSolicitante: trimText(body.correoSolicitante) || trimText(usuarioAuth.correo),
        nombreComercial: trimText(body.nombreComercial),
        razonSocial: trimText(body.razonSocial),
        documentoFiscal: trimText(body.documentoFiscal),
        pruebaControl: trimText(body.pruebaControl),
        documentoRespaldoUrl: trimText(body.documentoRespaldoUrl),
        observaciones: trimText(body.observaciones),
    };
};

const validateClaimPayload = (data = {}) => {
    if (!data.tipoRelacion) return 'Indica tu relacion con el complejo';
    if (!data.nombreSolicitante) return 'Indica el nombre de la persona responsable';
    if (!data.telefonoSolicitante) return 'Indica un telefono de contacto';
    if (!data.correoSolicitante) return 'Indica un correo de contacto';
    if (!data.nombreComercial) return 'Indica el nombre comercial del complejo';
    if (!data.pruebaControl) return 'Describe la evidencia que demuestra tu relacion con el complejo';
    return null;
};

const userAlreadyManagesComplex = (usuarioId, complejo = {}) => {
    const requester = String(usuarioId || '');
    if (!requester) return false;

    if (String(complejo.administrador || '') === requester) {
        return true;
    }

    return (complejo.administradores || [])
        .some((item) => String(item || '') === requester);
};

const crearReclamoComplejo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const usuarioAuth = req.usuarioAuth;

        if (usuarioAuth?.rol === 'ADMIN_GENERAL_ROL') {
            return res.status(403).json({
                ok: false,
                error: 'El administrador general no necesita reclamar complejos',
            });
        }

        const complejo = await Complejo.findById(id);
        if (!complejo || complejo.estado === false) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado',
            });
        }

        if (userAlreadyManagesComplex(usuarioAuth._id, complejo)) {
            return res.status(400).json({
                ok: false,
                error: 'Ya administras este complejo',
            });
        }

        if (complejo.propiedadVerificada || complejo.reclamoEstado === 'verificado') {
            return res.status(409).json({
                ok: false,
                error: 'Este complejo ya tiene administracion verificada',
            });
        }

        const pendingClaim = await ComplexClaim.findOne({
            complejo: id,
            solicitante: usuarioAuth._id,
            estado: 'pendiente',
        }).select('_id');

        if (pendingClaim) {
            return res.status(409).json({
                ok: false,
                error: 'Ya tienes un reclamo pendiente para este complejo',
            });
        }

        const payload = normalizeClaimPayload(req.body, usuarioAuth);
        payload.nombreComercial = payload.nombreComercial || trimText(complejo.nombre);

        const validationError = validateClaimPayload(payload);
        if (validationError) {
            return res.status(400).json({
                ok: false,
                error: validationError,
            });
        }

        const claim = new ComplexClaim({
            complejo: complejo._id,
            solicitante: usuarioAuth._id,
            ...payload,
        });

        await claim.save();

        const uploadedUrl = await uploadClaimDocumentIfPresent({
            file: req.file,
            claimId: claim._id,
        });

        if (uploadedUrl) {
            claim.documentoRespaldoUrl = uploadedUrl;
            await claim.save();
        }

        complejo.reclamoEstado = 'pendiente';
        await complejo.save();

        const populated = await populateClaim(ComplexClaim.findById(claim._id));

        return res.status(201).json({
            ok: true,
            reclamo: serializeClaim(populated),
            msg: 'Reclamo enviado para revision',
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerMisReclamosComplejo = async (req = request, res = response) => {
    try {
        const reclamos = await populateClaim(
            ComplexClaim.find({ solicitante: req.usuarioAuth._id })
                .sort({ createdAt: -1 })
        );

        return res.status(200).json({
            ok: true,
            reclamos: reclamos.map(serializeClaim),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerReclamosComplejoAdmin = async (req = request, res = response) => {
    try {
        const { estado = '', desde = 0, limit = 30 } = req.query;
        const query = {};

        if (['pendiente', 'aprobado', 'rechazado'].includes(String(estado))) {
            query.estado = estado;
        }

        const [total, reclamos] = await Promise.all([
            ComplexClaim.countDocuments(query),
            populateClaim(
                ComplexClaim.find(query)
                    .sort({ createdAt: -1 })
                    .skip(Number(desde))
                    .limit(Number(limit))
            ),
        ]);

        return res.status(200).json({
            ok: true,
            total,
            reclamos: reclamos.map(serializeClaim),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const revisarReclamoComplejo = async (req = request, res = response) => {
    try {
        const { id } = req.params;
        const estado = trimText(req.body.estado);
        const respuestaRevision = trimText(req.body.respuestaRevision || req.body.observaciones);

        if (!['aprobado', 'rechazado'].includes(estado)) {
            return res.status(400).json({
                ok: false,
                error: 'Estado de revision invalido',
            });
        }

        const claim = await ComplexClaim.findById(id);
        if (!claim) {
            return res.status(404).json({
                ok: false,
                error: 'Reclamo no encontrado',
            });
        }

        if (claim.estado !== 'pendiente') {
            return res.status(400).json({
                ok: false,
                error: 'Este reclamo ya fue revisado',
            });
        }

        const [complejo, solicitante] = await Promise.all([
            Complejo.findById(claim.complejo),
            Usuario.findById(claim.solicitante),
        ]);

        if (!complejo || !solicitante) {
            return res.status(404).json({
                ok: false,
                error: 'No fue posible encontrar el complejo o el solicitante',
            });
        }

        const rolAnterior = solicitante.rol;

        claim.estado = estado;
        claim.revisadoPor = req.usuarioAuth._id;
        claim.revisadoAt = new Date();
        claim.respuestaRevision = respuestaRevision;

        if (estado === 'aprobado') {
            const adminIds = new Set((complejo.administradores || []).map((item) => String(item)));
            adminIds.add(String(solicitante._id));

            complejo.administrador = solicitante._id;
            complejo.administradores = Array.from(adminIds);
            complejo.propiedadVerificada = true;
            complejo.reclamoEstado = 'verificado';
            complejo.reclamadoPor = solicitante._id;
            complejo.reclamadoAt = new Date();

            solicitante.complejo = complejo._id;
            if (solicitante.rol === 'USER_ROL') {
                solicitante.rol = 'ADMIN_ROL';
                solicitante.refreshTokenHash = '';

                await RoleChangeAudit.create({
                    actorUsuario: req.usuarioAuth._id,
                    actorCorreo: req.usuarioAuth?.correo || '',
                    usuarioObjetivo: solicitante._id,
                    correoObjetivo: solicitante.correo || '',
                    rolAnterior,
                    rolNuevo: solicitante.rol,
                });
            }

            await Promise.all([
                complejo.save(),
                solicitante.save(),
                ComplexClaim.updateMany(
                    {
                        _id: { $ne: claim._id },
                        complejo: complejo._id,
                        estado: 'pendiente',
                    },
                    {
                        $set: {
                            estado: 'rechazado',
                            revisadoPor: req.usuarioAuth._id,
                            revisadoAt: new Date(),
                            respuestaRevision: 'El complejo fue asignado a otro solicitante verificado.',
                        },
                    }
                ),
            ]);
        } else {
            const activePendingForComplex = await ComplexClaim.countDocuments({
                _id: { $ne: claim._id },
                complejo: complejo._id,
                estado: 'pendiente',
            });

            if (!complejo.propiedadVerificada && activePendingForComplex === 0) {
                complejo.reclamoEstado = 'disponible';
                await complejo.save();
            }
        }

        await claim.save();

        await auditAdminGeneralAction({
            req,
            action: estado === 'aprobado' ? 'APPROVE_COMPLEX_CLAIM' : 'REJECT_COMPLEX_CLAIM',
            resourceType: 'complex_claim',
            resourceId: claim._id,
            targetUsuario: solicitante._id,
            targetCorreo: solicitante.correo || '',
            summary: `${estado === 'aprobado' ? 'Aprobacion' : 'Rechazo'} de reclamo: ${complejo.nombre || ''}`.trim(),
            metadata: {
                complejo: complejo._id,
                complejoNombre: complejo.nombre || '',
                rolAnterior,
                rolNuevo: solicitante.rol,
            },
        });

        const populated = await populateClaim(ComplexClaim.findById(claim._id));

        return res.status(200).json({
            ok: true,
            reclamo: serializeClaim(populated),
            msg: estado === 'aprobado'
                ? 'Reclamo aprobado y complejo asignado'
                : 'Reclamo rechazado',
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    crearReclamoComplejo,
    obtenerMisReclamosComplejo,
    obtenerReclamosComplejoAdmin,
    revisarReclamoComplejo,
};
