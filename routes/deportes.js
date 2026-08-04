const { Router } = require('express');
const { crearDeporte, actualizarDeporte, obtenerDeportes, eliminarDeporte } = require('../controllers/deportes.controller');
const { validarJWT } = require('../middlewares/validar-jwt');
const { esAdminGeneralRol } = require('../middlewares/validar-roles');

const router = Router();

router.get('/', obtenerDeportes);
router.post('/', [validarJWT, esAdminGeneralRol], crearDeporte);
router.put('/:id', [validarJWT, esAdminGeneralRol], actualizarDeporte);
router.delete('/:id', [validarJWT, esAdminGeneralRol], eliminarDeporte);

module.exports = router;
