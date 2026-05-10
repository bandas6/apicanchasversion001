const { request, response } = require("express");
const Roles = require("../models/roles");
const {
    CATALOGOS_PERFIL,
    POSICIONES_POR_DEPORTE,
    TIPOS_CANCHA_POR_DEPORTE,
    GENERIC_POSITION_OPTIONS,
    GENERIC_COURT_OPTIONS,
} = require("../helpers/profile-catalogs");

const { COMPLEX_REVIEW_TAGS } = require("../models/complex-reviews");
const HOME_FILTER_CATALOGS = {
    ratingOptions: [
        { value: 4.0, label: "4.0+" },
        { value: 4.5, label: "4.5+" },
    ],
    priceOptions: [
        { value: 30000, label: "Hasta $30000" },
        { value: 50000, label: "Hasta $50000" },
        { value: 80000, label: "Hasta $80000" },
    ],
    distanceKmOptions: [
        { value: 2, label: "Hasta 2 km" },
        { value: 5, label: "Hasta 5 km" },
        { value: 10, label: "Hasta 10 km" },
    ],
    scheduleOptions: [
        { value: "openNow", label: "Abierto ahora" },
        { value: "morning", label: "Manana" },
        { value: "afternoon", label: "Tarde" },
        { value: "night", label: "Noche" },
    ],
};

const CENTRO_MENSAJES_CATALOGS = {
    iconOptions: [
        { value: "explore", label: "Explorar" },
        { value: "schedule", label: "Horarios" },
        { value: "groups", label: "Comunidad" },
        { value: "tune", label: "Filtros" },
        { value: "star", label: "Destacado" },
        { value: "campaign", label: "Aviso" },
        { value: "calendar", label: "Calendario" },
        { value: "sports", label: "Deporte" },
    ],
    typeOptions: [
        { value: "TIP", label: "Tip Home" },
        { value: "BANNER", label: "Banner modal" },
        { value: "ALERTA", label: "Alerta flotante" },
        { value: "NOTIFICACION", label: "Notificacion" },
    ],
    ctaOptions: [
        { value: "NONE", label: "Sin accion" },
        { value: "RESERVAS", label: "Ir a reservas" },
        { value: "COMPLEJO", label: "Ir al complejo" },
        { value: "URL", label: "Abrir URL externa" },
    ],
    audienceOptions: [
        { value: "ALL", label: "Todos, sin sesion incluida" },
        { value: "AUTHENTICATED", label: "Solo usuarios autenticados" },
        { value: "USER_ROL", label: "Solo usuarios" },
        { value: "ADMIN_ROL", label: "Solo admins de complejo" },
        { value: "ADMIN_GENERAL_ROL", label: "Solo admin general" },
    ],
    layoutOptions: [
        { value: "SOLO_TEXTO", label: "Solo texto" },
        { value: "IMAGEN_TEXTO", label: "Imagen + texto" },
        { value: "SOLO_IMAGEN", label: "Solo imagen" },
    ],
    positionOptions: [
        { value: "TOP", label: "Superior" },
        { value: "CENTER", label: "Central" },
        { value: "BOTTOM", label: "Inferior" },
    ],
    deliveryOptions: [
        { value: "INMEDIATO", label: "Inmediato" },
        { value: "ROTACION", label: "Rotacion progresiva" },
    ],
    filterScopeOptions: [
        { value: "all", label: "Todos" },
        { value: "GLOBAL", label: "Globales" },
        { value: "COMPLEJO", label: "Complejo" },
    ],
    filterReviewStatusOptions: [
        { value: "all", label: "Todos" },
        { value: "pendiente", label: "Pendiente" },
        { value: "aprobada", label: "Aprobada" },
        { value: "rechazada", label: "Rechazada" },
    ],
    filterVisibilityOptions: [
        { value: "all", label: "Todas" },
        { value: "visible", label: "Visibles" },
        { value: "hidden", label: "Ocultas" },
    ],
};

const ADMIN_RESERVAS_CATALOGS = {
    periodOptions: [
        { value: "activas", label: "Activas" },
        { value: "hoy", label: "Hoy" },
        { value: "historico", label: "Historico" },
        { value: "todas", label: "Todas" },
    ],
    statusOptions: [
        { value: "", label: "Todas" },
        { value: "pendiente", label: "Pendiente" },
        { value: "confirmada", label: "Confirmada" },
        { value: "pendiente_cierre", label: "Pend. cierre" },
        { value: "completada", label: "Completada" },
        { value: "no_show_usuario", label: "No show" },
        { value: "cancelada_tardia_usuario", label: "Canc. tardia" },
        { value: "cancelada_por_complejo", label: "Canc. complejo" },
        { value: "incidencia", label: "Incidencia" },
        { value: "rechazada", label: "Rechazada" },
        { value: "cancelada", label: "Cancelada" },
        { value: "expirada", label: "Expirada" },
    ],
    closureReasonOptions: [
        { value: "completada", label: "Completada" },
        { value: "no_show_usuario", label: "No show del usuario" },
        { value: "cancelada_tardia_usuario", label: "Cancelacion tardia del usuario" },
        { value: "cancelada_por_complejo", label: "Cancelada por el complejo" },
        { value: "incidencia", label: "Incidencia" },
    ],
    attendanceOptions: [
        { value: "asistio", label: "Asistio" },
        { value: "llego_tarde", label: "Llego tarde" },
        { value: "no_asistio", label: "No asistio" },
    ],
    behaviorOptions: [
        { value: "correcto", label: "Correcto" },
        { value: "conflictivo", label: "Conflictivo" },
    ],
};

