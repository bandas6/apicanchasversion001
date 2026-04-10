const { Router } = require("express");
const { nombreComplejoExise } = require("../helpers/db-validators");
const { validarCampos } = require("../middlewares/validar-campos");
const { uploadMemory } = require("../middlewares/upload-memory");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    guardarComplejo,
    obtenerComplejo,
    obtenerComplejos,
    obtenerCanchasPorComplejo,
    actualizarComplejo,
    obtenerReviewsComplejo,
    reportarReviewComplejo,
    moderarReviewComplejo,
} = require("../controllers/complejos.controller");
const { puedeGestionarComplejo, esAdminGeneralRol } = require("../middlewares/validar-roles");

const router = Router();

router.get('/', obtenerComplejos);

router.get('/:id/canchas',
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerCanchasPorComplejo);

router.get('/:id',
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerComplejo);

router.get('/:id/reviews',
    check('id', 'No es un id valido').isMongoId(),
    validarCampos,
    obtenerReviewsComplejo);

router.post('/reviews/:reviewId/report', [
    validarJWT,
    check('reviewId', 'No es un id valido').isMongoId(),
    validarCampos,
], reportarReviewComplejo);

router.patch('/reviews/:reviewId/moderate', [
    validarJWT,
    esAdminGeneralRol,
    check('reviewId', 'No es un id valido').isMongoId(),
    validarCampos,
], moderarReviewComplejo);

router.post('/', [
    validarJWT,
    puedeGestionarComplejo,
    uploadMemory.fields([
        { name: 'portada', maxCount: 1 },
        { name: 'galeria', maxCount: 8 },
    ]),
    check('nombre').custom(nombreComplejoExise),
    validarCampos
], guardarComplejo);

router.put('/:id', [
    validarJWT,
    puedeGestionarComplejo,
    uploadMemory.fields([
        { name: 'portada', maxCount: 1 },
        { name: 'galeria', maxCount: 8 },
    ]),
    validarCampos
], actualizarComplejo);

module.exports = router;
