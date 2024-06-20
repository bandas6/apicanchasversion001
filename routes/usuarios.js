const { Router } = require("express");
const { check } = require("express-validator");
const { guardarUsuario, obtenerUsuarios, obtenerUsuario, actualizarUsuario, eliminarUsuario } = require("../controllers/usuarios.controller");
const { usuarioExiste, esRolValido, usuarioNoExiste, usuarioConCorreoNoExiste } = require("../helpers/db-validators");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRol, usuarioEsJugador } = require("../middlewares/validar-roles");


const router = Router();

router.get('/', obtenerUsuarios);

router.get('/:id',[
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
],obtenerUsuario);

router.post('/',[
    check('correo', 'el correo no es válido').isEmail(),
    check('nombre', 'el nombre es requerido').not().isEmpty(),
    check('apellido', 'el apellido es requerido').not().isEmpty(),
    check('password', 'el password debe tener mas de 6 caracteres').isLength({ min: 6 }),
    check('rol').custom(esRolValido),
    check('correo').custom(usuarioExiste),
    // check('valoracion','rol').custom(usuarioEsJugador),
    validarCampos
], guardarUsuario);

router.put('/:id',[
    check('rol').custom(esRolValido),
    check('id').custom(usuarioNoExiste),
    usuarioEsJugador,
    validarCampos
], actualizarUsuario);


router.delete('/:id',[
    validarJWT,
    esAdminRol,
    check('id', 'No es un id valido').isMongoId(),
    check('id').custom(usuarioNoExiste),
    validarCampos
],eliminarUsuario)



module.exports = router;
