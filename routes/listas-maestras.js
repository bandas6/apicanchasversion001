const { Router } = require("express");
const { obtenerRoles } = require("../controllers/listas-maestras.controller");


const router = Router()


router.get('/roles', [
    // validarJWT,
    // validarCampos
], obtenerRoles);


module.exports = router;