const { Router } = require('express');
const {
    obtenerFranjasHorarias,
    crearFranjaHoraria,
    actualizarFranjaHoraria,
} = require('../controllers/franjas-horarias.controller');
const { validarJWT } = require('../middlewares/validar-jwt');
const { esAdminGeneralRol } = require('../middlewares/validar-roles');

const router = Router();

// Punto 3.2: solo DEV administra el catalogo. La lectura queda abierta porque
// el panel de cualquier admin de complejo necesita el catalogo para ofrecer el
// selector de franjas de la grilla de tarifas.
router.get('/', obtenerFranjasHorarias);
router.post('/', [validarJWT, esAdminGeneralRol], crearFranjaHoraria);
router.put('/:id', [validarJWT, esAdminGeneralRol], actualizarFranjaHoraria);

module.exports = router;
