const { Router } = require('express');
const { check } = require('express-validator');
const {
    crearEquipo,
    obtenerEquipos,
    obtenerEquipo,
    actualizarEquipo,
    actualizarFotoEquipo,
    eliminarEquipo,
    obtenerMisEquipos,
    solicitarUnirseEquipo,
    invitarJugador,
    obtenerMisSolicitudes,
    obtenerSolicitudesDeEquipo,
    obtenerInvitacionesDeEquipo,
    responderMembresia,
    salirDelEquipo,
    expulsarMiembro,
    cancelarSolicitud,
} = require('../controllers/equipos.controller');
const { validarJWT, validarJWTOptional } = require('../middlewares/validar-jwt');
const { validarCampos } = require('../middlewares/validar-campos');
const { uploadMemory } = require('../middlewares/upload-memory');

const router = Router();

// Rutas fijas antes de '/:id' para que Express no confunda 'mis-equipos'
// o 'mis-solicitudes' con un id de equipo.
router.get('/mis-equipos', [validarJWT], obtenerMisEquipos);

router.get('/mis-solicitudes', [validarJWT], obtenerMisSolicitudes);

// Fase 3: publicas (sin login se puede navegar/buscar), pero con
// validarJWTOptional para que, si hay sesion, el controller pueda excluir
// bloqueos reciprocos y decidir cuanto roster mostrar (ver obtenerEquipo).
router.get('/', [validarJWTOptional], obtenerEquipos);

router.get('/:id', [
    validarJWTOptional,
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

router.patch('/:id/foto', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    uploadMemory.single('foto'),
    validarCampos,
], actualizarFotoEquipo);

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

router.get('/:id/invitaciones', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerInvitacionesDeEquipo);

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
