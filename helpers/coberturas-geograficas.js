const CoberturaGeografica = require('../models/coberturas-geograficas');

const normalizeText = (value = '') => String(value || '').trim();

const buildCoverageSlug = ({ pais = '', ciudad = '' }) =>
    `${normalizeText(pais)}-${normalizeText(ciudad)}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const normalizeBounds = (bounds = {}) => {
    const north = Number(bounds.north);
    const south = Number(bounds.south);
    const east = Number(bounds.east);
    const west = Number(bounds.west);

    if (
        !Number.isFinite(north) ||
        !Number.isFinite(south) ||
        !Number.isFinite(east) ||
        !Number.isFinite(west)
    ) {
        throw new Error('Los limites geografico deben ser numericos');
    }

    if (north <= south) {
        throw new Error('El limite norte debe ser mayor que el sur');
    }

    if (east <= west) {
        throw new Error('El limite este debe ser mayor que el oeste');
    }

    return {
        north,
        south,
        east,
        west,
    };
};

const pointWithinBounds = ({ lat, lng, bounds }) => {
    if (!bounds || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return false;
    }

    return (
        lat <= Number(bounds.north) &&
        lat >= Number(bounds.south) &&
        lng <= Number(bounds.east) &&
        lng >= Number(bounds.west)
    );
};

const findActiveCoverageForPoint = async ({ lat, lng }) => {
    const active = await CoberturaGeografica.find({ activo: true });

    if (active.length === 0) {
        return null;
    }

    return active.find((coverage) =>
        pointWithinBounds({
            lat,
            lng,
            bounds: coverage.bounds,
        }),
    ) || null;
};

const ensurePointWithinActiveCoverage = async ({ lat, lng }) => {
    const activeCount = await CoberturaGeografica.countDocuments({ activo: true });
    if (activeCount === 0) {
        return null;
    }

    const matched = await findActiveCoverageForPoint({ lat, lng });
    if (!matched) {
        throw new Error('La ubicacion esta fuera de las ciudades habilitadas');
    }

    return matched;
};

module.exports = {
    buildCoverageSlug,
    normalizeBounds,
    pointWithinBounds,
    ensurePointWithinActiveCoverage,
};
