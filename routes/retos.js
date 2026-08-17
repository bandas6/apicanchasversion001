const { Router } = require('express');
const { check } = require('express-validator');
const {
    crearReto,
    obtenerRetosDeEquipo,
    obtenerReto,
    responderReto,
    vincularReserva,
    marcarJugado,
    cancelarReto,
} = require('../controllers/retos.controller');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarCampos } = require('../middlewares/validar-campos');

const router = Router();

// Ruta fija antes de '/:id' para que Express no confunda 'equipo' con un id
// de reto -- mismo motivo que 'mis-equipos'/'mis-solicitudes' en equipos.js.
router.get('/equipo/:equipoId', [
    validarJWT,
    check('equipoId', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerRetosDeEquipo);

router.post('/', [
    validarJWT,
    check('equipoRetadorId', 'No es un id valido').isMongoId(),
    check('equipoRetadoId', 'No es un id valido').isMongoId(),
    validarCampos,
], crearReto);

router.get('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerReto);

router.put('/:id/responder', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    check('aceptar', 'Debes indicar si aceptas o no el reto').isBoolean(),
    validarCampos,
], responderReto);

router.put('/:id/reserva', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    check('reservaId', 'No es un id valido').isMongoId(),
    validarCampos,
], vincularReserva);

router.put('/:id/jugado', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], marcarJugado);

router.delete('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], cancelarReto);

module.exports = router;
