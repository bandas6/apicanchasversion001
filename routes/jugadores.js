const { Router } = require("express");
const { check } = require("express-validator");
const {
    obtenerJugadoresPublicos,
    obtenerJugadorPublico,
} = require("../controllers/usuarios.controller");
const { validarCampos } = require("../middlewares/validar-campos");

const router = Router();

router.get("/", [
    validarCampos,
], obtenerJugadoresPublicos);

router.get("/:id", [
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
], obtenerJugadorPublico);

module.exports = router;
