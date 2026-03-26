const jwt = require('jsonwebtoken')

const generarJWT = ( uid = '' ) => {


    return new Promise( (resolve, reject) => {
        if (!process.env.SECRETORPRIVATEKEY) {
            reject('SECRETORPRIVATEKEY no esta configurada');
            return;
        }

        const payload = { uid };
        jwt.sign( payload, process.env.SECRETORPRIVATEKEY, 
            { expiresIn: '1d' }, (err, token) => {
                if (err) {
                    console.log(err)
                    reject('Error no se pudo generar el jwt');
                } else {
                    resolve(token);
                }
            } )

    } )

}

module.exports = {
    generarJWT
}
