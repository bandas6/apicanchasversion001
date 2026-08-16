const { Router } = require('express');
const { check } = require('express-validator');
const { crearReporte, listarReportes } = require('../controllers/reportes.controller');
const { validarJWT } = require('../middlewares/validar-jwt');
const { validarCampos } = require('../middlewares/validar-campos');
const { esAdminRol } = require('../middlewares/validar-roles');
const { TIPOS_REPORTE, MOTIVOS_REPORTE } = require('../models/reportes');

const router = Router();

router.post('/', [
    validarJWT,
    check('tipo', 'El tipo debe ser usuario o equipo').isIn(TIPOS_REPORTE),
    check('objetivoId', 'No es un id valido').isMongoId(),
    check('motivo', 'El motivo no es valido').isIn(MOTIVOS_REPORTE),
    validarCampos,
], crearReporte);

router.get('/', [validarJWT, esAdminRol], listarReportes);

module.exports = router;
