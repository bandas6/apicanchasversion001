const { response } = require("express");
const bcryptjs = require('bcryptjs');

const Usuario = require("../models/usuarios");
const { generarJWT } = require("../helpers/generar-jwt");


const login = async (req = require, res = response) => {

    const { correo, password } = req.body;
    
    try {
        
        const usuario = await Usuario.findOne({ correo });
        
        //Verificar si usuario existe
        if (!usuario) {
            return res.status(400).json({
                msg: 'El usuario no existe'
            })
        }

        //Verificar si no esta eliminado
        if (!usuario.estado) {
            return res.status(400).json({
                msg: 'Usuario / Password no son correctos - estado: false'
            })
        }
        
        // Verificar contrasena
        const validPassword = bcryptjs.compareSync(password, usuario.password);
        if (!validPassword) {
            return res.status(400).json({
                msg: 'Usuario / Password no son correctos - password',
                ok: false
            })
        }
                
        // Generar el JWT
        const token = await generarJWT(usuario.id);
        
        return res.status(200).json({
            usuario,
            token,
            ok: false
        })

    } catch (error) {

        return res.status(500).json({
            msg: 'Hable con el administrador'
        })

    }

}

module.exports = {
    login
}