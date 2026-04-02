const { request, response } = require("express");
const Complejos = require("../models/complejos");
const Canchas = require("../models/canchas");
const Reservas = require("../models/reservas");
const { auditAdminGeneralAction } = require("../helpers/audit-admin-general");
const { uploadBufferToCloudinary } = require("../helpers/cloudinary");
require("../models/deportes");

const normalizarPayloadComplejo = (data = {}) => {
    const payload = { ...data };
    const latitudNumerica = Number(payload.latitud);
    const longitudNumerica = Number(payload.longitud);

    if (payload.telefonoContacto === '' || payload.telefonoContacto === undefined) {
        delete payload.telefonoContacto;
    } else if (payload.telefonoContacto !== null) {
        payload.telefonoContacto = String(payload.telefonoContacto).trim();
    }

    if (payload.whatsappContacto === '' || payload.whatsappContacto === undefined) {
        delete payload.whatsappContacto;
    } else if (payload.whatsappContacto !== null) {
        payload.whatsappContacto = String(payload.whatsappContacto).trim();
    }

    if (
        (!payload.ubicacionGeo || typeof payload.ubicacionGeo !== 'object') &&
        Number.isFinite(latitudNumerica) &&
        Number.isFinite(longitudNumerica)
    ) {
        payload.ubicacionGeo = {
            lat: latitudNumerica,
            lng: longitudNumerica,
        };
    }

    if (payload.administradores?.length) {
        payload.administradores = payload.administradores;
    } else if (payload.administrador) {
        payload.administradores = [payload.administrador];
    }

    if (payload.rating === '' || payload.rating === undefined) {
        delete payload.rating;
    } else if (payload.rating !== null) {
        payload.rating = Number(payload.rating);
    }

    if (payload.totalResenas === '' || payload.totalResenas === undefined) {
        delete payload.totalResenas;
    } else if (payload.totalResenas !== null) {
        payload.totalResenas = Number(payload.totalResenas);
    }

    if (
        payload.maxReservasPorUsuarioPorDia === '' ||
        payload.maxReservasPorUsuarioPorDia === undefined
    ) {
        delete payload.maxReservasPorUsuarioPorDia;
    } else if (payload.maxReservasPorUsuarioPorDia !== null) {
        payload.maxReservasPorUsuarioPorDia = Number(payload.maxReservasPorUsuarioPorDia);
    }

    if (typeof payload.imagenesActualesJson === 'string') {
        try {
            const parsed = JSON.parse(payload.imagenesActualesJson);
            payload.imagenes = Array.isArray(parsed)
                ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
                : [];
        } catch (_) {
            payload.imagenes = [];
        }
    } else if (Array.isArray(payload.imagenes)) {
        payload.imagenes = payload.imagenes
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    return payload;
};

const buildCloudinaryPublicId = (...parts) =>
    parts
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .join('-')
        .replace(/[^a-zA-Z0-9-_]/g, '_');

const uploadImageIfPresent = async ({ file, folder, publicId }) => {
    if (!file?.buffer) {
        return null;
    }

    const result = await uploadBufferToCloudinary({
        buffer: file.buffer,
        folder,
        publicId,
    });

    return result?.secure_url || '';
};

const uploadManyImages = async ({ files = [], folder, publicIdPrefix }) => {
    const uploaded = [];

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file?.buffer) continue;

        const secureUrl = await uploadImageIfPresent({
            file,
            folder,
            publicId: buildCloudinaryPublicId(publicIdPrefix, Date.now(), index),
        });

        if (secureUrl) {
            uploaded.push(secureUrl);
        }
    }

    return uploaded;
};

const mergeUniqueUrls = (...collections) => {
    const seen = new Set();
    const merged = [];

    for (const collection of collections) {
        for (const rawItem of collection || []) {
            const item = String(rawItem || '').trim();
            if (!item || seen.has(item)) continue;
            seen.add(item);
            merged.push(item);
        }
    }

    return merged;
};

const resolveComplejoCover = ({
    uploadedCover = '',
    requestedImages = [],
    uploadedGallery = [],
    currentCover = '',
}) => {
    const requested = requestedImages.map((item) => String(item || '').trim()).filter(Boolean);
    const uploaded = uploadedGallery.map((item) => String(item || '').trim()).filter(Boolean);
    const current = String(currentCover || '').trim();
    const cover = String(uploadedCover || '').trim();

    if (cover) {
        return cover;
    }

    if (current && requested.includes(current)) {
        return current;
    }

    if (requested.length > 0) {
        return requested[0];
    }

    if (uploaded.length > 0) {
        return uploaded[0];
    }

    return '';
};

