const { Router } = require("express");
const {
    obtenerRoles,
    obtenerCatalogosApp,
} = require("../controllers/listas-maestras.controller");


const router = Router()


router.get('/app', obtenerCatalogosApp);
router.get('/roles', [
    // validarJWT,
    // validarCampos
], obtenerRoles);


module.exports = router;
