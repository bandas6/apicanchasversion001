const { request, response } = require("express");
const Canchas = require("../models/canchas");
const Complejos = require("../models/complejos");
const Deporte = require("../models/deportes");
const { auditAdminGeneralAction } = require("../helpers/audit-admin-general");
const { uploadBufferToCloudinary } = require("../helpers/cloudinary");
require("../models/deportes");

const parseHourToMinutes = (value = '') => {
    const [hour = '0', minute = '0'] = String(value).split(':');
    return (Number(hour) * 60) + Number(minute);
};

const formatMinutesToHour = (value = 0) => {
    const total = Math.max(0, Number(value) || 0);
    const hour = String(Math.floor(total / 60)).padStart(2, '0');
    const minute = String(total % 60).padStart(2, '0');
    return `${hour}:${minute}`;
};

const hasOwn = (payload = {}, fieldName = '') =>
    Object.prototype.hasOwnProperty.call(payload, fieldName);

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

const parseJsonField = (payload, fieldName, fallback) => {
    if (typeof payload[fieldName] !== 'string') {
        return fallback;
    }

    try {
        return JSON.parse(payload[fieldName]);
    } catch (_) {
        return fallback;
    }
};

const normalizeCanchaPayload = (payload = {}) => {
    const normalized = { ...payload };

    const tarifasFromJson = parseJsonField(normalized, 'tarifasJson', null);
    if (Array.isArray(tarifasFromJson)) {
        normalized.tarifas = tarifasFromJson;
    }

    const tarifasEspecialesFromJson = parseJsonField(
        normalized,
        'tarifasEspecialesJson',
        null,
    );
    if (Array.isArray(tarifasEspecialesFromJson)) {
        normalized.tarifasEspeciales = tarifasEspecialesFromJson;
    }

    const disponibilidadFromJson = parseJsonField(
        normalized,
        'disponibilidadSemanalJson',
        null,
    );
    if (Array.isArray(disponibilidadFromJson)) {
        normalized.disponibilidadSemanal = disponibilidadFromJson;
    }

    const bloquesNoDisponiblesFromJson = parseJsonField(
        normalized,
        'bloquesNoDisponiblesJson',
        null,
    );
    if (Array.isArray(bloquesNoDisponiblesFromJson)) {
        normalized.bloquesNoDisponibles = bloquesNoDisponiblesFromJson;
    }

    const slotConfig = parseJsonField(normalized, 'slotConfigJson', null);
    if (slotConfig && typeof slotConfig === 'object' && !Array.isArray(slotConfig)) {
        Object.assign(normalized, slotConfig);
    }

    const imagenesActuales = parseJsonField(normalized, 'imagenesActualesJson', null);
    if (Array.isArray(imagenesActuales)) {
        normalized.imagenes = imagenesActuales
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    } else if (Array.isArray(normalized.imagenes)) {
        normalized.imagenes = normalized.imagenes
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    if (typeof normalized.activa === 'string') {
        normalized.activa = normalized.activa === 'true';
    }

    if (typeof normalized.enMantenimiento === 'string') {
        normalized.enMantenimiento = normalized.enMantenimiento === 'true';
    }

    if (normalized.capacidad !== undefined && normalized.capacidad !== '') {
        normalized.capacidad = Number(normalized.capacidad);
    }

    if (normalized.precioHora !== undefined && normalized.precioHora !== '') {
        normalized.precioHora = Number(normalized.precioHora);
    }

    if (normalized.precioHoraBase !== undefined && normalized.precioHoraBase !== '') {
        normalized.precioHoraBase = Number(normalized.precioHoraBase);
    }

    return normalized;
};

const normalizePositiveMinutes = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.round(parsed);
};

const resolveReservationConfig = (payload = {}, fallbackConfig = {}) => {
    const fallback = {
        duracionSlotMinutos: normalizePositiveMinutes(fallbackConfig.duracionSlotMinutos, 60),
        pasoSlotMinutos: normalizePositiveMinutes(
            fallbackConfig.pasoSlotMinutos,
            normalizePositiveMinutes(fallbackConfig.duracionSlotMinutos, 60),
        ),
        reservaMinimaMinutos: normalizePositiveMinutes(
            fallbackConfig.reservaMinimaMinutos,
            normalizePositiveMinutes(fallbackConfig.duracionSlotMinutos, 60),
        ),
        reservaMaximaMinutos: normalizePositiveMinutes(
            fallbackConfig.reservaMaximaMinutos,
            Math.max(
                normalizePositiveMinutes(fallbackConfig.duracionSlotMinutos, 60),
                normalizePositiveMinutes(
                    fallbackConfig.reservaMinimaMinutos,
                    normalizePositiveMinutes(fallbackConfig.duracionSlotMinutos, 60),
                ),
            ),
        ),
    };

    const duracionSlotMinutos = normalizePositiveMinutes(
        payload.duracionSlotMinutos,
        fallback.duracionSlotMinutos,
    );
    const pasoSlotMinutos = normalizePositiveMinutes(
        payload.pasoSlotMinutos,
        fallback.pasoSlotMinutos || duracionSlotMinutos,
    );
    const reservaMinimaMinutos = normalizePositiveMinutes(
        payload.reservaMinimaMinutos,
        fallback.reservaMinimaMinutos || duracionSlotMinutos,
    );
    const reservaMaximaMinutos = normalizePositiveMinutes(
        payload.reservaMaximaMinutos,
        fallback.reservaMaximaMinutos || Math.max(duracionSlotMinutos, reservaMinimaMinutos),
    );

    return {
        duracionSlotMinutos,
        pasoSlotMinutos,
        reservaMinimaMinutos,
        reservaMaximaMinutos,
    };
};

