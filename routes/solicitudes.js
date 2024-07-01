const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { obtenerSolicitud, obtenerSolicitudes, guardarSolicitud, actualizarSolicitud } = require("../controllers/solicitudes.controller");
const { solicitudYaExiste } = require("../middlewares/validar-generales");


const router = Router()



router.get('/', [
    validarJWT
    ],obtenerSolicitudes);

router.get('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos],
    obtenerSolicitud);

router.post('/', [
    validarJWT,
    // check('usuario').custom(solicitudYaExiste),
    validarCampos
], guardarSolicitud);

router.put('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    // check('usuarios').custom(partidoExiste),
    validarCampos
], actualizarSolicitud
);


module.exports = router;