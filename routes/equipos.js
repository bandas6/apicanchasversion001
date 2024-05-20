const { Router } = require("express");
const { guardarEquipo, obtenerEquipos, obtenerEquipo, actualizarEquipo, eliminarEquipo } = require("../controllers/equipos.controller");
const { validarJWT } = require("../middlewares/validar-jwt");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { equipoExiste, usuarioConEquipoRegistrado } = require("../helpers/db-validators");


const router = Router()


router.get('/', obtenerEquipos);

router.get('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], obtenerEquipo);

router.put('/:id', [
    validarJWT,
    // check('nombre', 'El nombre del equipo debe ser un texto').isAlpha(),
    validarCampos
], actualizarEquipo);

router.post('/', [
    validarJWT,
    check('nombre', 'El nombre del equipo es obligatorio').not().isEmpty(),
    // check('nombre', 'El nombre del equipo debe ser un texto').isAlpha(),
    check('usuario', 'el id no es valido').isMongoId(),
    check('nombre').custom(equipoExiste),
    check('usuario').custom(usuarioConEquipoRegistrado),
    validarCampos,
], guardarEquipo);

router.delete('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], eliminarEquipo)


module.exports = router;