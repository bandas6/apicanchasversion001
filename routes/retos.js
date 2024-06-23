const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { obtenerRetos, guardarYAgregarRetosAEquipos, obtenerReto, actualizarReto } = require("../controllers/retos.controller");
const { retoYaExistente } = require("../middlewares/validar-generales");


const router = Router()



router.get('/', [
    validarJWT,
    validarCampos
    ],
    obtenerRetos);

router.get('/:id', 
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerReto);

router.put('/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    // check('usuarioRetado').custom(retoYaExistente),
    validarCampos
], actualizarReto);

router.put('/equipo/:id', [
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    // check('usuarioRetado').custom(retoYaExistente),
    validarCampos
], guardarYAgregarRetosAEquipos);


module.exports = router;