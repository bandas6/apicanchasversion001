const { Schema, model } = require('mongoose');

const ESTADOS_MEMBRESIA = ['pendiente', 'aceptada', 'rechazada'];
const ORIGENES_MEMBRESIA = ['creacion', 'solicitud', 'invitacion'];
const ROLES_MEMBRESIA = ['capitan', 'miembro'];

// Fase 1 (docs/equipos-social-plan.md): una sola coleccion para roster +
// solicitudes/invitaciones pendientes, en vez de dos separadas -- el estado
// (pendiente/aceptada/rechazada) ya distingue ambos casos. `deporte` viene
// denormalizado desde el equipo al crear la membresia especificamente para
// poder poner un indice unico parcial que garantice, a nivel de base de
// datos, "un jugador puede estar en varios equipos, uno por deporte"
// (decision fundacional 1 del plan) sin condiciones de carrera.
const EquipoMembresiaSchema = new Schema({
    equipo: {
        type: Schema.Types.ObjectId,
        ref: 'Equipo',
        required: true,
        index: true,
    },
    usuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true,
    },
    deporte: {
        type: Schema.Types.ObjectId,
        ref: 'Deporte',
        required: true,
    },
    rol: {
        type: String,
        enum: ROLES_MEMBRESIA,
        default: 'miembro',
    },
    // 'creacion': el capitan al crear el equipo (queda aceptada de una).
    // 'solicitud': el jugador pidio unirse (la responde el capitan).
    // 'invitacion': el capitan invito al jugador (la responde el jugador).
    origen: {
        type: String,
        enum: ORIGENES_MEMBRESIA,
        required: true,
    },
    estado: {
        type: String,
        enum: ESTADOS_MEMBRESIA,
        default: 'pendiente',
    },
    mensaje: {
        type: String,
        trim: true,
        default: '',
    },
}, { timestamps: true });

// Evita duplicar una solicitud/invitacion pendiente para el mismo par
// equipo+usuario. No es un unique global: si se rechaza, se puede volver a
// pedir mas adelante (queda otro documento, se conserva el historial).
EquipoMembresiaSchema.index(
    { equipo: 1, usuario: 1 },
    { unique: true, partialFilterExpression: { estado: 'pendiente' } },
);

// La regla dura del plan: como mucho una membresia ACEPTADA por usuario y
// deporte, sin importar en que equipo.
EquipoMembresiaSchema.index(
    { usuario: 1, deporte: 1 },
    { unique: true, partialFilterExpression: { estado: 'aceptada' } },
);

EquipoMembresiaSchema.methods.toJSON = function () {
    const { __v, _id, ...membresia } = this.toObject();
    membresia.uid = _id;
    return membresia;
};

module.exports = {
    EquipoMembresia: model('EquipoMembresia', EquipoMembresiaSchema),
    ESTADOS_MEMBRESIA,
    ORIGENES_MEMBRESIA,
    ROLES_MEMBRESIA,
};
