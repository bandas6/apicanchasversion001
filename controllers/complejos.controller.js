const { request, response } = require("express");
const Complejos = require("../models/complejos");


const guardarComplejo = async (req = request, res = response) => {
    try {
        const data = req.body;
        const complejo = new Complejos(data); // Aquí se debe usar Complejo en lugar de Complejos

        // Guardar en la base de datos
        await complejo.save(); // Aquí se debe usar complejo en lugar de partido

        res.status(200).json({
            ok: true,
            complejo
        });

    } catch (error) {
        res.status(400).json({
            ok: false,
            error
        });
    }
};


const actualizarComplejo = async (req = request, res = response) => {
    
    const { id } = req.params;

    try {
        const data = req.body;

        const complejo = await Complejos.findByIdAndUpdate(id, data, { new: true })
        .populate('administrador'); // Aquí se debe usar Complejo en lugar de Complejos

        res.status(200).json({
            ok: true,
            complejo
        });

    } catch (error) {
        res.status(400).json({
            ok: false,
            error
        });
    }
};

const obtenerComplejos = async (req = request, res = response) => {
    const { desde = 0, limit = 10 } = req.params;
    const query = { 'cancha.eliminado': false };

    try {
        const [total, complejos] = await Promise.all([
            Complejos.countDocuments(),
            Complejos.find()
                .populate('administrador')
                .populate('canchas')
                .skip(Number(desde))
                .limit(Number(limit))
        ]);

        res.status(200).json({
            ok: true,
            total,
            complejos
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error
        });
    }
};

const obtenerComplejo = async (req = request, res = response) => {
    const { id } = req.params; // Este es el ID del usuario

    try {
        // Obtener el partido por ID y poblar las referencias
        const complejo = await Complejos.findById(id)
            .populate('administrador')
            .populate('canchas')
            .exec();

        // Combinamos la información obtenida
        res.status(200).json({
            ok: true,
            total: complejo ? 1 : 0,
            complejo
        });

    } catch (error) {
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


module.exports = {
    guardarComplejo,
    obtenerComplejos,
    obtenerComplejo,
    actualizarComplejo
}