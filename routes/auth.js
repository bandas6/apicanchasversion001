const { Router } = require('express');
const { check } = require('express-validator');

const { login, renovarToken, logout } = require('../controllers/auth.controller');
const { validarCampos } = require('../middlewares/validar-campos');
const { usuarioConCorreoNoExiste } = require('../helpers/db-validators');

const router = Router();

router.post('/', [
    check('correo', 'el correo no es valido').isEmail(),
    check('password', 'la contrasena es obligatoria').not().isEmpty(),
    check('correo').custom(usuarioConCorreoNoExiste),
    validarCampos
], login);

router.post('/renew', renovarToken);
router.post('/logout', logout);

module.exports = router;
