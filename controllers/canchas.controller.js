const { request, response } = require("express");
const Canchas = require("../models/canchas");
const Complejos = require("../models/complejos");


const guardarCancha = async (req = request, res = response) => {
    try {
        const data = req.body;
        const cancha = new Canchas(data); // Aquí se debe usar Cancha en lugar de Canchas

        // Guardar en la base de datos
        await cancha.save(); // Aquí se debe usar cancha en lugar de partido

        res.status(200).json({
            ok: true,
            cancha
        });
        
    } catch (error) {
        res.status(400).json({
            ok: false,
            error
        });
    }
};

const guardarYAgregarCanchaAComplejo = async (req = request, res = response) => {
    const { id } = req.params; // ID del Complejo
    const canchasData = req.body; // Array de datos de las nuevas Canchas

    try {
        // Obtener el complejo actual
        const complejo = await Complejos.findById(id).populate('canchas', 'nombre direccion');

        if (!complejo) {
            return res.status(404).json({
                ok: false,
                msg: 'Complejo no encontrado'
            });
        }

        // IDs de las canchas existentes en el complejo
        const canchasExistentesIds = complejo.canchas.map(cancha => cancha._id.toString());

        // Array para almacenar nuevas canchas a agregar
        const nuevasCanchasIds = [];

        // Promesas de actualización/creación de canchas
        const promesasCanchas = canchasData.map(async (canchaData) => {
            if (canchaData._id && canchasExistentesIds.includes(canchaData._id)) {
                // Actualizar cancha existente
                const canchaActualizada = await Canchas.findByIdAndUpdate(
                    canchaData._id,
                    canchaData,
                    { new: true, useFindAndModify: false }
                );
                return canchaActualizada._id;
            } else {
                // Crear nueva cancha
                const nuevaCancha = new Canchas(canchaData);
                const canchaGuardada = await nuevaCancha.save();
                nuevasCanchasIds.push(canchaGuardada._id);
                return canchaGuardada._id;
            }
        });

        // Ejecutar todas las promesas de actualización/creación
        const canchasActualizadasOIds = await Promise.all(promesasCanchas);

        // Determinar IDs de canchas a eliminar
        const canchasEliminarIds = canchasExistentesIds.filter(idExistente => !canchasData.some(cancha => cancha._id === idExistente));

        // Eliminar canchas que ya no están en la lista
        await Canchas.deleteMany({ _id: { $in: canchasEliminarIds } });

        // Actualizar el complejo con las nuevas y actualizadas canchas
        const complejoActualizado = await Complejos.findByIdAndUpdate(
            id,
            { canchas: canchasActualizadasOIds },
            { new: true, useFindAndModify: false }
        ).populate('canchas', 'nombre direccion');

        res.status(200).json({
            ok: true,
            complejo: complejoActualizado,
            canchas: canchasActualizadasOIds
        });

    } catch (error) {
        console.error('Error al crear y actualizar las canchas del complejo:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


const actualizarCancha = async (req = request, res = response) => {
    const { id } = req.params;
    const data = req.body;

    try {
        // Verificar si fechasDisponibles es un array válido
        if (data.fechasDisponibles) {
            if (!Array.isArray(data.fechasDisponibles)) {
                return res.status(400).json({
                    ok: false,
                    msg: 'fechasDisponibles debe ser un array de fechas válidas'
                });
            }

            // Validar que cada fecha en el array sea una fecha válida
            const fechasValidas = data.fechasDisponibles.every(fecha => !isNaN(Date.parse(fecha)));
            if (!fechasValidas) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Cada fecha en fechasDisponibles debe ser una fecha válida'
                });
            }
        }

        if(data.solicitudes){
            if (!Array.isArray(data.solicitudes)) {
                return res.status(400).json({
                    ok: false,
                    msg:'solicitudes debe ser un array de solicitudes válidas'
                });
            }
        }

        // Actualizar la cancha, asegurándote de usar $set para actualizar arrays
        const canchaActualizada = await Canchas.findByIdAndUpdate(
            id,
            { $set: data }, // Usar $set para actualizar el objeto completo, incluyendo fechasDisponibles
            { new: true, runValidators: true, useFindAndModify: false }
        );

        if (!canchaActualizada) {
            return res.status(404).json({
                ok: false,
                msg: 'Cancha no encontrada'
            });
        }

        res.status(200).json({
            ok: true,
            cancha: canchaActualizada
        });

    } catch (error) {
        console.error('Error al actualizar la cancha:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};



const obtenerCanchas = async (req = request, res = response) => {

    query = {}
    const { desde, limit } = req.params

    try {

        const [total, canchas] = await Promise.all([
            Canchas.countDocuments(query),
            Canchas.find(query)
                .skip(Number(desde))
                .limit(Number(limit))
                .populate('complejo')
        ])

        res.status(200).json({
            ok: true,
            total,
            canchas
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }
}


const obtenerCancha = async (req = request, res = response) => {
    const { id } = req.params; // Este es el ID del usuario
    const { tipo } = req.query;

    try {
        // Obtener el partido por ID y poblar las referencias
        const cancha = await Canchas.findById(id)
            .exec();

        // Combinamos la información obtenida
        res.status(200).json({
            ok: true,
            total: cancha ? 1 : 0,
            cancha
        });

    } catch (error) {
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


module.exports = {
    guardarCancha,
    obtenerCanchas,
    obtenerCancha,
    guardarYAgregarCanchaAComplejo,
    actualizarCancha
}