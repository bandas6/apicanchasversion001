const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { obtenerReservas, obtenerReserva, guardarReserva, actualizarReserva, obtenerReservasCancha, actualizarHoraHorario } = require("../controllers/reservas.controller");
const { diaYaExiste } = require("../helpers/db-validators");

const router = Router();

router.get('/', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerReservas);

router.get('/cancha/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerReservasCancha);

router.get('/:id',
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerReserva);

router.post('/', [
    validarJWT,
    check('complejo', 'No es un id valido').isMongoId(),
    check('cancha', 'No es un id valido').isMongoId(),
    check('dia').custom(diaYaExiste),
    validarCampos
], guardarReserva);

router.put('/:id', [
    validarJWT,
    // check('dia').custom(diaYaExiste),
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarReserva);

router.put('/:id/horario/:horarioId', [
    validarJWT,
    // check('dia').custom(diaYaExiste),
    check('id', 'No es un id valido').isMongoId(),
    check('horarioId', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarHoraHorario);


module.exports = router;