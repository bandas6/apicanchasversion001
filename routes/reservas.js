const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT, validarJWTOptional } = require("../middlewares/validar-jwt");
const {
    obtenerReservas,
    obtenerReserva,
    guardarReserva,
    actualizarReserva,
    obtenerReservasCancha,
    obtenerDisponibilidadCancha,
    obtenerMisReservas,
    cancelarMiReserva,
    cerrarReserva,
    obtenerReviewComplejoReserva,
    crearReviewComplejo,
    editarReviewComplejo,
    evaluarUsuarioReserva,
    repetirReserva,
    crearWaitlistReserva,
    obtenerMiWaitlist,
} = require("../controllers/reservas.controller");
const {
    esAdminRol,
    puedeGestionarReserva,
} = require("../middlewares/validar-roles");

const router = Router();

router.get('/mias', [
    validarJWT,
    validarCampos,
], obtenerMisReservas);

router.get('/waitlist/mias', [
    validarJWT,
    validarCampos,
], obtenerMiWaitlist);

router.get('/', [
    validarJWT,
    esAdminRol,
    validarCampos,
], obtenerReservas);

router.get('/admin/mis-complejos', [
    validarJWT,
    esAdminRol,
    validarCampos,
], obtenerReservas);

router.get('/cancha/:id', [
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerReservasCancha);

router.get('/disponibilidad/:id', [
    validarJWTOptional,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerDisponibilidadCancha);

router.get('/:id',
    validarJWT,
    puedeGestionarReserva,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerReserva);

router.post('/', [
    validarJWTOptional,
    check('complejo', 'No es un id valido').isMongoId(),
    check('cancha', 'No es un id valido').isMongoId(),
    validarCampos
], guardarReserva);

router.post('/waitlist', [
    validarJWT,
    check('complejo', 'No es un id valido').isMongoId(),
    check('cancha', 'No es un id valido').isMongoId(),
    validarCampos,
], crearWaitlistReserva);

router.put('/:id', [
    validarJWT,
    puedeGestionarReserva,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarReserva);

router.patch('/:id/cancelar', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], cancelarMiReserva);

router.post('/:id/repetir', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], repetirReserva);

router.post('/:id/cerrar', [
    validarJWT,
    puedeGestionarReserva,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], cerrarReserva);

router.get('/:id/review-complejo', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerReviewComplejoReserva);

router.post('/:id/review-complejo', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], crearReviewComplejo);

router.patch('/:id/review-complejo', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], editarReviewComplejo);

router.post('/:id/evaluacion-usuario', [
    validarJWT,
    puedeGestionarReserva,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], evaluarUsuarioReserva);

module.exports = router;
