const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { obtenerHistorialReserva, obtenerHistorialReservas, guardarHistorialReserva, actualizarHistorialReserva } = require("../controllers/historial-reservas.controller");

const router = Router();

router.get('/', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerHistorialReservas);

router.get('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerHistorialReserva);

router.post('/', [
    validarJWT,
    check('usuario_id', 'No es un id valido').isMongoId(),
    // check('dia').custom(diaYaExiste),
    validarCampos
], guardarHistorialReserva);

router.put('/:id', [
    validarJWT,
    // check('dia').custom(diaYaExiste),
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarHistorialReserva);


module.exports = router;