const parseHourToMinutes = (value = '') => {
    const [hour = '0', minute = '0'] = String(value || '').split(':');
    return (Number(hour) * 60) + Number(minute);
};

const getDayOfWeek = (date) => {
    const jsDay = new Date(date).getDay();
    return jsDay === 0 ? 7 : jsDay;
};

const hasTimeConflict = ({ startA, endA, startB, endB }) => (
    startA < endB && startB < endA
);

const hasAvailableSlotsToday = ({ cancha, reservas = [], now = new Date() }) => {
    if (!cancha || cancha.activa === false || cancha.enMantenimiento === true) {
        return false;
    }

    const diaSemana = getDayOfWeek(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const tarifas = Array.isArray(cancha.tarifas) ? cancha.tarifas : [];
    const disponibilidad = Array.isArray(cancha.disponibilidadSemanal)
        ? cancha.disponibilidadSemanal
        : [];

    const slotsBase = disponibilidad
        .filter((item) => item?.disponible !== false && Number(item?.diaSemana) === diaSemana)
        .map((item) => ({
            horaInicio: item.horaInicio,
            horaFin: item.horaFin,
        }));

    const slots = (slotsBase.length > 0
        ? slotsBase
        : tarifas
            .filter((item) => item?.activo !== false && Number(item?.diaSemana) === diaSemana)
            .map((item) => ({
                horaInicio: item.horaInicio,
                horaFin: item.horaFin,
            })))
        .filter((item) => item.horaInicio && item.horaFin);

    return slots.some((slot) => {
        const startMinutes = parseHourToMinutes(slot.horaInicio);
        const endMinutes = parseHourToMinutes(slot.horaFin);

        if (endMinutes <= currentMinutes) {
            return false;
        }

        const ocupado = reservas.some((item) => {
            if (item.estado !== 'confirmada') {
                return false;
            }

            const existingStart = parseHourToMinutes(item.horaInicio);
            const existingEnd = parseHourToMinutes(item.horaFin);

            return hasTimeConflict({
                startA: startMinutes,
                endA: endMinutes,
                startB: existingStart,
                endB: existingEnd,
            });
        });

        return !ocupado;
    });
};

const attachTodayAvailability = async (complejos = []) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const canchaIds = complejos
        .flatMap((complejo) => (Array.isArray(complejo.canchas) ? complejo.canchas : []))
        .map((cancha) => String(cancha?._id || cancha?.uid || '').trim())
        .filter(Boolean);

    const reservas = canchaIds.length > 0
        ? await Reservas.find({
            cancha: { $in: canchaIds },
            fecha: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            estado: 'confirmada',
        }).select('cancha horaInicio horaFin estado')
        : [];

    const reservasByCancha = reservas.reduce((acc, reserva) => {
        const canchaId = String(reserva.cancha || '').trim();
        if (!canchaId) {
            return acc;
        }

        if (!acc[canchaId]) {
            acc[canchaId] = [];
        }
        acc[canchaId].push(reserva);
        return acc;
    }, {});

    return complejos.map((doc) => {
        const plain = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
        const canchas = Array.isArray(plain.canchas) ? plain.canchas : [];
        plain.disponibleHoy = canchas.some((cancha) => {
            const canchaId = String(cancha?._id || cancha?.uid || '').trim();
            return hasAvailableSlotsToday({
                cancha,
                reservas: reservasByCancha[canchaId] || [],
                now,
            });
        });
        return plain;
    });
};

