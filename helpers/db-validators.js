const Complejos = require("../models/complejos");
const Reservas = require("../models/reservas");
const Roles = require("../models/roles");
const Solicitudes = require("../models/solicitudes");
const Usuario = require("../models/usuarios");

const usuarioExiste = async (correo) => {

    const usuario = await Usuario.findOne({ correo });

    if (usuario) {
        throw new Error(`Ya existe un usuario registrado con este correo`);
    }

}

const nombreComplejoExise = async (nombre) => {

    const complejo = await Complejos.findOne({ nombre });

    if (complejo) {
        throw new Error(`El nombre ${complejo.nombre} ya existe`);
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
        rol = 'USER'
    }

    // console.log(rol)

    const existeRol = await Roles.findOne({ rol });

    if (!existeRol) {
        throw new Error(`El rol ${rol} no está registrado el la DB`)
    }

}

const esRolAdministrableValido = async (rol = '') => {
    const allowedRoles = ['USER', 'ADMIN'];

    if (!allowedRoles.includes(rol)) {
        throw new Error(`El rol ${rol} no es administrable`);
    }
}

const esRolGeneralAdministrableValido = async (rol = '') => {
    const allowedRoles = ['ADMIN', 'DEV'];

    if (!allowedRoles.includes(rol)) {
        throw new Error(`El rol ${rol} no es valido para gestion general`);
    }
}

const esEstadoIdentidadValido = async (estado = '') => {
    const allowedStates = ['pendiente', 'aprobada', 'rechazada'];

    if (!allowedStates.includes(estado)) {
        throw new Error(`El estado de identidad ${estado} no es valido`);
    }
}


module.exports = {
    usuarioExiste,
    esRolValido,
    usuarioNoExiste,
    usuarioConCorreoNoExiste,
    nombreComplejoExise,
    esRolAdministrableValido,
    esRolGeneralAdministrableValido,
    esEstadoIdentidadValido
}
