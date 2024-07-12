const { request, response } = require("express");
const Retos = require("../models/retos");
const Equipos = require("../models/equipos");

const guardarReto = async (req = request, res = response) => {

    try {

        const data = req.body;
        const retos = new Retos(data);

        //guardar en DB
        await retos.save();

        res.status(200).json({
            ok: true,
            retos
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }
};

const guardarYAgregarRetosAEquipos = async (req = request, res = response) => {
    const { id } = req.params; // ID del Equipo
    const retosData = req.body; // Array de datos de los nuevos Retos

    try {

        // Crear un array para almacenar las promesas de guardado de los retos
        const promesasGuardado = retosData.map(async (retoData) => {
            // Crear una nueva instancia de Reto
            const nuevoReto = new Retos(retoData);
            // Guardar el nuevo reto en la base de datos y retornar la promesa
            return nuevoReto.save();
        });

        // Ejecutar todas las promesas de guardado concurrentemente
        const retosGuardados = await Promise.all(promesasGuardado);

        // Obtener los IDs de los retos guardados
        const retosIds = retosGuardados.map(reto => reto._id);

        // Actualizar el equipo con los IDs de los nuevos retos
        const equipo = await Equipos.findByIdAndUpdate(
            id,
            { $addToSet: { retos: { $each: retosIds } } }, // Usar $each para agregar múltiples elementos
            { new: true } // Devuelve el documento actualizado
        ).populate('retos retos.usuario retos.usuarioRetado'); // Populate para devolver información de los retos

        if (!equipo) {
            return res.status(404).json({
                ok: false,
                msg: 'Equipo no encontrado'
            });
        }

        res.status(200).json({
            ok: true,
            equipo,
            retos: retosGuardados
        });

    } catch (error) {
        console.error('Error al guardar el nuevo reto:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};

const actualizarReto = async (req = request, res = response) => {
    const { id } = req.params;
    const data = req.body;

    try {
        const reto = await Retos.findByIdAndUpdate(id, data, { new: true });

        res.status(200).json({
            ok: true,
            reto
        });

    } catch (error) {
        console.error('Error al actualizar el reto:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }

}

const obtenerRetos = async (req = request, res = response) => {
    const { desde = 0, limit = 10, tipoConsulta } = req.query;

    console.log(req.usuarioAuth._id); // Esto imprime el ID del usuario autenticado

    try {
        const skip = Number.isNaN(parseInt(desde, 10)) ? 0 : parseInt(desde, 10);
        const limitVal = Number.isNaN(parseInt(limit, 10)) ? 10 : parseInt(limit, 10);

        const usuarioId = req.usuarioAuth._id;
        let total, retos;

        const populateOptions = [
            {
                path: 'usuario',
                populate: {
                    path: 'equipo_id',
                    model: 'Equipo',
                    select: 'nombre ciudad' // Seleccionar solo ciertos campos del Equipo
                }
            },
            {
                path: 'usuarioRetado',
                populate: {
                    path: 'equipo_id',
                    model: 'Equipo',
                    select: 'nombre ciudad' // Seleccionar solo ciertos campos del Equipo
                }
            }
        ];

        if (tipoConsulta === 'enviadas') {
            [total, retos] = await Promise.all([
                Retos.countDocuments({ usuario: usuarioId }),
                Retos.find({ usuario: usuarioId })
                    .skip(skip)
                    .limit(limitVal)
                    .populate(populateOptions)
            ]);
        } else if (tipoConsulta === 'recibidas') {
            [total, retos] = await Promise.all([
                Retos.countDocuments({ usuarioRetado: usuarioId }),
                Retos.find({ usuarioRetado: usuarioId })
                    .skip(skip)
                    .limit(limitVal)
                    .populate(populateOptions)
            ]);
        } else if (tipoConsulta === 'retosAbiertos') {
            [total, retos] = await Promise.all([
                Retos.countDocuments({ $or: [{ usuarioRetado: null }, { usuarioRetado: { $exists: false } }] }),
                Retos.find({ $or: [{ usuarioRetado: null }, { usuarioRetado: { $exists: false } }] })
                    .skip(skip)
                    .limit(limitVal)
                    .populate(populateOptions)
            ]);
        } else {
            return res.status(400).json({
                ok: false,
                error: 'Tipo de consulta no válido'
            });
        }

        res.status(200).json({
            ok: true,
            total,
            retos
        });

    } catch (error) {
        console.error('Error al obtener los retos:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


const obtenerReto = async (req = request, res = response) => {
    const { id } = req.params; // Este es el ID del usuario

    try {

        // Obtener el partido por ID y poblar las referencias
        const partido = await Partidos.findById(id)
            .exec();

        res.status(200).json({
            ok: true,
            total: partido ? 1 : 0,
            partido
        });

    } catch (error) {
        console.error('Error al obtener el partido:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


module.exports = {
    guardarReto,
    guardarYAgregarRetosAEquipos,
    obtenerRetos,
    obtenerReto,
    actualizarReto
}