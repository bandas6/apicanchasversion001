const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT, validarJWTOptional } = require('../middlewares/validar-jwt');
const { uploadMemory } = require('../middlewares/upload-memory');
const { esAdminRol, esAdminGeneralRol } = require('../middlewares/validar-roles');
const {
    obtenerMensajesPublicos,
    obtenerMensajesAdmin,
    obtenerMensajesPendientes,
    crearMensajeCentro,
    actualizarMensajeCentro,
    revisarMensajeCentro,
    subirImagenMensajeCentro,
} = require('../controllers/centro-mensajes.controller');

const router = Router();

router.get('/', [
    validarJWTOptional,
    validarCampos,
], obtenerMensajesPublicos);

router.get('/admin', [
    validarJWT,
    esAdminRol,
    validarCampos,
], obtenerMensajesAdmin);

router.get('/admin/pendientes', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], obtenerMensajesPendientes);

router.post('/', [
    validarJWT,
    esAdminRol,
    validarCampos,
], crearMensajeCentro);

router.post('/upload-image', [
    validarJWT,
    esAdminRol,
    uploadMemory.single('imagen'),
    validarCampos,
], subirImagenMensajeCentro);

router.put('/:id', [
    validarJWT,
    esAdminRol,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], actualizarMensajeCentro);

router.patch('/:id/revision', [
    validarJWT,
    esAdminGeneralRol,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], revisarMensajeCentro);

module.exports = router;
