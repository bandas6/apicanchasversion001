const { request, response } = require("express");
const mongoose = require('mongoose');
const Reservas = require("../models/reservas");


const guardarReserva = async (req = request, res = response) => {
    try {
        const data = req.body;
        const reserva = new Reservas(data); // Aquí se debe usar Cancha en lugar de Canchas

        // Guardar en la base de datos
        await reserva.save(); // Aquí se debe usar cancha en lugar de partido

        res.status(200).json({
            ok: true,
            reserva
        });

    } catch (error) {
        res.status(400).json({
            ok: false,
            error
        });
    }
};

const actualizarReserva = async (req = request, res = response) => {
    const { id } = req.params;
    const { dia, ...resto } = req.body;

    try {
        // Verificar si fechasDisponibles es un array válido
        // if (resto.horarios) {
        //     if (!Array.isArray(resto.horarios)) {
        //         return res.status(400).json({
        //             ok: false,
        //             msg: 'horarios debe ser un array de fechas válidas'
        //         });
        //     }

        // }

        const reservas = await Reservas.findByIdAndUpdate(id, { ...resto }, { new: true });


        res.status(200).json({
            ok: true,
            reservas
        });

    } catch (error) {
        console.error('Error al actualizar la cancha:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};

const actualizarHoraHorario = async (req = request, res = response) => {
    const { id, horarioId } = req.params;
    const { estado, usuarios, tipoHorario } = req.body;

    console.log("horarioId: ", horarioId)
    try {
        // Buscar la reserva por su id
        const reserva = await Reservas.findById(id);

        if (!reserva) {
            console.log('Reserva no encontrada');
            return res.status(404).json({
                ok: false,
                msg: 'Reserva no encontrada'
            });
        }

        // Encontrar el horario dentro de la lista de horarios por su id

        let horario;

        if (tipoHorario === 'horarioUno') {
            horario = reserva.horariosUno.horario.id(horarioId);
        } else {
            horario = reserva.horariosDos.horario.id(horarioId);
        }


        if (!horario) {
            console.log('Horario no encontrado');
            return res.status(404).json({
                ok: false,
                msg: 'Horario no encontrado'
            });
        }

        // Actualizar el estado del horario
        horario.estado = estado;

        // Validar y combinar los usuarios
        if (usuarios) {
            if (Array.isArray(usuarios)) {

                if(usuarios.length > 0){

                    // Crear un Set con los usuarios existentes para evitar duplicados
                    const nuevosUsuariosSet = new Set(horario.usuarios);
    
                    // Añadir los nuevos usuarios al Set
                    usuarios.forEach(usuario => nuevosUsuariosSet.add(usuario));
    
                    // Convertir el Set de vuelta a un array
                    horario.usuarios = Array.from(nuevosUsuariosSet);
                    
                }else{
                    horario.usuarios = [];
                }


            } else {
                return res.status(400).json({
                    ok: false,
                    msg: 'usuarios debe ser un array de IDs válidos'
                });
            }
        }

        // Guardar los cambios en la reserva
        await reserva.save();

        console.log('Hora del horario actualizada correctamente');

        res.status(200).json({
            ok: true,
            reserva
        });

    } catch (error) {
        console.error('Error actualizando la hora del horario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error actualizando la hora del horario',
            error: error.message
        });
    }
};


const actualizarEstadoUsuario = async (req = request, res = response) => {
    const { idReserva, horarioId, usuarioId } = req.params;  // Añadido usuarioId para identificar al usuario específico
    const { estado, aceptado, tipoHorario } = req.body;  // Añadido aceptado para actualizar este campo
    try {
        // Buscar la reserva por su id
        const reserva = await Reservas.findById(idReserva);

        if (!reserva) {
            return res.status(404).json({
                ok: false,
                msg: 'Reserva no encontrada'
            });
        }

        // Encontrar el horario dentro de la lista de horarios por su id
        let horario;

        if (tipoHorario === 'horarioUno') {
            horario = reserva.horariosUno.horario.id(horarioId);
        } else {
            horario = reserva.horariosDos.horario.id(horarioId);
        }


        if (!horario) {
            return res.status(404).json({
                ok: false,
                msg: 'Horario no encontrado'
            });
        }

        // Actualizar el estado del horario si se proporciona
        if (estado !== undefined) {
            if (![0, 1, 2, 3].includes(estado)) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Estado no válido'
                });
            }
            horario.estado = estado;
        }

        const usuario = horario.usuarios.id(usuarioId)

        // Actualizar aceptad en usuarios

        if (usuario && aceptado !== undefined) {
            usuario.aceptado = aceptado;
        }
        // Guardar los cambios en la reserva
        await reserva.save();

        res.status(200).json({
            ok: true,
            reserva
        });

    } catch (error) {
        res.status(500).json({
            ok: false,
            msg: 'Error actualizando la hora del horario',
            error: error.message
        });
    }
};


