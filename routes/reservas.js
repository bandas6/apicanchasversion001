const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { obtenerReservas, obtenerReserva, guardarReserva, actualizarReserva, obtenerReservasCancha } = require("../controllers/reservas.controller");

const router = Router();

router.get('/', [
    validarJWT,
    validarCampos,
], obtenerReservas);

router.get('/cancha/:id', [
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerReservasCancha);

router.get('/:id',
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerReserva);

router.post('/', [
    check('complejo', 'No es un id valido').isMongoId(),
    check('cancha', 'No es un id valido').isMongoId(),
    validarCampos
], guardarReserva);

router.put('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarReserva);

module.exports = router;
