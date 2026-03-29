const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { obtenerHistorialReserva, obtenerHistorialReservas, guardarHistorialReserva, actualizarHistorialReserva } = require("../controllers/historial-reservas.controller");
const { esAdminRol } = require("../middlewares/validar-roles");

const router = Router();

router.get('/', [
    validarJWT,
    esAdminRol,
    validarCampos,
], obtenerHistorialReservas);

router.get('/:id', [
    validarJWT,
    esAdminRol,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerHistorialReserva);

router.post('/', [
    validarJWT,
    esAdminRol,
    check('usuario_id', 'No es un id valido').isMongoId(),
    // check('dia').custom(diaYaExiste),
    validarCampos
], guardarHistorialReserva);

router.put('/:id', [
    validarJWT,
    esAdminRol,
    // check('dia').custom(diaYaExiste),
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], actualizarHistorialReserva);


module.exports = router;
