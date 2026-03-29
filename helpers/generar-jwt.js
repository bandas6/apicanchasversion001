const crypto = require('crypto');
const jwt = require('jsonwebtoken')

const generarJWT = ( uid = '', options = {} ) => {


    return new Promise( (resolve, reject) => {
        if (!process.env.SECRETORPRIVATEKEY) {
            reject('SECRETORPRIVATEKEY no esta configurada');
            return;
        }

        const payload = {
            uid,
            tokenId: options.tokenId || crypto.randomUUID(),
        };
        const expiresIn = options.expiresIn || '15m';
        jwt.sign( payload, process.env.SECRETORPRIVATEKEY, 
            { expiresIn }, (err, token) => {
                if (err) {
                    console.log(err)
                    reject('Error no se pudo generar el jwt');
                } else {
                    resolve(token);
                }
            } )

    } )

}

const generarRefreshToken = (uid = '') => {
    return generarJWT(uid, { expiresIn: '30d' });
}

module.exports = {
    generarJWT,
    generarRefreshToken
}
