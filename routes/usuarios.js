const { Router } = require("express");
const { check } = require("express-validator");
const {
    guardarUsuario,
    obtenerUsuarios,
    obtenerMiUsuario,
    obtenerUsuario,
    actualizarUsuario,
    actualizarMiUsuario,
    eliminarUsuario,
    actualizarRolUsuario,
    actualizarRolGeneralUsuario,
    actualizarDocumentosIdentidadUsuario,
    actualizarVerificacionIdentidadUsuario,
    obtenerAuditoriaRoles
} = require("../controllers/usuarios.controller");
const {
    usuarioExiste,
    esRolValido,
    usuarioNoExiste,
    esRolAdministrableValido,
    esRolGeneralAdministrableValido,
    esEstadoIdentidadValido,
} = require("../helpers/db-validators");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    esAdminRol,
    esAdminGeneralRol,
    usuarioEsJugador,
    esMismoUsuarioOAdmin,
} = require("../middlewares/validar-roles");

const router = Router();

router.get('/', obtenerUsuarios);

router.get('/me', [
    validarJWT,
    validarCampos
], obtenerMiUsuario);

router.get('/:id', [
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], obtenerUsuario);

router.post('/', [
    check('correo', 'el correo no es valido').isEmail(),
    check('nombre', 'el nombre es requerido').not().isEmpty(),
    check('apellido', 'el apellido es requerido').not().isEmpty(),
    check('password', 'el password debe tener mas de 6 caracteres').isLength({ min: 6 }),
    check('correo').custom(usuarioExiste),
    validarCampos
], guardarUsuario);

router.put('/me', [
    validarJWT,
    usuarioEsJugador,
    validarCampos
], actualizarMiUsuario);

router.put('/:id', [
    validarJWT,
    esMismoUsuarioOAdmin,
    check('rol').optional().custom(esRolValido),
    check('id').custom(usuarioNoExiste),
    usuarioEsJugador,
    validarCampos
], actualizarUsuario);

router.patch('/:id/rol', [
    validarJWT,
    esAdminGeneralRol,
    check('id', 'No es un id valido').isMongoId(),
    check('id').custom(usuarioNoExiste),
    check('rol').custom(esRolAdministrableValido),
    validarCampos
], actualizarRolUsuario);

router.patch('/:id/rol-general', [
    validarJWT,
    esAdminGeneralRol,
    check('id', 'No es un id valido').isMongoId(),
    check('id').custom(usuarioNoExiste),
    check('rol').custom(esRolGeneralAdministrableValido),
    validarCampos
], actualizarRolGeneralUsuario);

router.patch('/:id/identidad-documentos', [
    validarJWT,
    esMismoUsuarioOAdmin,
    check('id', 'No es un id valido').isMongoId(),
    check('id').custom(usuarioNoExiste),
    validarCampos
], actualizarDocumentosIdentidadUsuario);

router.patch('/:id/identidad-verificacion', [
    validarJWT,
    esAdminGeneralRol,
    check('id', 'No es un id valido').isMongoId(),
    check('id').custom(usuarioNoExiste),
    check('estado').custom(esEstadoIdentidadValido),
    validarCampos
], actualizarVerificacionIdentidadUsuario);

router.get('/admin/auditoria-roles', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos
], obtenerAuditoriaRoles);

router.delete('/:id', [
    validarJWT,
    esAdminRol,
    check('id', 'No es un id valido').isMongoId(),
    check('id').custom(usuarioNoExiste),
    validarCampos
], eliminarUsuario);

module.exports = router;
