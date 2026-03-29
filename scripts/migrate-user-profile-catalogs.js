require('dotenv').config();
const mongoose = require('mongoose');
const { dbConnection } = require('../database/config');
const Usuario = require('../models/usuarios');
const {
    CATALOGOS_PERFIL,
    normalizeCatalogValue,
    normalizeScheduleValues,
    resolveAllowedPositions,
    resolveAllowedCourtTypes,
    uniqueStrings,
} = require('../helpers/profile-catalogs');

const getSelectedSports = (usuario = {}) =>
    uniqueStrings([
        ...(Array.isArray(usuario.deportesPrincipales) ? usuario.deportesPrincipales : []),
        ...(Array.isArray(usuario.deportesFavoritos) ? usuario.deportesFavoritos : []),
    ]);

const normalizeField = (value, options = []) => normalizeCatalogValue(value, options);

const migrate = async () => {
    await dbConnection();

    const usuarios = await Usuario.find({});
    let updated = 0;

    for (const usuario of usuarios) {
        const selectedSports = getSelectedSports(usuario);
        const nextHorarios = normalizeScheduleValues(usuario.horariosPreferidos);
        const nextCiudad = normalizeField(usuario.ciudad, CATALOGOS_PERFIL.ciudades);
        const nextZona = normalizeField(usuario.zonaPreferida, CATALOGOS_PERFIL.zonas);
        const nextNivel = normalizeField(usuario.nivelJuego, CATALOGOS_PERFIL.niveles);
        const nextPie = normalizeField(usuario.pieDominante, CATALOGOS_PERFIL.pieDominante);
        const nextEstilo = normalizeField(usuario.estiloJuego, CATALOGOS_PERFIL.estiloJuego);
        const nextDisponibilidad = normalizeField(
            usuario.disponibilidadHabitual,
            CATALOGOS_PERFIL.disponibilidadHabitual,
        );
        const nextPosicion = normalizeField(
            usuario.posicion,
            resolveAllowedPositions(selectedSports),
        );
        const nextTipoCancha = normalizeField(
            usuario.tipoCanchaPreferida,
            resolveAllowedCourtTypes(selectedSports),
        );

        const changed =
            JSON.stringify(usuario.horariosPreferidos || []) !== JSON.stringify(nextHorarios) ||
            String(usuario.ciudad || '') !== nextCiudad ||
            String(usuario.zonaPreferida || '') !== nextZona ||
            String(usuario.nivelJuego || '') !== nextNivel ||
            String(usuario.pieDominante || '') !== nextPie ||
            String(usuario.estiloJuego || '') !== nextEstilo ||
            String(usuario.disponibilidadHabitual || '') !== nextDisponibilidad ||
            String(usuario.posicion || '') !== nextPosicion ||
            String(usuario.tipoCanchaPreferida || '') !== nextTipoCancha;

        if (!changed) {
            continue;
        }

        usuario.horariosPreferidos = nextHorarios;
        usuario.ciudad = nextCiudad;
        usuario.zonaPreferida = nextZona;
        usuario.nivelJuego = nextNivel;
        usuario.pieDominante = nextPie;
        usuario.estiloJuego = nextEstilo;
        usuario.disponibilidadHabitual = nextDisponibilidad;
        usuario.posicion = nextPosicion;
        usuario.tipoCanchaPreferida = nextTipoCancha;
        await usuario.save();
        updated++;
    }

    console.log(`[migrate-user-profile-catalogs] Usuarios actualizados: ${updated}`);
    await mongoose.disconnect();
};

migrate().catch(async (error) => {
    console.error('[migrate-user-profile-catalogs] Error', error);
    await mongoose.disconnect();
    process.exit(1);
});
