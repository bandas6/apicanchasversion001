const { Schema, model } = require('mongoose');

/**
 * Catalogo de franjas horarias (punto 3.2 del checklist 2026-09-02).
 *
 * Arnold: *«las franjas deben ser seleccionables para el rol admin, solo el
 * rol dev puede agregar nombre de las franjas»*.
 *
 * Hasta ahora el nombre de cada franja era un `TextField` libre dentro de la
 * grilla de tarifas de cada cancha, editable por cualquier admin de complejo,
 * y las tres franjas por defecto ("Mañana", "Tarde", "Noche") estaban
 * hardcodeadas en el cliente. No habia catalogo que "seleccionar" ni ninguna
 * comprobacion de rol.
 *
 * Este modelo es ese catalogo, con el mismo patron que `Deporte`: global,
 * administrado solo por DEV, y de lectura publica para que el panel de
 * cualquier admin pueda ofrecerlo como selector.
 *
 * `orden` existe porque estas franjas son bloques del dia y se leen en
 * secuencia (mañana antes que noche); ordenar por nombre no tendria sentido.
 */
const FranjaHorariaSchema = new Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre de la franja es obligatorio'],
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
    /** Posicion en el dia. Menor va primero. */
    orden: {
        type: Number,
        default: 0,
    },
    activo: {
        type: Boolean,
        default: true,
    },
});

FranjaHorariaSchema.pre('validate', function (next) {
    if (this.nombre) {
        this.nombre = String(this.nombre).trim();
    }

    if (!this.slug && this.nombre) {
        this.slug = this.nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    next();
});

FranjaHorariaSchema.methods.toJSON = function () {
    const { __v, _id, ...franja } = this.toObject();
    franja.uid = _id;
    return franja;
};

module.exports = model('FranjaHoraria', FranjaHorariaSchema);
