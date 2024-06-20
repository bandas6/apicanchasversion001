const { Router } = require("express");
const { nombreComplejoExise } = require("../helpers/db-validators");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { guardarComplejo, obtenerComplejo, obtenerComplejos } = require("../controllers/complejos.controller");


const router = Router()



router.get('/', obtenerComplejos);

router.get('/:id', 
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerComplejo);

router.post('/', [
    validarJWT,
    check('administrador', 'No es un id valido').isMongoId(),
    check('nombre').custom(nombreComplejoExise),
    validarCampos
], guardarComplejo);


module.exports = router;