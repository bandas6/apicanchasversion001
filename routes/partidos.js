const { Router } = require("express");
const { guardarPartido, obtenerPartidos, obtenerPartido,  } = require("../controllers/partidos.controller");
const { partidoExiste } = require("../helpers/db-validators");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");


const router = Router()



router.get('/', obtenerPartidos);

router.get('/:id', 
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerPartido);

router.post('/', [
    validarJWT,
    check('usuarios').custom(partidoExiste),
    validarCampos
], guardarPartido);


module.exports = router;
