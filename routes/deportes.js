const { Router } = require('express');
const { check } = require('express-validator');
const { obtenerDatosDeportivos } = require('../controllers/deportes.controller');

const router = Router();

router.get('/', obtenerDatosDeportivos )



module.exports = router;
