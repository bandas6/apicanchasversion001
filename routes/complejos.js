const { Router } = require("express");
const { nombreComplejoExise } = require("../helpers/db-validators");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    guardarComplejo,
    obtenerComplejo,
    obtenerComplejos,
    obtenerCanchasPorComplejo,
    actualizarComplejo
} = require("../controllers/complejos.controller");
const { puedeGestionarComplejo } = require("../middlewares/validar-roles");

const router = Router();

router.get('/', obtenerComplejos);

router.get('/:id/canchas',
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerCanchasPorComplejo);

router.get('/:id',
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerComplejo);

router.post('/', [
    validarJWT,
    puedeGestionarComplejo,
    check('nombre').custom(nombreComplejoExise),
    validarCampos
], guardarComplejo);

router.put('/:id', [
    validarJWT,
    puedeGestionarComplejo,
    validarCampos
], actualizarComplejo);

module.exports = router;
