const { Schema, model } = require('mongoose');

const ICONOS_MATERIAL_DEPORTE = [
    'sports',
    'sports_soccer',
    'sports_tennis',
    'sports_basketball',
    'sports_volleyball',
    'sports_handball',
    'sports_baseball',
    'sports_football',
    'sports_golf',
    'sports_cricket',
    'sports_hockey',
    'sports_rugby',
    'sports_martial_arts',
    'fitness_center',
    'pool',
    'directions_run',
    'pedal_bike',
    'self_improvement',
];

const ICONO_MATERIAL_DEFAULT = 'sports';

const DeportesSchema = new Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del deporte es obligatorio'],
        trim: true,
        unique: true,
    },
    slug: {
        type: String,
        lowercase: true,
        trim: true,
        unique: true,
    },
    descripcion: {
        type: String,
        trim: true,
    },
    iconoMaterial: {
        type: String,
        trim: true,
        enum: ICONOS_MATERIAL_DEPORTE,
        default: ICONO_MATERIAL_DEFAULT,
    },
    activo: {
        type: Boolean,
        default: true,
    },
});

DeportesSchema.pre('validate', function (next) {
    if (this.nombre) {
        this.nombre = String(this.nombre).trim();
    }

    if (!this.slug && this.nombre) {
        this.slug = this.nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    if (this.iconoMaterial) {
        this.iconoMaterial = String(this.iconoMaterial).trim();
    } else {
        this.iconoMaterial = ICONO_MATERIAL_DEFAULT;
    }

    next();
});

DeportesSchema.statics.iconosMaterialPermitidos = ICONOS_MATERIAL_DEPORTE;
DeportesSchema.statics.iconoMaterialDefault = ICONO_MATERIAL_DEFAULT;

DeportesSchema.methods.toJSON = function () {
    const { __v, _id, ...deporte } = this.toObject();
    deporte.uid = _id;
    return deporte;
}

module.exports = model('Deporte', DeportesSchema);
