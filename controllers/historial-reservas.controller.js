const { request, response } = require("express");
const HistorialReservas = require("../models/historial-reservas");


const guardarHistorialReserva = async (req = request, res = response) => {
    try {
        const data = req.body;
        const historialReserva = new HistorialReservas(data); // Aquí se debe usar Cancha en lugar de Canchas

        // Guardar en la base de datos
        await historialReserva.save(); // Aquí se debe usar cancha en lugar de partido

        res.status(200).json({
            ok: true,
            historialReserva
        });

    } catch (error) {
        res.status(400).json({
            ok: false,
            error
        });
    }
};

const actualizarHistorialReserva = async (req = request, res = response) => {
    const { id } = req.params;
    const data = req.body;

    try {
        // Verificar si fechasDisponibles es un array válido
        if (data.reservas) {
            if (!Array.isArray(data.reservas)) {
                return res.status(400).json({
                    ok: false,
                    msg: 'horarios debe ser un array de fechas válidas'
                });
            }

        }

        const historialReservas = await HistorialReservas.findByIdAndUpdate(id, data, { new: true });


        res.status(200).json({
            ok: true,
            historialReservas
        });

    } catch (error) {
        console.error('Error al actualizar la cancha:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


const obtenerHistorialReservas = async (req = request, res = response) => {
    query = {};
    const { desde, limit } = req.params

    try {

        const [total, historialReserva] = await Promise.all([
            HistorialReservas.countDocuments(query),
            HistorialReservas.find(query)
                .populate('reservas.reserva_id')
        ])

        res.status(200).json({
            ok: true,
            total,
            historialReserva
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }
}


const obtenerHistorialReserva = async (req = request, res = response) => {
    const { id } = req.params; // Este es el ID del usuario
    // const { tipo } = req.query;

    try {
        // Obtener el partido por ID y poblar las referencias
        const historialReserva = await HistorialReservas.findById(id)
            .exec();

        // Combinamos la información obtenida
        res.status(200).json({
            ok: true,
            total: historialReserva ? 1 : 0,
            historialReserva
        });

    } catch (error) {
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


module.exports = {
    guardarHistorialReserva,
    actualizarHistorialReserva,
    obtenerHistorialReservas,
    obtenerHistorialReserva
}