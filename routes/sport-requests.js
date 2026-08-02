const { Router } = require('express');
const { check } = require('express-validator');
const { validarJWT } = require('../middlewares/validar-jwt');
const { esAdminRol, esAdminGeneralRol } = require('../middlewares/validar-roles');
const { validarCampos } = require('../middlewares/validar-campos');
const {
    crearSolicitudDeporte,
    obtenerMisSolicitudesDeporte,
    obtenerSolicitudesDeporteAdmin,
    revisarSolicitudDeporte,
} = require('../controllers/sport-requests.controller');

const router = Router();

router.get('/me', [
    validarJWT,
], obtenerMisSolicitudesDeporte);

router.post('/', [
    validarJWT,
    esAdminRol,
], crearSolicitudDeporte);

router.get('/admin', [
    validarJWT,
    esAdminGeneralRol,
], obtenerSolicitudesDeporteAdmin);

router.patch('/admin/:id', [
    validarJWT,
    esAdminGeneralRol,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], revisarSolicitudDeporte);

module.exports = router;
