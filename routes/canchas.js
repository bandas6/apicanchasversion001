const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { obtenerCancha, obtenerCanchas, guardarCancha, guardarYAgregarCanchaAComplejo, actualizarCancha, eliminarCancha } = require("../controllers/canchas.controller");


const router = Router()



router.get('/', obtenerCanchas);

router.get('/:id', 
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerCancha);

router.post('/', [
    validarJWT,
    check('complejo', 'No es un id valido').isMongoId(),
    validarCampos
], guardarCancha);

router.put('/complejo/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], guardarYAgregarCanchaAComplejo);

router.put('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarCancha);

router.delete('/eliminar/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], eliminarCancha);


module.exports = router;