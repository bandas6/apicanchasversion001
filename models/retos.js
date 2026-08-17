const { Schema, model } = require('mongoose');

// Fase 4 (docs/equipos-social-plan.md en canchas-app-flutter): un equipo reta
// a otro. Decision fundacional 2 del plan: todo reto exige una reserva real
// de cancha una vez aceptado -- no hay "partido informal" suelto en el
// sistema. 'jugado' se llega recien cuando ademas de aceptado hay una
// reserva vinculada cuya fecha ya paso (ver marcarJugado en el controller);
// el resultado/puntaje en si es Fase 5, no vive en este modelo.
const ESTADOS_RETO = ['pendiente', 'aceptado', 'rechazado', 'cancelado', 'jugado'];

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

module.exports = { Reto: model('Reto', RetoSchema), ESTADOS_RETO };
