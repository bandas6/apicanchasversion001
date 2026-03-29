const { response } = require("express");
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Usuario = require("../models/usuarios");
const { generarJWT, generarRefreshToken } = require("../helpers/generar-jwt");

const buildAuthPayload = async (usuario) => {
    const token = await generarJWT(usuario.id);
    const refreshToken = await generarRefreshToken(usuario.id);
    const salt = await bcryptjs.genSaltSync();

    usuario.refreshTokenHash = bcryptjs.hashSync(refreshToken, salt);
    await usuario.save();

    return {
        ok: true,
        usuario,
        token,
        refreshToken,
    };
};

const login = async (req = require, res = response) => {
    const { correo, password } = req.body;
    
    try {
        const usuario = await Usuario.findOne({ correo });
        
        if (!usuario) {
            return res.status(400).json({
                msg: 'El usuario no existe'
            });
        }

        if (!usuario.estado) {
            return res.status(400).json({
                msg: 'Usuario / Password no son correctos - estado: false'
            });
        }
        
        const validPassword = bcryptjs.compareSync(password, usuario.password);
        if (!validPassword) {
            return res.status(400).json({
                msg: 'Usuario / Password no son correctos - password',
                ok: false
            });
        }
                
        const payload = await buildAuthPayload(usuario);
        
        return res.status(200).json(payload);
    } catch (error) {
        console.error('Error en login:', error);

        return res.status(500).json({
            msg: error?.message || error || 'Hable con el administrador',
            ok: false
        });
    }
};

const renovarToken = async (req = require, res = response) => {
    const refreshToken = req.header('x-refresh-token') || req.body?.refreshToken;

    if (!refreshToken || typeof refreshToken !== 'string') {
        return res.status(401).json({
            msg: 'Refresh token requerido',
            ok: false
        });
    }

    try {
        const { uid } = jwt.verify(refreshToken, process.env.SECRETORPRIVATEKEY);
        const usuario = await Usuario.findById(uid);

        if (!usuario || !usuario.estado || !usuario.refreshTokenHash) {
            return res.status(401).json({
                msg: 'Token no valido - usuario no disponible',
                ok: false
            });
        }

        const refreshTokenValido = bcryptjs.compareSync(refreshToken, usuario.refreshTokenHash);

        if (!refreshTokenValido) {
            usuario.refreshTokenHash = '';
            await usuario.save();
            return res.status(401).json({
                msg: 'Refresh token invalido',
                ok: false
            });
        }

        const payload = await buildAuthPayload(usuario);

        return res.status(200).json(payload);
    } catch (error) {
        return res.status(401).json({
            msg: 'No fue posible renovar el token',
            ok: false
        });
    }
};

const logout = async (req = require, res = response) => {
    const refreshToken = req.header('x-refresh-token') || req.body?.refreshToken;

    if (!refreshToken || typeof refreshToken !== 'string') {
        return res.status(200).json({
            ok: true,
            msg: 'Sesion cerrada'
        });
    }

    try {
        const { uid } = jwt.verify(refreshToken, process.env.SECRETORPRIVATEKEY);
        const usuario = await Usuario.findById(uid);

        if (usuario) {
            const matches =
                usuario.refreshTokenHash &&
                bcryptjs.compareSync(refreshToken, usuario.refreshTokenHash);

            if (matches) {
                usuario.refreshTokenHash = '';
                await usuario.save();
            }
        }
    } catch (_) {
    }

    return res.status(200).json({
        ok: true,
        msg: 'Sesion cerrada'
    });
};

module.exports = {
    login,
    renovarToken,
    logout
};
