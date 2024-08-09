const Roles = require("../models/roles.modelo");
const Usuario = require("../models/usuarios.modelo");

const usuarioExiste = async (correo) => {

    const usuario = await Usuario.findOne({ correo });

    if (usuario) {
        throw new Error(`Ya existe un usuario registrado con este correo`);
    }

}


const usuarioConCorreoNoExiste = async (correo) => {

    const usuario = await Usuario.findOne({ correo });

    if (!usuario) {
        throw new Error(`El correo ${correo} no existe`);
    }

}


module.exports = {
    usuarioExiste,
    usuarioConCorreoNoExiste,

}