const { Router } = require('express');
const { check } = require('express-validator');
const { validarJWT } = require('../middlewares/validar-jwt');
const { esAdminGeneralRol } = require('../middlewares/validar-roles');
const { validarCampos } = require('../middlewares/validar-campos');
const { uploadMemory } = require('../middlewares/upload-memory');
const {
    crearReclamoComplejo,
    obtenerMisReclamosComplejo,
    obtenerReclamosComplejoAdmin,
    revisarReclamoComplejo,
} = require('../controllers/complex-claims.controller');

const router = Router();

router.get('/me', [
    validarJWT,
    validarCampos,
], obtenerMisReclamosComplejo);

router.post('/complejos/:id', [
    validarJWT,
    uploadMemory.single('documentoRespaldo'),
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], crearReclamoComplejo);

router.get('/admin', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], obtenerReclamosComplejoAdmin);

router.patch('/admin/:id', [
    validarJWT,
    esAdminGeneralRol,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], revisarReclamoComplejo);

module.exports = router;