const MIS_RESERVAS_CATALOGS = {
    filterOptions: [
        { value: "activas", label: "Activas" },
        { value: "pasadas", label: "Pasadas" },
        { value: "cancelada", label: "Canceladas, rechazadas y expiradas" },
    ],
};

const COBERTURA_GEO_CATALOGS = {
    countryOptions: [
        'Colombia',
        'Mexico',
        'Argentina',
        'Chile',
        'Peru',
        'Ecuador',
        'Otro',
    ],
    citiesByCountry: {
        Colombia: [
            'Bogota',
            'Medellin',
            'Cali',
            'Barranquilla',
            'Cartagena',
            'Bucaramanga',
            'Pereira',
            'Manizales',
            'Otro',
        ],
        Mexico: [
            'Ciudad de Mexico',
            'Guadalajara',
            'Monterrey',
            'Puebla',
            'Merida',
            'Queretaro',
            'Otro',
        ],
        Argentina: [
            'Buenos Aires',
            'Cordoba',
            'Rosario',
            'Mendoza',
            'La Plata',
            'Otro',
        ],
        Chile: [
            'Santiago',
            'Valparaiso',
            'Concepcion',
            'La Serena',
            'Antofagasta',
            'Otro',
        ],
        Peru: [
            'Lima',
            'Arequipa',
            'Cusco',
            'Trujillo',
            'Piura',
            'Otro',
        ],
        Ecuador: [
            'Quito',
            'Guayaquil',
            'Cuenca',
            'Manta',
            'Ambato',
            'Otro',
        ],
    },
    countryFilterOptions: [
        { value: 'all', label: 'Todos' },
    ],
};

const COMPLEX_CLAIMS_CATALOGS = {
    statusOptions: [
        { value: 'pendiente', label: 'Pendientes' },
        { value: 'aprobado', label: 'Aprobados' },
        { value: 'rechazado', label: 'Rechazados' },
    ],
};

const ADMIN_USERS_CATALOGS = {
    roleFilterOptions: [
        { value: 'all', label: 'Todos' },
        { value: 'admins', label: 'Solo admins' },
        { value: 'users', label: 'Solo users' },
    ],
};

const REVIEWS_CATALOGS = {
    complexReviewTags: COMPLEX_REVIEW_TAGS.map((item) => ({
        value: item,
        label: item === 'estado_cancha'
            ? 'Estado de cancha'
            : item === 'atencion'
                ? 'Atencion'
                : item === 'puntualidad'
                    ? 'Puntualidad'
                    : 'Limpieza',
    })),
};

const obtenerRoles = async (req = request, res = response) => {
    try {
        const roles = await Roles.find();
        const rolesVisibles = roles.filter((role) => role.rol !== "ADMIN_CANCHAS_ROL");

        return res.status(200).json({
            ok: true,
            roles: rolesVisibles,
        });
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error,
        });
    }
};

const obtenerCatalogosApp = async (req = request, res = response) => {
    try {
        const roles = await Roles.find().select("rol").lean();
        const rolesVisibles = roles
            .map((item) => item?.rol)
            .filter((item) => item && item !== "ADMIN_CANCHAS_ROL");
        const coverageCountryFilterOptions = [
            { value: 'all', label: 'Todos' },
            ...COBERTURA_GEO_CATALOGS.countryOptions
                .filter((item) => item !== 'Otro')
                .map((item) => ({ value: item, label: item })),
        ];

        return res.status(200).json({
            ok: true,
            catalogos: {
                perfil: CATALOGOS_PERFIL,
                perfilDependiente: {
                    posicionesPorDeporte: POSICIONES_POR_DEPORTE,
                    tiposCanchaPorDeporte: TIPOS_CANCHA_POR_DEPORTE,
                    posicionesGenericas: GENERIC_POSITION_OPTIONS,
                    tiposCanchaGenericos: GENERIC_COURT_OPTIONS,
                },
                home: HOME_FILTER_CATALOGS,
                centroMensajes: CENTRO_MENSAJES_CATALOGS,
                adminReservas: ADMIN_RESERVAS_CATALOGS,
                misReservas: MIS_RESERVAS_CATALOGS,
                coberturaGeo: {
                    ...COBERTURA_GEO_CATALOGS,
                    countryFilterOptions: coverageCountryFilterOptions,
                },
                complexClaims: COMPLEX_CLAIMS_CATALOGS,
                adminUsers: ADMIN_USERS_CATALOGS,
                reviews: REVIEWS_CATALOGS,
                roles: rolesVisibles,
            },
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
};

module.exports = {
    obtenerRoles,
    obtenerCatalogosApp,
};
