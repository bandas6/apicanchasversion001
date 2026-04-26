const { Router } = require("express");
const { validarCampos } = require("../middlewares/validar-campos");
const { uploadMemory } = require("../middlewares/upload-memory");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { uploadMemory } = require("../middlewares/upload-memory");
const {
    obtenerCancha,
    obtenerCanchas,
    guardarCancha,
    guardarYAgregarCanchaAComplejo,
    actualizarCancha,
    eliminarCancha
} = require("../controllers/canchas.controller");
const { puedeGestionarCancha } = require("../middlewares/validar-roles");

const router = Router();

router.get('/', obtenerCanchas);

router.get('/:id',
    validarJWT,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerCancha);

router.post('/', [
    validarJWT,
    uploadMemory.fields([
        { name: 'portada', maxCount: 1 },
        { name: 'galeria', maxCount: 5 },
    ]),
    check('complejoId', 'No es un id valido').optional().isMongoId(),
    check('complejo', 'No es un id valido').optional().isMongoId(),
    validarCampos,
    puedeGestionarCancha,
<<<<<<< HEAD
=======
    uploadMemory.fields([
        { name: 'portada', maxCount: 1 },
        { name: 'galeria', maxCount: 5 },
    ]),
    check('complejo', 'No es un id valido').isMongoId(),
    validarCampos
>>>>>>> 93d4cfc (sync)
], guardarCancha);

router.put('/complejo/:id', [
    validarJWT,
    puedeGestionarCancha,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], guardarYAgregarCanchaAComplejo);

router.put('/:id', [
    validarJWT,
<<<<<<< HEAD
=======
    puedeGestionarCancha,
>>>>>>> 93d4cfc (sync)
    uploadMemory.fields([
        { name: 'portada', maxCount: 1 },
        { name: 'galeria', maxCount: 5 },
    ]),
    check('id', 'No es un id valido').isMongoId(),
    check('complejoId', 'No es un id valido').optional().isMongoId(),
    check('complejo', 'No es un id valido').optional().isMongoId(),
    validarCampos,
    puedeGestionarCancha,
], actualizarCancha);

router.delete('/eliminar/:id', [
    validarJWT,
    puedeGestionarCancha,
    check('id', 'No es un id valido').isMongoId(),
    validarCampos
], eliminarCancha);

module.exports = router;
