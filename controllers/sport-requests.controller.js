const { request, response } = require('express');
const SportRequest = require('../models/sport-requests');
const Deporte = require('../models/deportes');
const { auditAdminGeneralAction } = require('../helpers/audit-admin-general');

const trimText = (value = '') => String(value || '').trim();

const slugify = (value = '') => String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const populateSportRequest = (query) => query
    .populate('solicitante', 'nombre apellido correo rol')
    .populate('complejo', 'nombre direccion')
    .populate('revisadoPor', 'nombre apellido correo rol')
    .populate('deporteCreado', 'nombre slug activo');

const serializeSportRequest = (item) => {
    const plain = typeof item?.toJSON === 'function' ? item.toJSON() : item;
    return plain || null;
};

const crearSolicitudDeporte = async (req = request, res = response) => {
    try {
        const usuarioAuth = req.usuarioAuth;

        if (usuarioAuth?.rol === 'DEV') {
            return res.status(403).json({
                ok: false,
                error: 'El administrador general puede agregar deportes directamente desde el catalogo',
            });
        }

        const nombre = trimText(req.body?.nombre);
        const descripcion = trimText(req.body?.descripcion);
        const complejoId = trimText(req.body?.complejoId || req.body?.complejo) || null;

        if (!nombre) {
            return res.status(400).json({
                ok: false,
                error: 'Indica el nombre del deporte que quieres solicitar',
            });
        }

        const slug = slugify(nombre);
        const existente = await Deporte.findOne({
            $or: [
                { nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                { slug },
            ],
        }).select('_id nombre activo');

        if (existente) {
            return res.status(409).json({
                ok: false,
                error: existente.activo
                    ? `"${existente.nombre}" ya existe en el catalogo de deportes`
                    : `"${existente.nombre}" ya existe en el catalogo pero esta inactivo; contacta a un superadmin para reactivarlo`,
            });
        }

        const pendingRequest = await SportRequest.findOne({
            solicitante: usuarioAuth._id,
            estado: 'pendiente',
            nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        }).select('_id');

        if (pendingRequest) {
            return res.status(409).json({
                ok: false,
                error: 'Ya tienes una solicitud pendiente para ese deporte',
            });
        }

        const solicitud = new SportRequest({
            nombre,
            descripcion,
            solicitante: usuarioAuth._id,
            complejo: complejoId,
        });

        await solicitud.save();

        const populated = await populateSportRequest(SportRequest.findById(solicitud._id));

        return res.status(201).json({
            ok: true,
            solicitud: serializeSportRequest(populated),
            msg: 'Solicitud enviada. Un superadministrador la revisara pronto.',
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerMisSolicitudesDeporte = async (req = request, res = response) => {
    try {
        const solicitudes = await populateSportRequest(
            SportRequest.find({ solicitante: req.usuarioAuth._id })
                .sort({ createdAt: -1 })
        );

        return res.status(200).json({
            ok: true,
            solicitudes: solicitudes.map(serializeSportRequest),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const obtenerSolicitudesDeporteAdmin = async (req = request, res = response) => {
    try {
        const { estado = '', desde = 0, limit = 30 } = req.query;
        const query = {};

        if (['pendiente', 'aprobado', 'rechazado'].includes(String(estado))) {
            query.estado = estado;
        }

        const [total, solicitudes] = await Promise.all([
            SportRequest.countDocuments(query),
            populateSportRequest(
                SportRequest.find(query)
                    .sort({ createdAt: -1 })
                    .skip(Number(desde))
                    .limit(Number(limit))
            ),
        ]);

        return res.status(200).json({
            ok: true,
            total,
            solicitudes: solicitudes.map(serializeSportRequest),
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

const revisarSolicitudDeporte = async (req = request, res = response) => {
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

        const solicitud = await SportRequest.findById(id);
        if (!solicitud) {
            return res.status(404).json({
                ok: false,
                error: 'Solicitud no encontrada',
            });
        }

        if (solicitud.estado !== 'pendiente') {
            return res.status(400).json({
                ok: false,
                error: 'Esta solicitud ya fue revisada',
            });
        }

        solicitud.estado = estado;
        solicitud.revisadoPor = req.usuarioAuth._id;
        solicitud.revisadoAt = new Date();
        solicitud.respuestaRevision = respuestaRevision;

        if (estado === 'aprobado') {
            const nombre = solicitud.nombre;
            const slug = slugify(nombre);
            const existente = await Deporte.findOne({
                $or: [
                    { nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                    { slug },
                ],
            });

            if (existente) {
                solicitud.deporteCreado = existente._id;
            } else {
                const deporte = new Deporte({
                    nombre,
                    slug,
                    descripcion: solicitud.descripcion || '',
                    activo: true,
                });
                await deporte.save();
                solicitud.deporteCreado = deporte._id;
            }
        }

        await solicitud.save();

        await auditAdminGeneralAction({
            req,
            action: estado === 'aprobado' ? 'APPROVE_SPORT_REQUEST' : 'REJECT_SPORT_REQUEST',
            resourceType: 'sport_request',
            resourceId: solicitud._id,
            targetUsuario: solicitud.solicitante,
            summary: `${estado === 'aprobado' ? 'Aprobacion' : 'Rechazo'} de solicitud de deporte: ${solicitud.nombre}`.trim(),
            metadata: {
                nombre: solicitud.nombre,
                deporteCreado: solicitud.deporteCreado,
            },
        });

        const populated = await populateSportRequest(SportRequest.findById(solicitud._id));

        return res.status(200).json({
            ok: true,
            solicitud: serializeSportRequest(populated),
            msg: estado === 'aprobado'
                ? 'Solicitud aprobada y deporte agregado al catalogo'
                : 'Solicitud rechazada',
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    crearSolicitudDeporte,
    obtenerMisSolicitudesDeporte,
    obtenerSolicitudesDeporteAdmin,
    revisarSolicitudDeporte,
};
