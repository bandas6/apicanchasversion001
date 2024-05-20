const { Router } = require("express");
const { guardarPartido, obtenerPartidos } = require("../controllers/partidos.controller");


const router = Router()



router.get('/', obtenerPartidos);

router.post('/', [
    // validarJWT,
    // validarCampos
], guardarPartido);


module.exports = router;