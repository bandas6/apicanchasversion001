const { Router } = require('express');
const { check } = require('express-validator');
const {
    crearEquipo,
    obtenerEquipos,
    obtenerEquipo,
    actualizarEquipo,
    eliminarEquipo,
    obtenerMisEquipos,
    solicitarUnirseEquipo,
    invitarJugador,
    obtenerMisSolicitudes,
    obtenerSolicitudesDeEquipo,
    responderMembresia,
    salirDelEquipo,
    expulsarMiembro,
    cancelarSolicitud,
} = require('../controllers/equipos.controller');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarCampos } = require('../middlewares/validar-campos');

const router = Router();

// Rutas fijas antes de '/:id' para que Express no confunda 'mis-equipos'
// o 'mis-solicitudes' con un id de equipo.
router.get('/mis-equipos', [validarJWT], obtenerMisEquipos);

router.get('/mis-solicitudes', [validarJWT], obtenerMisSolicitudes);

router.get('/', obtenerEquipos);

router.get('/:id', [
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerEquipo);

router.post('/', [
    validarJWT,
    check('nombre', 'El nombre del equipo es obligatorio').not().isEmpty(),
    check('deporte', 'El deporte no es un id valido').isMongoId(),
    validarCampos,
], crearEquipo);

router.put('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], actualizarEquipo);

router.delete('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], eliminarEquipo);

router.post('/:id/solicitudes', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], solicitarUnirseEquipo);

router.get('/:id/solicitudes', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerSolicitudesDeEquipo);

router.post('/:id/invitaciones', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    check('usuarioId', 'No es un id valido').isMongoId(),
    validarCampos,
], invitarJugador);

router.put('/:id/membresias/:membresiaId', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    check('membresiaId', 'No es un id valido').isMongoId(),
    check('aceptar', 'Debes indicar si aceptas o no la solicitud').isBoolean(),
    validarCampos,
], responderMembresia);

router.delete('/:id/membresias/:membresiaId', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    check('membresiaId', 'No es un id valido').isMongoId(),
    validarCampos,
], expulsarMiembro);

router.delete('/:id/membresia', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], salirDelEquipo);

router.delete('/solicitudes/:membresiaId', [
    validarJWT,
    check('membresiaId', 'No es un id valido').isMongoId(),
    validarCampos,
], cancelarSolicitud);

module.exports = router;
