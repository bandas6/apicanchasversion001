const { Schema, model } = require('mongoose');

// Fase 1 (docs/equipos-social-plan.md en canchas-app-flutter): reemplaza al
// scaffold legacy (retirado en el commit anterior). Un usuario puede tener
// varios equipos, uno por deporte -- ver models/equipo-membresias.js, que es
// donde vive esa regla (no aca).
const EquipoSchema = new Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del equipo es obligatorio'],
        trim: true,
    },
    deporte: {
        type: Schema.Types.ObjectId,
        ref: 'Deporte',
        required: [true, 'El deporte es obligatorio'],
    },
    descripcion: {
        type: String,
        trim: true,
        default: '',
    },
    nombreArchivoImagen: {
        type: String,
        default: '',
    },
    // Fase 3 (docs/equipos-social-plan.md): zona/ubicacion de referencia para
    // la busqueda publica -- mismo catalogo (CATALOGOS_PERFIL.zonas) que ya
    // usa Usuario.zonaPreferida, opcional (equipos creados antes de esta fase
    // quedan sin zona, no se inventa un valor para ellos).
    zona: {
        type: String,
        trim: true,
        default: '',
    },
    capitan: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: [true, 'El capitan es obligatorio'],
    },
    estado: {
        type: Boolean,
        default: true,
    },
    // Puntuacion/record: campos listos para la Fase 6 (se calculan solo a
    // partir de resultados de reto confirmados, cuando esa fase exista).
    // Hoy nada los escribe todavia.
    puntuacion: {
        type: Number,
        default: 0,
    },
    victorias: {
        type: Number,
        default: 0,
    },
    derrotas: {
        type: Number,
        default: 0,
    },
    empates: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

EquipoSchema.index({ estado: 1, deporte: 1, nombre: 1 });
EquipoSchema.index({ estado: 1, deporte: 1, zona: 1 });

EquipoSchema.methods.toJSON = function () {
    const { __v, _id, ...equipo } = this.toObject();
    equipo.uid = _id;
    return equipo;
};

module.exports = model('Equipo', EquipoSchema);