const validateReservationConfig = ({
    duracionSlotMinutos,
    pasoSlotMinutos,
    reservaMinimaMinutos,
    reservaMaximaMinutos,
}) => {
    if (duracionSlotMinutos < 30) {
        return 'La duracion del slot debe ser de al menos 30 minutos';
    }

    if (pasoSlotMinutos < 30) {
        return 'El paso entre slots debe ser de al menos 30 minutos';
    }

    if (reservaMinimaMinutos < duracionSlotMinutos) {
        return 'La reserva minima no puede ser menor a la duracion del slot';
    }

    if (reservaMaximaMinutos < reservaMinimaMinutos) {
        return 'La reserva maxima no puede ser menor a la reserva minima';
    }

    if (reservaMinimaMinutos % duracionSlotMinutos !== 0) {
        return 'La reserva minima debe ser multiplo de la duracion del slot';
    }

    if (reservaMaximaMinutos % duracionSlotMinutos !== 0) {
        return 'La reserva maxima debe ser multiplo de la duracion del slot';
    }

    return null;
};

const validateDisponibilidadSemanal = (disponibilidad = []) => {
    if (!Array.isArray(disponibilidad)) {
        return 'La disponibilidad semanal debe ser una lista';
    }

    if (disponibilidad.length === 0) {
        return 'Debes definir al menos un horario base disponible';
    }

    const groupedByDay = new Map();

    for (const bloque of disponibilidad) {
        const diaSemana = Number(bloque?.diaSemana);
        const horaInicio = bloque?.horaInicio;
        const horaFin = bloque?.horaFin;

        if (!diaSemana || diaSemana < 1 || diaSemana > 7) {
            return 'Cada bloque de disponibilidad debe tener un diaSemana valido entre 1 y 7';
        }

        if (!horaInicio || !horaFin) {
            return 'Cada bloque de disponibilidad debe incluir horaInicio y horaFin';
        }

        const inicio = parseHourToMinutes(horaInicio);
        const fin = parseHourToMinutes(horaFin);

        if (fin <= inicio) {
            return `La disponibilidad del dia ${diaSemana} tiene un rango horario invalido`;
        }

        const dayBlocks = groupedByDay.get(diaSemana) ?? [];
        dayBlocks.push({ inicio, fin });
        groupedByDay.set(diaSemana, dayBlocks);
    }

    for (const [, dayBlocks] of groupedByDay.entries()) {
        dayBlocks.sort((a, b) => a.inicio - b.inicio);
        for (let i = 1; i < dayBlocks.length; i++) {
            if (dayBlocks[i].inicio < dayBlocks[i - 1].fin) {
                return 'Existen bloques de disponibilidad solapados en el mismo dia';
            }
        }
    }

    return null;
};

const buildDisponibilidadFromTarifas = (tarifas = []) => {
    const groupedByDay = new Map();

    for (const tarifa of tarifas) {
        const diaSemana = Number(tarifa?.diaSemana);
        const horaInicio = tarifa?.horaInicio;
        const horaFin = tarifa?.horaFin;

        if (!diaSemana || diaSemana < 1 || diaSemana > 7 || !horaInicio || !horaFin) {
            continue;
        }

        const inicio = parseHourToMinutes(horaInicio);
        const fin = parseHourToMinutes(horaFin);
        if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
            continue;
        }

        const items = groupedByDay.get(diaSemana) ?? [];
        items.push({ inicio, fin });
        groupedByDay.set(diaSemana, items);
    }

    const disponibilidad = [];

    for (const [diaSemana, items] of groupedByDay.entries()) {
        items.sort((a, b) => a.inicio - b.inicio);
        let current = null;

        for (const item of items) {
            if (!current) {
                current = { ...item };
                continue;
            }

            if (item.inicio <= current.fin) {
                current.fin = Math.max(current.fin, item.fin);
                continue;
            }

            disponibilidad.push({
                diaSemana,
                horaInicio: formatMinutesToHour(current.inicio),
                horaFin: formatMinutesToHour(current.fin),
                disponible: true,
            });
            current = { ...item };
        }

        if (current) {
            disponibilidad.push({
                diaSemana,
                horaInicio: formatMinutesToHour(current.inicio),
                horaFin: formatMinutesToHour(current.fin),
                disponible: true,
            });
        }
    }

    return disponibilidad.sort((a, b) => (
        a.diaSemana - b.diaSemana ||
        parseHourToMinutes(a.horaInicio) - parseHourToMinutes(b.horaInicio)
    ));
};

