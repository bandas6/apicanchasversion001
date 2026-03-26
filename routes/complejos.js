const { Router } = require("express");
const { nombreComplejoExise } = require("../helpers/db-validators");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { guardarComplejo, obtenerComplejo, obtenerComplejos, obtenerCanchasPorComplejo, actualizarComplejo } = require("../controllers/complejos.controller");


const router = Router()



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
    check('administrador', 'No es un id valido').isMongoId(),
    check('nombre').custom(nombreComplejoExise),
    // check('nombre').custom(ComplejoExiste),
    validarCampos
], guardarComplejo);

router.put('/:id', [
    validarJWT,
    check('administrador', 'No es un id valido').isMongoId(),
    // check('nombre').custom(nombreComplejoExise),
    // check('nombre').custom(ComplejoExiste),
    validarCampos
], actualizarComplejo);

module.exports = router;
