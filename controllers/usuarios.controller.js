const { response } = require("express");
const Usuarios = require("../models/usuarios");
const bcryptjs = require('bcryptjs');

const normalizarPayloadUsuario = (data = {}) => {
    const payload = { ...data };

    ['nombre', 'apellido', 'correo', 'posicion', 'bio', 'ciudad', 'nivelJuego', 'fotoUrl', 'nombre_archivo_imagen']
        .forEach((key) => {
            if (typeof payload[key] === 'string') {
                payload[key] = payload[key].trim();
            }
        });

    if (payload.deportesFavoritos === '' || payload.deportesFavoritos == null) {
        payload.deportesFavoritos = [];
    } else if (Array.isArray(payload.deportesFavoritos)) {
        payload.deportesFavoritos = payload.deportesFavoritos
            .map((item) => String(item).trim())
            .filter(Boolean);
    }

    if (payload.puntuacion !== undefined) {
        payload.puntuacion = Number(payload.puntuacion || 0);
    }

    if (payload.valoracion !== undefined) {
        payload.valoracion = Number(payload.valoracion || 0);
    }

    return payload;
};

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

        return res.status(500).json({
            ok: false,
            error: error.message
        })

    }

}

// Guardar usuarios en DB
const guardarUsuario = async (req = require, res = response) => {

    try {

        const data = normalizarPayloadUsuario(req.body);
        const usuario = new Usuarios(data);

        // Ecriptar contraseña
        const salt = await bcryptjs.genSaltSync();
        usuario.password = bcryptjs.hashSync(data.password, salt);

        //guardar en DB
        await usuario.save();
        res.status(201).json({
            ok: true,
            usuario
        })

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        })


    }

}

// Actualizar usuarios en DB
const actualizarUsuario = async (req = require, res = response) => {

    try {

        const { id } = req.params;
        const { _id, password, google, correo, ...restoRaw } = req.body;
        const resto = normalizarPayloadUsuario(restoRaw);

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

        res.status(500).json({
            ok: false,
            error: error.message
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

        res.status(500).json({
            ok: false,
            error: error.message
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
