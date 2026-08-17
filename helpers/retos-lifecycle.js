// B1 (brief de diseño de Fase 4, docs/equipos-social-fase4.md): un reto
// 'aceptado' sin reserva vinculada nunca caduca por si solo -- si los 2
// capitanes se aceptan y jamas coordinan la cancha, el reto queda "vivo"
// para siempre, ocupando la lista y el badge de ambos equipos. Este sweep
// lo cierra automaticamente despues de CADUCIDAD_DIAS_ACEPTADO_SIN_RESERVA
// dias sin reserva, mismo patron que
// helpers/reservation-reputation.js:runReservationLifecycleSweep (un
// barrido periodico, no una accion disparada por request).
const { Reto, CADUCIDAD_DIAS_ACEPTADO_SIN_RESERVA } = require('../models/retos');

const runRetosLifecycleSweep = async () => {
    const limite = new Date();
    limite.setDate(limite.getDate() - CADUCIDAD_DIAS_ACEPTADO_SIN_RESERVA);

    const result = await Reto.updateMany(
        {
            estado: 'aceptado',
            reserva: null,
            aceptadoEn: { $lte: limite },
        },
        { $set: { estado: 'caducado' } },
    );

    return { caducados: result.modifiedCount || 0 };
};

module.exports = { runRetosLifecycleSweep };
