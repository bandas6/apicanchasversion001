const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT } = require('../middlewares/validar-jwt');
const { esAdminRol, esAdminGeneralRol } = require('../middlewares/validar-roles');
const {
    obtenerPistasPublicas,
    obtenerPistasAdmin,
    crearPistaHome,
    actualizarPistaHome,
    revisarPistaHome,
} = require('../controllers/pistas-home.controller');

const router = Router();

router.get('/', obtenerPistasPublicas);

router.get('/admin', [
    validarJWT,
    esAdminRol,
    validarCampos,
], obtenerPistasAdmin);

router.post('/', [
    validarJWT,
    esAdminRol,
    validarCampos,
], crearPistaHome);

router.put('/:id', [
    validarJWT,
    esAdminRol,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], actualizarPistaHome);

router.patch('/:id/revision', [
    validarJWT,
    esAdminGeneralRol,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], revisarPistaHome);

module.exports = router;
