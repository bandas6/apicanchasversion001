const { Router } = require("express");
const { guardarEquipo, obtenerEquipos, obtenerEquiposDestacados, obtenerEquipo, obtenerJugadoresPorEquipo, actualizarEquipo, eliminarEquipo } = require("../controllers/equipos.controller");
const { validarJWT } = require("../middlewares/validar-jwt");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { equipoExiste, usuarioConEquipoRegistrado } = require("../helpers/db-validators");
const { puedeGestionarEquipo } = require("../middlewares/validar-roles");


const router = Router()


router.get('/', obtenerEquipos);

router.get('/destacados', obtenerEquiposDestacados);

router.get('/:id/jugadores', [
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], obtenerJugadoresPorEquipo);

router.get('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], obtenerEquipo);

router.put('/:id', [
    validarJWT,
    puedeGestionarEquipo,
    // check('nombre', 'El nombre del equipo debe ser un texto').isAlpha(),
    validarCampos
], actualizarEquipo);

router.post('/', [
    validarJWT,
    puedeGestionarEquipo,
    check('nombre', 'El nombre del equipo es obligatorio').not().isEmpty(),
    // check('nombre', 'El nombre del equipo debe ser un texto').isAlpha(),
    check('usuario', 'el id no es valido').isMongoId(),
    check('nombre').custom(equipoExiste),
    check('usuario').custom(usuarioConEquipoRegistrado),
    validarCampos,
], guardarEquipo);

router.delete('/:id', [
    validarJWT,
    puedeGestionarEquipo,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], eliminarEquipo)


module.exports = router;
