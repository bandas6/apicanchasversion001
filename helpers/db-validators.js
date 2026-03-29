const Complejos = require("../models/complejos");
const Equipos = require("../models/equipos");
const Partidos = require("../models/partidos");
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

const equipoExiste = async (nombre) => {

    const equipo = await Equipos.findOne({ nombre });

    if (equipo) {
        throw new Error(`El nombre ${equipo.nombre} ya existe`);
    }

}

const nombreComplejoExise = async (nombre) => {

    const complejo = await Complejos.findOne({ nombre });

    if (complejo) {
        throw new Error(`El nombre ${complejo.nombre} ya existe`);
    }

}

const partidoExiste = async (usuarios) => {
    const usuarioUno = usuarios.usuarioUno;
    const usuarioDos = usuarios.usuarioDos;

    // Busca un partido donde ambos usuarios estén presentes
    const partido = await Partidos.findOne({
        $or: [
            { 'usuarios.usuarioUno': usuarioUno, 'usuarios.usuarioDos': usuarioDos },
            { 'usuarios.usuarioUno': usuarioDos, 'usuarios.usuarioDos': usuarioUno }
        ]
    });

    console.log(partido);

    if (partido) {
        throw new Error(`Ya has enviado una solicitud a este equipo`);
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

    // console.log(rol)

    const existeRol = await Roles.findOne({ rol });

    if (!existeRol) {
        throw new Error(`El rol ${rol} no está registrado el la DB`)
    }

}

const esRolAdministrableValido = async (rol = '') => {
    const allowedRoles = ['USER_ROL', 'ADMIN_ROL'];

    if (!allowedRoles.includes(rol)) {
        throw new Error(`El rol ${rol} no es administrable`);
    }
}

const esRolGeneralAdministrableValido = async (rol = '') => {
    const allowedRoles = ['ADMIN_ROL', 'ADMIN_GENERAL_ROL'];

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
    equipoExiste,
    usuarioConEquipoRegistrado,
    partidoExiste,
    nombreComplejoExise,
    esRolAdministrableValido,
    esRolGeneralAdministrableValido,
    esEstadoIdentidadValido
}
