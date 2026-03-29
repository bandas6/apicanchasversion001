const CATALOGOS_PERFIL = {
    ciudades: [
        'Bogota',
        'Medellin',
        'Cali',
        'Barranquilla',
        'Bucaramanga',
        'Cartagena',
        'Pereira',
        'Manizales',
        'Santa Marta',
        'Cucuta',
    ],
    zonas: ['Norte', 'Sur', 'Centro', 'Occidente', 'Oriente'],
    niveles: ['Principiante', 'Intermedio', 'Avanzado', 'Competitivo'],
    pieDominante: ['Derecho', 'Izquierdo', 'Ambidiestro'],
    estiloJuego: ['Defensivo', 'Equilibrado', 'Ofensivo', 'Tecnico', 'Fisico'],
    disponibilidadHabitual: [
        'Entre semana',
        'Fines de semana',
        'Flexible',
        'Noches',
        'Mananas',
    ],
    horariosPreferidos: ['Manana', 'Mediodia', 'Tarde', 'Noche'],
};

const POSICIONES_POR_DEPORTE = {
    futbol: [
        'Sin preferencia',
        'Arquero',
        'Defensa central',
        'Lateral',
        'Volante',
        'Extremo',
        'Delantero',
    ],
    padel: ['Sin preferencia', 'Drive', 'Reves', 'Sin lado fijo'],
    tenis: ['Sin preferencia', 'Baseliner', 'All court', 'Saque y volea'],
    basket: ['Sin preferencia', 'Base', 'Escolta', 'Alero', 'Ala-pivot', 'Pivot'],
    voley: ['Sin preferencia', 'Armador', 'Central', 'Punta', 'Opuesto', 'Libero'],
};

const TIPOS_CANCHA_POR_DEPORTE = {
    futbol: ['Sintetica', 'Cesped natural', 'Futbol 5', 'Futbol 8'],
    padel: ['Panoramica', 'Muro estandar'],
    tenis: ['Arcilla', 'Cemento', 'Sintetica'],
    basket: ['Madera', 'Cemento'],
    voley: ['Arena', 'Madera', 'Sintetica'],
};

const GENERIC_POSITION_OPTIONS = ['Sin preferencia', 'Defensa', 'Medio', 'Ataque'];
const GENERIC_COURT_OPTIONS = ['Sintetica', 'Cemento', 'Madera', 'Arcilla'];

const normalizeForCompare = (value = '') =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const normalizeCatalogValue = (value, allowedValues = []) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return '';
    }

    const match = allowedValues.find((item) => normalizeForCompare(item) === normalizeForCompare(normalized));
    return match || '';
};

const uniqueStrings = (items = []) =>
    [...new Set(
        items
            .map((item) => String(item || '').trim())
            .filter(Boolean)
    )];

const resolveSportKeys = (sports = []) => {
    const keys = new Set();

    for (const sport of sports) {
        const normalized = normalizeForCompare(sport);
        if (normalized.includes('fut')) keys.add('futbol');
        if (normalized.includes('padel')) keys.add('padel');
        if (normalized.includes('tenis')) keys.add('tenis');
        if (normalized.includes('basket')) keys.add('basket');
        if (normalized.includes('voley')) keys.add('voley');
    }

    return [...keys];
};

const resolveAllowedPositions = (sports = []) => {
    const keys = resolveSportKeys(sports);
    if (!keys.length) {
        return GENERIC_POSITION_OPTIONS;
    }

    return uniqueStrings(keys.flatMap((key) => POSICIONES_POR_DEPORTE[key] || []));
};

const resolveAllowedCourtTypes = (sports = []) => {
    const keys = resolveSportKeys(sports);
    if (!keys.length) {
        return GENERIC_COURT_OPTIONS;
    }

    return uniqueStrings(keys.flatMap((key) => TIPOS_CANCHA_POR_DEPORTE[key] || []));
};

const normalizeScheduleValues = (value) => {
    if (value == null || value === '') {
        return [];
    }

    const rawValues = Array.isArray(value)
        ? value
        : String(value)
            .split(',')
            .map((item) => item.trim());

    return uniqueStrings(
        rawValues
            .map((item) => normalizeCatalogValue(item, CATALOGOS_PERFIL.horariosPreferidos))
            .filter(Boolean)
    );
};

module.exports = {
    CATALOGOS_PERFIL,
    normalizeForCompare,
    normalizeCatalogValue,
    normalizeScheduleValues,
    resolveAllowedPositions,
    resolveAllowedCourtTypes,
    uniqueStrings,
};
