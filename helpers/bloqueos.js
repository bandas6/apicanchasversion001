// Fase 3 (docs/equipos-social-plan.md): el bloqueo entre usuarios es
// reciproco -- oculta tanto a quien yo bloquee como a quien me bloqueo a mi.
// Funcion pura (sin acceso a DB) para poder testear la logica de merge sin
// mongodb-memory-server, mismo criterio que helpers/equipos-social.js.
const resolveIdsBloqueados = (bloqueadosPorMi = [], meBloquearon = []) => {
    return [...new Set([
        ...bloqueadosPorMi.map(String),
        ...meBloquearon.map(String),
    ])];
};

module.exports = {
    resolveIdsBloqueados,
};
