const { response, request } = require("express");


const obtenerDatosDeportivos = async ( req = request, res = response ) => {
    try {
        const response = await axios.get('https://v3.football.api-sports.io/', {
          headers: {
            'x-rapidapi-key': process.env.APIKEY,
            'x-rapidapi-host': process.env.APIKEYHOSTING
          }
        });
        res.status(response.status).json(response.data);
      } catch (error) {
        res.status(500).json({ error: 'Error de servidor' });
      }
}


module.exports = {
    obtenerDatosDeportivos
}