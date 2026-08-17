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

// Direccion unica: ¿usuarioBloqueador tiene a idBloqueado en su lista? Se
// llama 2 veces (una por direccion) para chequear un par -- ver
// hayBloqueoEntrePar.
const usuarioBloqueaA = (usuarioBloqueador, idBloqueado) => {
    const lista = usuarioBloqueador?.usuariosBloqueados || [];
    return lista.map(String).includes(String(idBloqueado));
};

// Bloqueo reciproco entre un par de usuarios ya cargados (ambos docs, o al
// menos con su campo usuariosBloqueados seleccionado). No hace falta que
// esten en el mismo orden -- alcanza con que cualquiera de las 2 direcciones
// tenga al otro en su lista.
const hayBloqueoEntrePar = (usuarioA, usuarioB) => {
    return usuarioBloqueaA(usuarioA, usuarioB?._id)
        || usuarioBloqueaA(usuarioB, usuarioA?._id);
};

module.exports = {
    resolveIdsBloqueados,
    hayBloqueoEntrePar,
};
