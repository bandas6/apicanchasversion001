const { Schema, model } = require('mongoose');

// Fase 4 (docs/equipos-social-plan.md en canchas-app-flutter): un equipo reta
// a otro. Decision fundacional 2 del plan: todo reto exige una reserva real
// de cancha una vez aceptado -- no hay "partido informal" suelto en el
// sistema. 'jugado' se llega recien cuando ademas de aceptado hay una
// reserva vinculada cuya fecha ya paso (ver marcarJugado en el controller);
// el resultado/puntaje en si es Fase 5, no vive en este modelo.
//
// 'caducado' (B1 del brief de diseño de Fase 4): un reto que llego a
// 'aceptado' pero nunca vinculo una reserva se cierra solo despues de
// CADUCIDAD_DIAS dias -- sin esto queda "vivo" para siempre, ocupando la
// lista y el badge de los 2 equipos aunque nadie vaya a coordinar la
// cancha. Se distingue de 'cancelado' (accion explicita de un capitan)
// porque el disparador es automatico (ver helpers/retos-lifecycle.js), no
// una decision de nadie.
const ESTADOS_RETO = ['pendiente', 'aceptado', 'rechazado', 'cancelado', 'jugado', 'caducado'];
const CADUCIDAD_DIAS_ACEPTADO_SIN_RESERVA = 30;

const RetoSchema = new Schema({
    equipoRetador: {
        type: Schema.Types.ObjectId,
        ref: 'Equipo',
        required: true,
        index: true,
    },
    equipoRetado: {
        type: Schema.Types.ObjectId,
        ref: 'Equipo',
        required: true,
        index: true,
    },
    // Denormalizado desde equipoRetador.deporte al crear el reto (mismo
    // criterio que EquipoMembresia.deporte) -- ambos equipos tienen que jugar
    // el mismo deporte, se valida en el controller (puedenRetarse).
    deporte: {
        type: Schema.Types.ObjectId,
        ref: 'Deporte',
        required: true,
    },
    creadoPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
    },
    respondidoPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null,
    },
    // Cuando el reto paso a 'aceptado' -- no se puede usar `updatedAt` para
    // la caducidad de B1 porque ese timestamp se pisa con cualquier otro
    // cambio posterior (vincular reserva, etc.), no solo con la aceptacion.
    aceptadoEn: {
        type: Date,
        default: null,
    },
    estado: {
        type: String,
        enum: ESTADOS_RETO,
        default: 'pendiente',
    },
    mensaje: {
        type: String,
        trim: true,
        default: '',
    },
    // Referencial/informativa -- no ata nada. Lo que fija de verdad cuando y
    // donde se juega es la reserva vinculada (ver campo `reserva`).
    fechaPropuesta: {
        type: Date,
        default: null,
    },
    // Obligatoria antes de poder marcar el reto como 'jugado' (ver
    // vincularReserva/marcarJugado en el controller). No se pone `required`
    // a nivel de schema porque el reto nace sin ella (se vincula despues de
    // aceptado).
    reserva: {
        type: Schema.Types.ObjectId,
        ref: 'Reserva',
        default: null,
    },
    // Distingue, con reserva:null, "nunca coordinaron la cancha" de "la
    // habian coordinado y se cayo" -- el frontend (D2 del brief de diseño)
    // muestra 2 bloques distintos ("Falta coordinar la cancha" vs "Se cayó
    // la cancha") y sin esta marca no hay forma de saber cual mostrar. Solo
    // lo pisa el hook de B2 (models/reservas.js) cuando una reserva
    // vinculada se cancela -- vincularReserva lo limpia al vincular una
    // nueva, y desvincularReserva (B5, correccion manual del capitan) NO lo
    // toca a proposito: no es lo mismo "se cayó" que "me equivoqué de
    // reserva y la saco yo mismo".
    reservaDesvinculadaEn: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

// Evita duplicar un reto pendiente entre el mismo par retador->retado. No es
// una restriccion sobre el par sin ordenar: nada impide que B tambien le
// mande un reto pendiente a A al mismo tiempo (son 2 retos distintos, cada
// uno con su propio retador).
RetoSchema.index(
    { equipoRetador: 1, equipoRetado: 1 },
    { unique: true, partialFilterExpression: { estado: 'pendiente' } },
);
RetoSchema.index({ equipoRetado: 1, estado: 1 });
RetoSchema.index({ equipoRetador: 1, estado: 1 });

RetoSchema.methods.toJSON = function () {
    const { __v, _id, ...reto } = this.toObject();
    reto.uid = _id;
    return reto;
};

module.exports = {
    Reto: model('Reto', RetoSchema),
    ESTADOS_RETO,
    CADUCIDAD_DIAS_ACEPTADO_SIN_RESERVA,
};
