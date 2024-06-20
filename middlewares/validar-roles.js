
const esAdminRol = (req, res = response, next) => {

    if (!req.usuarioAuth) {
        return res.status(500).json({
            msg: 'Hable con el administrador'
        })
    }

    const { rol, nombre } = req.usuarioAuth;

    if (rol !== 'ADMIN_ROL') {
        return res.status(403).json({
            msg: 'No tienes permisos para acceder a esta ruta - no es admin',
            ok: false
        })
    }

    next();

}

const usuarioEsJugador = (req, res = response, next) => {

    console.log(req.body)

    // if(valoracion > 0){
    //     if (rol !== 'GAMER_ROL') {
    //         throw new Error('El usuario no tiene el rol de jugador');
    //     }
    // }

    next()

}

module.exports = {
    esAdminRol,
    usuarioEsJugador
}