const obtenerReservasCancha = async (req = request, res = response) => {
    const { id } = req.params;
    const query = { cancha: id };

    try {
        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            Reservas.find(query)
                .populate('complejo')
                .populate('cancha')
                .populate('horariosUno.horario.usuarios.usuario')
                .populate('horariosDos.horario.usuarios.usuario')
                .lean() // Convertir documentos de Mongoose a objetos JS planos
        ]);

        // Ordenar las reservas por el campo diaDeLaSemana
        const diasDeLaSemana = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
        const reservasOrdenadas = reservas.sort((a, b) => {
            return diasDeLaSemana.indexOf(a.dia.toLowerCase()) - diasDeLaSemana.indexOf(b.dia.toLowerCase());
        });

        res.status(200).json({
            ok: true,
            total,
            reservas: reservasOrdenadas
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
};



const obtenerReservas = async (req = request, res = response) => {
    query = {};
    const { desde, limit, idCancha } = req.params

    try {

        const [total, reservas] = await Promise.all([
            Reservas.countDocuments(query),
            Reservas.find(query)
                .populate('complejo')
                .populate('cancha')
        ])

        res.status(200).json({
            ok: true,
            total,
            reservas
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }
}


const obtenerReserva = async (req = request, res = response) => {
    const { id } = req.params; // Este es el ID del usuario
    const { tipo } = req.query;

    try {
        // Obtener el partido por ID y poblar las referencias
        const reserva = await Reservas.findById(id)
            .exec();

        // Combinamos la información obtenida
        res.status(200).json({
            ok: true,
            total: reserva ? 1 : 0,
            reserva
        });

    } catch (error) {
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};


const renombrarCampo = async (req = request, res = response) => {
    const { id } = req.params;
    const { reservas } = req.body; // El array de reservas a modificar

    try {
        // Conecta a la base de datos (asegúrate de usar la URL correcta de tu base de datos)
        await mongoose.connect(process.env.MONGO_DBCNN, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Encontrar la reserva por su ID
        const reserva = await Reservas.findById(id);

        if (!reserva) {
            return res.status(404).json({
                ok: false,
                msg: 'Reserva no encontrada'
            });
        }

        // Renombrar campos en el array de reservas
        for (let i = 0; i < reservas.length; i++) {
            if (reservas[i].hasOwnProperty('horariosDos')) {
                reservas[i].horariosUno = reservas[i].horariosDos;
                delete reservas[i].horariosDos;
            }
        }

        // Guardar los cambios en la base de datos
        await reserva.save();

        console.log('Campos renombrados en los horarios correctamente');
        mongoose.disconnect();

        res.status(200).json({
            ok: true,
            msg: 'Campos renombrados correctamente'
        });

    } catch (error) {
        console.error('Error renombrando los campos:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
};




module.exports = {
    guardarReserva,
    obtenerReserva,
    obtenerReservasCancha,
    actualizarReserva,
    obtenerReservas,
    actualizarHoraHorario,
    actualizarEstadoUsuario,
    renombrarCampo
}