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
        // Eliminar todas las canchas existentes del complejo
        await Complejos.findByIdAndUpdate(
            id,
            { $set: { canchas: [] } }, // Vaciar el array de canchas
            { useFindAndModify: false }
        );

        // Crear un array para almacenar las promesas de guardado de las canchas
        const promesasGuardado = canchasData.map(async (canchaData) => {
            // Crear una nueva instancia de Cancha
            const nuevaCancha = new Canchas(canchaData);
            // Guardar la nueva cancha en la base de datos y retornar la promesa
            return nuevaCancha.save();
        });

        // Ejecutar todas las promesas de guardado concurrentemente
        const canchasGuardadas = await Promise.all(promesasGuardado);

        // Obtener los IDs de las canchas guardadas
        const canchasIds = canchasGuardadas.map(cancha => cancha._id);

        // Actualizar el complejo con los IDs de las nuevas canchas
        const complejo = await Complejos.findByIdAndUpdate(
            id,
            { $addToSet: { canchas: { $each: canchasIds } } }, // Usar $each para agregar múltiples elementos
            { new: true, useFindAndModify: false }
        ).populate('canchas', 'nombre direccion'); // Populate para devolver información de las canchas

        if (!complejo) {
            return res.status(404).json({
                ok: false,
                msg: 'Complejo no encontrado'
            });
        }

        res.status(200).json({
            ok: true,
            complejo,
            canchas: canchasGuardadas
        });

    } catch (error) {
        console.error('Error al crear y reemplazar las canchas del complejo:', error);
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
    guardarYAgregarCanchaAComplejo
}