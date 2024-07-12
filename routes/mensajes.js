const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { recibirMensaje, enviarMensaje } = require("../controllers/mensajes.controller");

const router = Router()

// Enviar un mensaje
router.post('/enviar', [
    validarJWT,
    validarCampos
], enviarMensaje);

// Recibir mensajes
router.get('/recibir/:usuarioId', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], recibirMensaje);

module.exports = router;