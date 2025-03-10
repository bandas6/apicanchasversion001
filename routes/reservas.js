const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { obtenerReservas, obtenerReserva, guardarReserva, actualizarReserva, obtenerReservasCancha, actualizarHoraHorario, actualizarEstadoUsuario, renombrarCampo } = require("../controllers/reservas.controller");
const { diaYaExiste } = require("../middlewares/validar-generales");

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
    // check('dia').custom(diaYaExiste),
    validarCampos
], guardarReserva);

router.put('/:id', [
    validarJWT,
    // check('dia').custom(diaYaExiste),
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarReserva);

router.post('/cambiarNombre/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], renombrarCampo);

router.put('/:id/horario/:horarioId', [
    validarJWT,
    // check('dia').custom(diaYaExiste),
    check('id', 'No es un id valido').isMongoId(),
    check('horarioId', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarHoraHorario);

router.put('/:idReserva/horario/:horarioId/usuario/:usuarioId',[
    validarJWT,
    check('idReserva', 'No es un id valido').isMongoId(),
    check('horarioId', 'No es un id valido').isMongoId(),
    check('usuarioId', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarEstadoUsuario)


module.exports = router;