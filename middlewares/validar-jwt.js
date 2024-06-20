const { request, response } = require('express');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuarios');

const validarJWT = async (req = request, res = response, next) => {
    // Obtener el token desde el encabezado Authorization
    const authHeader = req.header('Authorization');
    
    // Verificar que el encabezado Authorization existe y tiene el formato correcto
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No has iniciado sesión o formato de token incorrecto' });
    }

    // Extraer el token del encabezado Authorization
    const token = authHeader.split(' ')[1];

    console.log(token)

    try {
        // Verificar y decodificar el token
        const { uid } = jwt.verify(token, process.env.SECRETORPRIVATEKEY);

        // Leer el usuario que corresponde al uid
        const usuario = await Usuario.findById(uid);

        // Si el usuario no existe
        if (!usuario) {
            return res.status(401).json({
                msg: 'Token no válido - usuario no encontrado en la base de datos',
                ok: false
            });
        }

        // Verificar si el estado del usuario es true
        if (!usuario.estado) {
            return res.status(401).json({
                msg: 'Token no válido - usuario con estado eliminado',
                ok: false
            });
        }

        // Adjuntar el usuario autenticado a la solicitud
        req.usuarioAuth = usuario;
        next();

    } catch (error) {
        console.log(error);
        return res.status(401).json({
            msg: 'Token inválido',
            ok: false
        });
    }
}

module.exports = {
    validarJWT
};