const resolvePrecioHoraBase = ({ payload = {}, tarifas = [] }) => {
    const explicit = Number(payload.precioHoraBase ?? payload.precioHora);
    if (Number.isFinite(explicit) && explicit > 0) {
        return explicit;
    }

    const positivos = tarifas
        .map((item) => Number(item?.precio))
        .filter((item) => Number.isFinite(item) && item > 0)
        .sort((a, b) => a - b);

    return positivos[0] ?? 0;
};

const resolveDisponibilidadSemanal = ({
    payload = {},
    tarifas = [],
    existingCancha = null,
}) => {
    if (Array.isArray(payload.disponibilidadSemanal)) {
        return payload.disponibilidadSemanal;
    }

    if (tarifas.length > 0) {
        return buildDisponibilidadFromTarifas(tarifas);
    }

    return Array.isArray(existingCancha?.disponibilidadSemanal)
        ? existingCancha.disponibilidadSemanal
        : null;
};

const shouldPersistReservationConfig = (payload = {}) => (
    hasOwn(payload, 'duracionSlotMinutos') ||
    hasOwn(payload, 'pasoSlotMinutos') ||
    hasOwn(payload, 'reservaMinimaMinutos') ||
    hasOwn(payload, 'reservaMaximaMinutos')
);

const validateTarifas = (tarifas = []) => {
    if (!Array.isArray(tarifas)) {
        return 'Las tarifas deben ser una lista';
    }

    const groupedByDay = new Map();

    for (const tarifa of tarifas) {
        const diaSemana = Number(tarifa?.diaSemana);
        const horaInicio = tarifa?.horaInicio;
        const horaFin = tarifa?.horaFin;
        const precio = Number(tarifa?.precio);

        if (!diaSemana || diaSemana < 1 || diaSemana > 7) {
            return 'Cada tarifa debe tener un diaSemana valido entre 1 y 7';
        }

        if (!horaInicio || !horaFin) {
            return 'Cada tarifa debe incluir horaInicio y horaFin';
        }

        if (Number.isNaN(precio) || precio < 0) {
            return 'Cada tarifa debe incluir un precio valido';
        }

        const inicio = parseHourToMinutes(horaInicio);
        const fin = parseHourToMinutes(horaFin);

        if (fin <= inicio) {
            return `La tarifa del dia ${diaSemana} tiene un rango horario invalido`;
        }

        const dayTarifas = groupedByDay.get(diaSemana) ?? [];
        dayTarifas.push({ inicio, fin });
        groupedByDay.set(diaSemana, dayTarifas);
    }

    for (const [, dayTarifas] of groupedByDay.entries()) {
        dayTarifas.sort((a, b) => a.inicio - b.inicio);

        for (let i = 1; i < dayTarifas.length; i++) {
            const previous = dayTarifas[i - 1];
            const current = dayTarifas[i];

            if (current.inicio < previous.fin) {
                return 'Existen tarifas con horarios solapados en el mismo dia';
            }
        }
    }

    return null;
};

const validateTarifasEspeciales = (tarifasEspeciales = []) => {
    if (!Array.isArray(tarifasEspeciales)) {
        return 'Las tarifas especiales deben ser una lista';
    }

    const expanded = [];

    for (const tarifa of tarifasEspeciales) {
        const diasSemana = Array.isArray(tarifa?.diasSemana)
            ? tarifa.diasSemana.map((item) => Number(item)).filter((item) => item >= 1 && item <= 7)
            : [];
        const horaInicio = tarifa?.horaInicio;
        const horaFin = tarifa?.horaFin;
        const precio = Number(tarifa?.precio);

        if (diasSemana.length === 0) {
            return 'Cada tarifa especial debe incluir al menos un dia valido entre 1 y 7';
        }

        if (!horaInicio || !horaFin) {
            return 'Cada tarifa especial debe incluir horaInicio y horaFin';
        }

        if (Number.isNaN(precio) || precio < 0) {
            return 'Cada tarifa especial debe incluir un precio valido';
        }

        for (const diaSemana of diasSemana) {
            expanded.push({
                diaSemana,
                horaInicio,
                horaFin,
                precio,
                moneda: tarifa?.moneda || 'COP',
                activo: tarifa?.activo !== false,
            });
        }
    }

    return validateTarifas(expanded);
};

