const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT } = require('../middlewares/validar-jwt');
const { esAdminGeneralRol } = require('../middlewares/validar-roles');
const {
    listarCoberturasActivas,
    listarCoberturasAdmin,
    crearCobertura,
    actualizarCobertura,
} = require('../controllers/coberturas-geograficas.controller');

const router = Router();

router.get('/', listarCoberturasActivas);

router.get('/admin', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], listarCoberturasAdmin);

router.post('/', [
    validarJWT,
    esAdminGeneralRol,
    validarCampos,
], crearCobertura);

router.put('/:id', [
    validarJWT,
    esAdminGeneralRol,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], actualizarCobertura);

module.exports = router;
