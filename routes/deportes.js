const { Router } = require('express');
const { crearDeporte, actualizarDeporte, obtenerDeportes } = require('../controllers/deportes.controller');
const { validarJWT } = require('../middlewares/validar-jwt');
const { esAdminRol } = require('../middlewares/validar-roles');

const router = Router();

router.get('/', obtenerDeportes);
router.post('/', [validarJWT, esAdminRol], crearDeporte);
router.put('/:id', [validarJWT, esAdminRol], actualizarDeporte);

module.exports = router;
