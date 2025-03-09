const { response } = require("express");
const Usuarios = require("../models/usuarios");
const bcryptjs = require('bcryptjs');

const obtenerUsuarios = async (req = require, res = response) => {
    try {
        const { limit = 0, desde = 0, rol } = req.query;
        const query = { estado: true };

        if (rol) {
            query.rol = rol;
        }

        const [total, usuarios] = await Promise.all([
            Usuarios.countDocuments(query),
            Usuarios.find(query)
                .skip(Number(desde))
                .limit(Number(limit))
                .populate('equipo_id')
                .select('-password') // Excluir el campo password directamente en la consulta
                .select('__v') // Excluir el campo contrasenia directamente en la consulta
        ]);

        return res.status(200).json({
            ok: true,
            total,
            usuarios
        });

    } catch (error) {
        return res.status(500).json({ // Usar 500 para errores del servidor
            ok: false,
            error: error.message // Mejor solo enviar el mensaje de error
        });
    }
};

// Obtener usuario por id
const obtenerUsuario = async (req = require, res = response) => {

    try {

        const { id } = req.params;

        const usuario = await Usuarios.findById(id).populate('equipo_id')

        return res.status(200).json({
            ok: true,
            usuario
        })

    } catch (error) {

        return res.status(200).json({
            ok: false,
            error
        })

    }

}

// Guardar usuarios en DB
const guardarUsuario = async (req = require, res = response) => {

    try {

        const data = req.body;
        const usuario = new Usuarios(data);

        // Ecriptar contraseña
        const salt = await bcryptjs.genSaltSync();
        usuario.password = bcryptjs.hashSync(password, salt);

        //guardar en DB
        await usuario.save();
        delete usuario.password

        res.status(200).json({
            ok: true,
            usuario
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })


    }

}

// Actualizar usuarios en DB
const actualizarUsuario = async (req = require, res = response) => {

    try {

        const { id } = req.params;
        const { _id, password, google, correo, ...resto } = req.body;

        if (password) {
            const salt = await bcryptjs.genSaltSync();
            resto.password = bcryptjs.hashSync(password, salt);
        }

        const usuario = await Usuarios.findByIdAndUpdate(id, resto, { new: true });

        res.status(200).json({
            ok: true,
            usuario
        })


    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }

}

// Eliminar usuarios en DB
const eliminarUsuario = async (req = require, res = response) => {

    try {
        const { id } = req.params;

        const usuario = await Usuarios.findByIdAndUpdate(id, { estado: false });

        res.status(200).json({
            ok: true,
            usuario
        })

    } catch (error) {

        res.status(200).json({
            ok: false,
            error
        })

    }


}

module.exports = {
    guardarUsuario,
    obtenerUsuarios,
    obtenerUsuario,
    actualizarUsuario,
    eliminarUsuario
}