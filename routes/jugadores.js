const { Router } = require("express");
const { check } = require("express-validator");
const {
    obtenerJugadoresPublicos,
    obtenerJugadorPublico,
} = require("../controllers/usuarios.controller");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWTOptional } = require("../middlewares/validar-jwt");

const router = Router();

// Fase 3: publicas (sin login se puede buscar), pero con validarJWTOptional
// para que, si hay sesion, obtenerUsuarios pueda excluir bloqueos
// reciprocos -- sin esto req.usuarioAuth nunca se completa aca y ese filtro
// nunca se activa.
router.get("/", [
    validarJWTOptional,
    validarCampos,
], obtenerJugadoresPublicos);

router.get("/:id", [
    validarJWTOptional,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerJugadorPublico);

module.exports = router;