const validateBloquesNoDisponibles = (bloques = []) => {
    if (!Array.isArray(bloques)) {
        return 'Los bloqueos operativos deben ser una lista';
    }

    const grouped = new Map();

    for (const bloque of bloques) {
        if (bloque?.activo === false) {
            continue;
        }

        const fecha = String(bloque?.fecha || '').trim();
        const horaInicio = bloque?.horaInicio;
        const horaFin = bloque?.horaFin;

        if (!fecha) {
            return 'Cada bloqueo operativo debe incluir una fecha';
        }

        if (!horaInicio || !horaFin) {
            return 'Cada bloqueo operativo debe incluir horaInicio y horaFin';
        }

        const inicio = parseHourToMinutes(horaInicio);
        const fin = parseHourToMinutes(horaFin);

        if (fin <= inicio) {
            return 'Cada bloqueo operativo debe tener una hora fin mayor que la hora inicio';
        }

        const key = fecha;
        const items = grouped.get(key) ?? [];
        items.push({ inicio, fin });
        grouped.set(key, items);
    }

    for (const items of grouped.values()) {
        items.sort((a, b) => a.inicio - b.inicio);
        for (let i = 1; i < items.length; i += 1) {
            if (items[i].inicio < items[i - 1].fin) {
                return 'No puede haber bloqueos operativos solapados en la misma fecha';
            }
        }
    }

    return null;
};

const expandTarifasEspeciales = (tarifasEspeciales = []) => {
    const expanded = [];

    for (const tarifa of tarifasEspeciales) {
        const diasSemana = Array.isArray(tarifa?.diasSemana)
            ? tarifa.diasSemana.map((item) => Number(item)).filter((item) => item >= 1 && item <= 7)
            : [];

        for (const diaSemana of diasSemana) {
            expanded.push({
                diaSemana,
                horaInicio: tarifa?.horaInicio,
                horaFin: tarifa?.horaFin,
                precio: Number(tarifa?.precio || 0),
                moneda: tarifa?.moneda || 'COP',
                activo: tarifa?.activo !== false,
            });
        }
    }

    return expanded;
};

const parseJsonField = (value, fallback) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return fallback;
        }

        try {
            return JSON.parse(trimmed);
        } catch (_) {
            return fallback;
        }
    }

    if (value === undefined || value === null) {
        return fallback;
    }

    return value;
};

const normalizeStringList = (value = []) => {
    const source = Array.isArray(value) ? value : parseJsonField(value, []);
    if (!Array.isArray(source)) {
        return [];
    }

    return source
        .map((item) => String(item || '').trim())
        .filter(Boolean);
};

const normalizeBooleanField = (value, fallback) => {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'si', 'sí'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no'].includes(normalized)) {
            return false;
        }
    }

    return fallback;
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

        const url = await uploadImageIfPresent({
            file,
            folder,
            publicId: buildCloudinaryPublicId(publicIdPrefix, index + 1, Date.now()),
        });

        if (url) {
            uploaded.push(url);
        }
    }

    return uploaded;
};

const mergeUniqueImageUrls = (...groups) => {
    const unique = [];
    const seen = new Set();

    for (const group of groups) {
        for (const item of group || []) {
            const normalized = String(item || '').trim();
            if (!normalized || seen.has(normalized)) {
                continue;
            }

            seen.add(normalized);
            unique.push(normalized);
        }
    }

    return unique;
};

const normalizarPayloadCancha = (payload = {}) => {
    const data = { ...payload };
    const tarifas = parseJsonField(data.tarifasJson, parseJsonField(data.tarifas, []));
    const tarifasEspeciales = parseJsonField(
        data.tarifasEspecialesJson,
        parseJsonField(data.tarifasEspeciales, []),
    );
    const disponibilidadSemanal = parseJsonField(
        data.disponibilidadSemanalJson,
        parseJsonField(data.disponibilidadSemanal, []),
    );
    const bloquesNoDisponibles = parseJsonField(
        data.bloquesNoDisponiblesJson,
        parseJsonField(data.bloquesNoDisponibles, []),
    );
    const dias = parseJsonField(data.diasJson, parseJsonField(data.dias, []));
    const slotConfig = parseJsonField(data.slotConfigJson, {});

    if (slotConfig && typeof slotConfig === 'object' && !Array.isArray(slotConfig)) {
        Object.assign(data, slotConfig);
    }

    data.complejo = String(data.complejoId || data.complejo || '').trim();
    data.tarifas = Array.isArray(tarifas) ? tarifas : [];
    data.tarifasEspeciales = Array.isArray(tarifasEspeciales) ? tarifasEspeciales : [];
    data.disponibilidadSemanal = Array.isArray(disponibilidadSemanal) ? disponibilidadSemanal : [];
    data.bloquesNoDisponibles = Array.isArray(bloquesNoDisponibles) ? bloquesNoDisponibles : [];
    data.dias = Array.isArray(dias) ? dias : [];
    data.imagenesActuales = normalizeStringList(
        parseJsonField(data.imagenesActualesJson, data.imagenesActuales ?? data.imagenes ?? []),
    );

    if (data.capacidad !== undefined) {
        data.capacidad = Number(data.capacidad);
    }

    if (data.precioHora !== undefined) {
        data.precioHora = Number(data.precioHora);
    }

    if (data.precioHoraBase !== undefined) {
        data.precioHoraBase = Number(data.precioHoraBase);
    }

    if ('activa' in data) {
        data.activa = normalizeBooleanField(data.activa, true);
    }

    if ('enMantenimiento' in data) {
        data.enMantenimiento = normalizeBooleanField(data.enMantenimiento, false);
    }

    delete data.complejoId;
    delete data.tarifasJson;
    delete data.tarifasEspecialesJson;
    delete data.disponibilidadSemanalJson;
    delete data.bloquesNoDisponiblesJson;
    delete data.diasJson;
    delete data.slotConfigJson;
    delete data.imagenesActualesJson;

    return data;
};

