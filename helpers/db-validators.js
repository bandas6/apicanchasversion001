const Equipos = require("../models/equipos");
const Roles = require("../models/roles");
const Usuario = require("../models/usuarios");

const usuarioExiste = async (correo) => {

    const usuario = await Usuario.findOne({ correo });

    if (usuario) {
        throw new Error(`Ya existe un usuario registrado con este correo`);
    }

}

const equipoExiste = async (nombre) => {

    const equipo = await Equipos.findOne({ nombre });

    if (equipo) {
        throw new Error(`El nombre ${equipo.nombre} ya existe`);
    }

}

const usuarioConEquipoRegistrado = async (usuario) => {

    const equipo = await Equipos.findOne({ usuario });
    
    if (equipo) {
        throw new Error(`El usuario ya tiene un equipo registrado`);
    }

}

const usuarioConCorreoNoExiste = async (correo) => {

    const usuario = await Usuario.findOne({ correo });

    if (!usuario) {
        throw new Error(`El correo ${correo} no existe`);
    }

}

const usuarioNoExiste = async (id) => {

    const usuario = await Usuario.findById(id);

    if (!usuario) {
        throw new Error(`El usuario con id ${id} no existe`);
    }

}

const esRolValido = async (rol = '') => {

    if (rol == '') {
        rol = 'USER_ROL'
    }

    console.log(rol)

    const existeRol = await Roles.findOne({ rol });

    if (!existeRol) {
        throw new Error(`El rol ${rol} no está registrado el la DB`)
    }

}


module.exports = {
    usuarioExiste,
    esRolValido,
    usuarioNoExiste,
    usuarioConCorreoNoExiste,
    equipoExiste,
    usuarioConEquipoRegistrado
}