const guardarComplejo = async (req = request, res = response) => {
    try {
        const data = normalizarPayloadComplejo(req.body);
        const files = req.files || {};
        const portadaFile = Array.isArray(files.portada) ? files.portada[0] : null;
        const galeriaFiles = Array.isArray(files.galeria) ? files.galeria : [];
        data.administrador = req.usuarioAuth._id;
        data.administradores = [req.usuarioAuth._id];
        const portadaUrl = await uploadImageIfPresent({
            file: portadaFile,
            folder: 'canchas/complejos',
            publicId: buildCloudinaryPublicId('complejo-portada', data.nombre || req.usuarioAuth._id, Date.now()),
        });
        const galeriaUrls = await uploadManyImages({
            files: galeriaFiles,
            folder: 'canchas/complejos',
            publicIdPrefix: buildCloudinaryPublicId('complejo-galeria', data.nombre || req.usuarioAuth._id),
        });
        if (portadaUrl) {
            data.img = portadaUrl;
        }
        data.imagenes = mergeUniqueUrls(
            galeriaUrls,
            portadaUrl ? [portadaUrl] : [],
            data.imagenes || [],
        );
        const complejo = new Complejos(data);

        await complejo.save();

        await auditAdminGeneralAction({
            req,
            action: 'CREATE_COMPLEJO',
            resourceType: 'complejo',
            resourceId: complejo._id,
            summary: `Complejo creado: ${complejo.nombre || ''}`.trim(),
        });

        return res.status(201).json({
            ok: true,
            complejo
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const actualizarComplejo = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const data = normalizarPayloadComplejo(req.body);
        const files = req.files || {};
        const portadaFile = Array.isArray(files.portada) ? files.portada[0] : null;
        const galeriaFiles = Array.isArray(files.galeria) ? files.galeria : [];
        const complejoActual = await Complejos.findById(id);

        if (!complejoActual) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado'
            });
        }

        data.administrador = req.usuarioAuth._id;
        data.administradores = [req.usuarioAuth._id];
        const portadaUrl = await uploadImageIfPresent({
            file: portadaFile,
            folder: 'canchas/complejos',
            publicId: buildCloudinaryPublicId('complejo-portada', id, Date.now()),
        });
        const galeriaUrls = await uploadManyImages({
            files: galeriaFiles,
            folder: 'canchas/complejos',
            publicIdPrefix: buildCloudinaryPublicId('complejo-galeria', id),
        });
        data.img = portadaUrl || data.img || complejoActual.img || '';
        data.imagenes = mergeUniqueUrls(
            data.imagenes || [],
            galeriaUrls,
            data.img ? [data.img] : [],
        );
        data.img = resolveComplejoCover({
            uploadedCover: portadaUrl,
            requestedImages: data.imagenes,
            uploadedGallery: galeriaUrls,
            currentCover: complejoActual.img,
        });
        data.imagenes = mergeUniqueUrls(
            data.img ? [data.img] : [],
            data.imagenes,
        );

        const complejo = await Complejos.findByIdAndUpdate(id, data, { new: true })
            .populate('administrador')
            .populate('administradores')
            .populate('deportes')
            .populate('canchas');

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_COMPLEJO',
            resourceType: 'complejo',
            resourceId: complejo._id,
            summary: `Complejo actualizado: ${complejo.nombre || ''}`.trim(),
            metadata: {
                camposActualizados: Object.keys(data),
            },
        });

        return res.status(200).json({
            ok: true,
            complejo
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerComplejos = async (req = request, res = response) => {
    const { desde = 0, limit = 20, administrador } = req.query;
    const query = { estado: true };

    if (administrador) {
        query.$or = [
            { administrador },
            { administradores: administrador },
        ];
    }

    try {
        const [total, complejos] = await Promise.all([
            Complejos.countDocuments(query),
            Complejos.find(query)
                .populate('administrador')
                .populate('administradores')
                .populate('deportes')
                .populate('canchas')
                .skip(Number(desde))
                .limit(Number(limit))
        ]);
        const complejosConDisponibilidad = await attachTodayAvailability(complejos);

        return res.status(200).json({
            ok: true,
            total,
            complejos: complejosConDisponibilidad
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerComplejo = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const complejo = await Complejos.findById(id)
            .populate('administrador')
            .populate('administradores')
            .populate('deportes')
            .populate('canchas');
        const [complejoConDisponibilidad] = await attachTodayAvailability(
            complejo ? [complejo] : [],
        );

        if (!complejoConDisponibilidad) {
            return res.status(404).json({
                ok: false,
                error: 'Complejo no encontrado'
            });
        }

        return res.status(200).json({
            ok: true,
            total: 1,
            complejo: complejoConDisponibilidad
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerCanchasPorComplejo = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const canchas = await Canchas.find({
            complejo: id,
            eliminado: false,
        })
            .populate('complejo')
            .populate('deporte')
            .populate('deportes');

        return res.status(200).json({
            ok: true,
            total: canchas.length,
            canchas
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

module.exports = {
    guardarComplejo,
    obtenerComplejos,
    obtenerComplejo,
    obtenerCanchasPorComplejo,
    actualizarComplejo
}
