const { Router } = require('express');
const { validarJWT } = require('../middlewares/validar-jwt');
const { esAdminGeneralRol } = require('../middlewares/validar-roles');
const { validarCampos } = require('../middlewares/validar-campos');
const { obtenerUsuarios } = require('../controllers/usuarios.controller');
const { obtenerComplejos } = require('../controllers/complejos.controller');
const { obtenerReservas } = require('../controllers/reservas.controller');
const { obtenerAuditoriaAdminGeneral, obtenerDashboardOperacion } = require('../controllers/admin-general.controller');

const router = Router();

router.get('/usuarios', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], obtenerUsuarios);

router.get('/complejos', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], obtenerComplejos);

router.get('/reservas', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], obtenerReservas);

router.get('/auditoria', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], obtenerAuditoriaAdminGeneral);

router.get('/dashboard-operacion', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], obtenerDashboardOperacion);

module.exports = router;