const resolveDeporte = async (payload = {}) => {
    const rawTipoDeporte = String(payload.tipoDeporte || '').trim();
    const deporteId = payload.deporte || payload.deporteId || null;

    if (deporteId) {
        const deporte = await Deporte.findById(deporteId).select('_id nombre');
        if (deporte) {
            return deporte;
        }
    }

    if (!rawTipoDeporte) {
        return null;
    }

    return Deporte.findOne({
        nombre: new RegExp(`^${rawTipoDeporte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        activo: true,
    }).select('_id nombre');
};

const guardarCancha = async (req = request, res = response) => {
    try {
<<<<<<< HEAD
        const data = normalizarPayloadCancha(req.body);
        const files = req.files || {};
        const portadaFile = Array.isArray(files.portada) ? files.portada[0] : null;
        const galeriaFiles = Array.isArray(files.galeria) ? files.galeria : [];
        const precioHoraBase = Number(data.precioHoraBase ?? data.precioHora ?? 0);
        const reservationConfig = resolveReservationConfig(data);
        const tarifasEspeciales = Array.isArray(data.tarifasEspeciales) ? data.tarifasEspeciales : [];
        const bloquesNoDisponibles = Array.isArray(data.bloquesNoDisponibles) ? data.bloquesNoDisponibles : [];
        const disponibilidadSemanal = Array.isArray(data.disponibilidadSemanal) && data.disponibilidadSemanal.length > 0
            ? data.disponibilidadSemanal
            : buildDisponibilidadFromTarifas(Array.isArray(data.tarifas) ? data.tarifas : []);
=======
        const data = normalizeCanchaPayload(req.body);
        const tarifasEspeciales = Array.isArray(data.tarifasEspeciales) ? data.tarifasEspeciales : [];
        const bloquesNoDisponibles = Array.isArray(data.bloquesNoDisponibles) ? data.bloquesNoDisponibles : [];
>>>>>>> 93d4cfc (sync)
        const tarifasExpandidas = tarifasEspeciales.length > 0
            ? expandTarifasEspeciales(tarifasEspeciales)
            : (Array.isArray(data.tarifas) ? data.tarifas : []);
        const precioHoraBase = resolvePrecioHoraBase({
            payload: data,
            tarifas: tarifasExpandidas,
        });
        const reservationConfig = resolveReservationConfig(data);
        const disponibilidadSemanal = resolveDisponibilidadSemanal({
            payload: data,
            tarifas: tarifasExpandidas,
        });
        const tarifasError = tarifasEspeciales.length > 0
            ? validateTarifasEspeciales(tarifasEspeciales)
            : validateTarifas(data.tarifas ?? []);
        const disponibilidadError = validateDisponibilidadSemanal(disponibilidadSemanal);
        const reservationConfigError = validateReservationConfig(reservationConfig);
        const bloquesError = validateBloquesNoDisponibles(bloquesNoDisponibles);
        const deporte = await resolveDeporte(data);

        if (!data.complejo) {
            return res.status(400).json({
                ok: false,
                error: 'El complejo de la cancha es obligatorio'
            });
        }

        if (tarifasError) {
            return res.status(400).json({
                ok: false,
                error: tarifasError
            });
        }

        if (disponibilidadError) {
            return res.status(400).json({
                ok: false,
                error: disponibilidadError
            });
        }

        if (reservationConfigError) {
            return res.status(400).json({
                ok: false,
                error: reservationConfigError
            });
        }

        if (bloquesError) {
            return res.status(400).json({
                ok: false,
                error: bloquesError
            });
        }

        if (deporte) {
            data.deporte = deporte._id;
            data.tipoDeporte = deporte.nombre;
            data.deportes = [deporte._id];
        }

        const portadaUrl = await uploadImageIfPresent({
            file: portadaFile,
            folder: 'canchas/canchas',
            publicId: buildCloudinaryPublicId('cancha-portada', data.complejo, data.nombre || Date.now()),
        });
        const galeriaUrls = await uploadManyImages({
            files: galeriaFiles,
            folder: 'canchas/canchas',
            publicIdPrefix: buildCloudinaryPublicId('cancha-galeria', data.complejo, data.nombre || Date.now()),
        });
        const imagenes = mergeUniqueImageUrls(
            portadaUrl ? [portadaUrl] : [],
            data.imagenesActuales,
            galeriaUrls,
        );

        data.precioHoraBase = Number.isNaN(precioHoraBase) ? 0 : precioHoraBase;
        data.precioHora = data.precioHoraBase;
        data.tarifasEspeciales = tarifasEspeciales;
        data.tarifas = tarifasExpandidas;
        data.disponibilidadSemanal = disponibilidadSemanal;
        data.bloquesNoDisponibles = bloquesNoDisponibles;
        data.img = portadaUrl || imagenes[0] || '';
        data.imagenes = mergeUniqueImageUrls(data.img ? [data.img] : [], imagenes);
        data.activa = 'activa' in data ? data.activa : true;
        data.enMantenimiento = 'enMantenimiento' in data ? data.enMantenimiento : false;
        Object.assign(data, reservationConfig);
        delete data.imagenesActuales;

        const files = req.files || {};
        const portadaFile = Array.isArray(files.portada) ? files.portada[0] : null;
        const galeriaFiles = Array.isArray(files.galeria) ? files.galeria : [];
        const portadaUrl = await uploadImageIfPresent({
            file: portadaFile,
            folder: 'canchas',
            publicId: buildCloudinaryPublicId(
                'cancha-portada',
                data.nombre || req.usuarioAuth?._id,
                Date.now(),
            ),
        });
        const galeriaUrls = await uploadManyImages({
            files: galeriaFiles,
            folder: 'canchas',
            publicIdPrefix: buildCloudinaryPublicId(
                'cancha-galeria',
                data.nombre || req.usuarioAuth?._id,
            ),
        });

        data.imagenes = mergeUniqueUrls(
            portadaUrl ? [portadaUrl] : [],
            galeriaUrls,
            data.imagenes || [],
        );
        data.img = portadaUrl || data.img || data.imagenes[0] || '';

        const cancha = new Canchas(data);

        await cancha.save();

        await Complejos.findByIdAndUpdate(
            data.complejo,
            {
                $addToSet: {
                    canchas: cancha._id,
                    ...(deporte ? { deportes: deporte._id } : {}),
                },
            },
            { new: true }
        );

        await auditAdminGeneralAction({
            req,
            action: 'CREATE_CANCHA',
            resourceType: 'cancha',
            resourceId: cancha._id,
            summary: `Cancha creada: ${cancha.nombre || ''}`.trim(),
            metadata: {
                complejo: data.complejo,
            },
        });

        return res.status(201).json({
            ok: true,
            cancha
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message
        });
    }
};

const guardarYAgregarCanchaAComplejo = async (req = request, res = response) => {
    const { id } = req.params;
    const canchasData = req.body;

    try {
        const complejo = await Complejos.findById(id).populate('canchas', 'nombre direccion');

        if (!complejo) {
            return res.status(404).json({
                ok: false,
                msg: 'Complejo no encontrado'
            });
        }

        const canchasExistentesIds = complejo.canchas.map((cancha) => cancha._id.toString());
        const nuevasCanchasIds = [];

        const promesasCanchas = canchasData.map(async (canchaData) => {
            if (canchaData._id && canchasExistentesIds.includes(canchaData._id)) {
                return canchaData._id;
            }

            const nuevaCancha = new Canchas({ ...canchaData, complejo: id });
            const canchaGuardada = await nuevaCancha.save();
            nuevasCanchasIds.push(canchaGuardada._id);
            return canchaGuardada._id;
        });

        await Promise.all(promesasCanchas);

        const canchasTotalesIds = [...canchasExistentesIds, ...nuevasCanchasIds];

        const complejoActualizado = await Complejos.findByIdAndUpdate(
            id,
            { canchas: canchasTotalesIds },
            { new: true }
        ).populate('canchas', 'nombre direccion');

        return res.status(200).json({
            ok: true,
            complejo: complejoActualizado,
            canchas: canchasTotalesIds
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const actualizarCancha = async (req = request, res = response) => {
    const { id } = req.params;
<<<<<<< HEAD

    try {
        const canchaActual = await Canchas.findById(id).select('img imagenes complejo');
=======
    const data = normalizeCanchaPayload(req.body);

    try {
        const canchaActual = await Canchas.findById(id);
>>>>>>> 93d4cfc (sync)

        if (!canchaActual) {
            return res.status(404).json({
                ok: false,
                msg: 'Cancha no encontrada'
            });
        }

<<<<<<< HEAD
        const data = normalizarPayloadCancha(req.body);
        const files = req.files || {};
        const portadaFile = Array.isArray(files.portada) ? files.portada[0] : null;
        const galeriaFiles = Array.isArray(files.galeria) ? files.galeria : [];
        const hasTarifasPayload = (
            'tarifas' in req.body ||
            'tarifasJson' in req.body ||
            'tarifasEspeciales' in req.body ||
            'tarifasEspecialesJson' in req.body
        );
        const hasDisponibilidadPayload = (
            'disponibilidadSemanal' in req.body ||
            'disponibilidadSemanalJson' in req.body
        );
        const hasBloquesPayload = (
            'bloquesNoDisponibles' in req.body ||
            'bloquesNoDisponiblesJson' in req.body
        );
        const hasSlotConfigPayload = (
            'duracionSlotMinutos' in req.body ||
            'pasoSlotMinutos' in req.body ||
            'reservaMinimaMinutos' in req.body ||
            'reservaMaximaMinutos' in req.body ||
            'slotConfigJson' in req.body
        );
        const hasExplicitImageState = (
            'imagenesActualesJson' in req.body ||
            'imagenesActuales' in req.body ||
            'imagenes' in req.body
        );
        const precioHoraBase = Number(data.precioHoraBase ?? data.precioHora ?? 0);
        const reservationConfig = resolveReservationConfig(data);
        const tarifasEspeciales = Array.isArray(data.tarifasEspeciales) ? data.tarifasEspeciales : [];
        const bloquesNoDisponibles = Array.isArray(data.bloquesNoDisponibles) ? data.bloquesNoDisponibles : [];
        const disponibilidadSemanal = hasDisponibilidadPayload && Array.isArray(data.disponibilidadSemanal)
            ? data.disponibilidadSemanal
            : null;
        const tarifasExpandidas = tarifasEspeciales.length > 0
            ? expandTarifasEspeciales(tarifasEspeciales)
            : (Array.isArray(data.tarifas) ? data.tarifas : []);
        const tarifasError = hasTarifasPayload
            ? (tarifasEspeciales.length > 0
                ? validateTarifasEspeciales(tarifasEspeciales)
                : validateTarifas(data.tarifas ?? []))
            : null;
=======
        const tarifasEspeciales = Array.isArray(data.tarifasEspeciales) ? data.tarifasEspeciales : [];
        const bloquesNoDisponibles = Array.isArray(data.bloquesNoDisponibles) ? data.bloquesNoDisponibles : [];
        const tarifasExpandidas = tarifasEspeciales.length > 0
            ? expandTarifasEspeciales(tarifasEspeciales)
            : (Array.isArray(data.tarifas) ? data.tarifas : []);
        const precioHoraBase = resolvePrecioHoraBase({
            payload: data,
            tarifas: tarifasExpandidas,
        });
        const reservationConfig = resolveReservationConfig(data, canchaActual);
        const disponibilidadSemanal = resolveDisponibilidadSemanal({
            payload: data,
            tarifas: tarifasExpandidas,
            existingCancha: canchaActual,
        });
        const tarifasError = tarifasEspeciales.length > 0
            ? validateTarifasEspeciales(tarifasEspeciales)
            : validateTarifas(data.tarifas ?? []);
>>>>>>> 93d4cfc (sync)
        const disponibilidadError = Array.isArray(disponibilidadSemanal)
            ? validateDisponibilidadSemanal(disponibilidadSemanal)
            : null;
        const reservationConfigError = hasSlotConfigPayload
            ? validateReservationConfig(reservationConfig)
            : null;
        const bloquesError = hasBloquesPayload
            ? validateBloquesNoDisponibles(bloquesNoDisponibles)
            : null;
        const deporte = await resolveDeporte(data);

        if (tarifasError) {
            return res.status(400).json({
                ok: false,
                error: tarifasError
            });
        }

        if (disponibilidadError) {
            return res.status(400).json({
                ok: false,
                error: disponibilidadError
            });
        }

        if (reservationConfigError) {
            return res.status(400).json({
                ok: false,
                error: reservationConfigError
            });
        }

        if (bloquesError) {
            return res.status(400).json({
                ok: false,
                error: bloquesError
            });
        }

        if (deporte) {
            data.deporte = deporte._id;
            data.tipoDeporte = deporte.nombre;
            data.deportes = [deporte._id];
        }

<<<<<<< HEAD
        const currentImages = mergeUniqueImageUrls(
            canchaActual.img ? [canchaActual.img] : [],
            canchaActual.imagenes,
        );
        const requestedImages = hasExplicitImageState ? data.imagenesActuales : currentImages;
        const portadaUrl = await uploadImageIfPresent({
            file: portadaFile,
            folder: 'canchas/canchas',
            publicId: buildCloudinaryPublicId('cancha-portada', id, Date.now()),
        });
        const galeriaUrls = await uploadManyImages({
            files: galeriaFiles,
            folder: 'canchas/canchas',
            publicIdPrefix: buildCloudinaryPublicId('cancha-galeria', id, Date.now()),
        });
        const mergedRequestedImages = mergeUniqueImageUrls(requestedImages, galeriaUrls);
        const requestedCover = String(data.img || '').trim();
        const resolvedCover = portadaUrl
            || requestedCover
            || (hasExplicitImageState ? (mergedRequestedImages[0] || '') : (canchaActual.img || mergedRequestedImages[0] || ''));

        data.complejo = data.complejo || canchaActual.complejo?.toString() || '';
        data.img = resolvedCover;
        data.imagenes = mergeUniqueImageUrls(
            resolvedCover ? [resolvedCover] : [],
            mergedRequestedImages,
        );

        if ('precioHora' in data || 'precioHoraBase' in data) {
=======
        if (
            hasOwn(data, 'precioHora') ||
            hasOwn(data, 'precioHoraBase') ||
            Array.isArray(data.tarifas) ||
            tarifasEspeciales.length > 0
        ) {
>>>>>>> 93d4cfc (sync)
            data.precioHoraBase = Number.isNaN(precioHoraBase) ? 0 : precioHoraBase;
            data.precioHora = data.precioHoraBase;
        }
        if (hasTarifasPayload) {
            data.tarifasEspeciales = tarifasEspeciales;
            data.tarifas = tarifasExpandidas;
        }
        if (Array.isArray(disponibilidadSemanal)) {
            data.disponibilidadSemanal = disponibilidadSemanal;
        }
        if (hasBloquesPayload) {
            data.bloquesNoDisponibles = bloquesNoDisponibles;
        }
<<<<<<< HEAD
        if (hasSlotConfigPayload) {
            Object.assign(data, reservationConfig);
        }

        delete data.imagenesActuales;
=======
        if (shouldPersistReservationConfig(data)) {
            Object.assign(data, reservationConfig);
        }

        const files = req.files || {};
        const portadaFile = Array.isArray(files.portada) ? files.portada[0] : null;
        const galeriaFiles = Array.isArray(files.galeria) ? files.galeria : [];
        const portadaUrl = await uploadImageIfPresent({
            file: portadaFile,
            folder: 'canchas',
            publicId: buildCloudinaryPublicId('cancha-portada', id, Date.now()),
        });
        const galeriaUrls = await uploadManyImages({
            files: galeriaFiles,
            folder: 'canchas',
            publicIdPrefix: buildCloudinaryPublicId('cancha-galeria', id),
        });

        data.imagenes = mergeUniqueUrls(
            portadaUrl ? [portadaUrl] : [],
            galeriaUrls,
            data.imagenes ?? canchaActual.imagenes ?? [],
        );
        data.img = portadaUrl || data.img || canchaActual.img || data.imagenes[0] || '';
>>>>>>> 93d4cfc (sync)

        const canchaActualizada = await Canchas.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        )
            .populate('complejo')
            .populate('deporte')
            .populate('deportes');

        if (deporte && canchaActualizada.complejo) {
            await Complejos.findByIdAndUpdate(
                canchaActualizada.complejo,
                { $addToSet: { deportes: deporte._id } },
                { new: true }
            );
        }

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_CANCHA',
            resourceType: 'cancha',
            resourceId: canchaActualizada._id,
            summary: `Cancha actualizada: ${canchaActualizada.nombre || ''}`.trim(),
            metadata: {
                camposActualizados: Object.keys(data),
            },
        });

        return res.status(200).json({
            ok: true,
            cancha: canchaActualizada
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const obtenerCanchas = async (req = request, res = response) => {
    const query = { eliminado: false };
    const { desde = 0, limit = 20, complejo } = req.query;

    if (complejo) {
        query.complejo = complejo;
    }

    try {
        const [total, canchas] = await Promise.all([
            Canchas.countDocuments(query),
            Canchas.find(query)
                .skip(Number(desde))
                .limit(Number(limit))
                .populate('complejo')
                .populate('deporte')
                .populate('deportes')
        ]);

        return res.status(200).json({
            ok: true,
            total,
            canchas
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const obtenerCancha = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const cancha = await Canchas.findById(id)
            .populate('complejo')
            .populate('deporte')
            .populate('deportes');

        if (!cancha) {
            return res.status(404).json({
                ok: false,
                error: 'Cancha no encontrada'
            });
        }

        return res.status(200).json({
            ok: true,
            total: 1,
            cancha
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};

const eliminarCancha = async (req = request, res = response) => {
    const { id } = req.params;

    try {
        const canchaEliminada = await Canchas.findByIdAndUpdate(
            id,
            { eliminado: true, activa: false },
            { new: true }
        );

        if (!canchaEliminada) {
            return res.status(404).json({
                ok: false,
                msg: 'Cancha no encontrada'
            });
        }

        await auditAdminGeneralAction({
            req,
            action: 'DELETE_CANCHA',
            resourceType: 'cancha',
            resourceId: canchaEliminada._id,
            summary: `Cancha desactivada: ${canchaEliminada.nombre || ''}`.trim(),
        });

        return res.status(200).json({
            ok: true,
            cancha: canchaEliminada
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

module.exports = {
    guardarCancha,
    obtenerCanchas,
    obtenerCancha,
    guardarYAgregarCanchaAComplejo,
    actualizarCancha,
    eliminarCancha
}
