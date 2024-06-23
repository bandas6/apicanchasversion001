const express = require('express');
const cors = require('cors');
const { dbConnection } = require('../database/config');


class Server {

    constructor() {

        this.app = express();
        this.port = process.env.PORT;

        this.paths = {
            auth: '/api/auth',
            usuarios: '/api/usuarios',
            deportes: '/api/deportes',
            equipos: '/api/equipos',
            listasMaestras: '/api/listas-maestras',
            partidos: '/api/partidos',
            complejos: '/api/complejos',
            canchas: '/api/canchas',
            retos: '/api/retos',
        }
       
        
        // Connected DB
        this.conectarDB();

        // middlewares
        this.middlewares();

        // rutas de mi aplicacion
        this.routes();
    }

    async conectarDB(){
        await dbConnection();
    }

    middlewares(){

        // CORS 
        this.app.use(cors());

        // lectura y parceo de el body
        this.app.use(express.json());

         // Direcctorio publico
         this.app.use(express.static('public'));

    }

    routes() {
        this.app.use(this.paths.usuarios, require('../routes/usuarios'));
        this.app.use(this.paths.auth, require('../routes/auth'));
        this.app.use(this.paths.deportes, require('../routes/deportes'));
        this.app.use(this.paths.equipos, require('../routes/equipos'));
        this.app.use(this.paths.listasMaestras, require('../routes/listas-maestras'));
        this.app.use(this.paths.partidos, require('../routes/partidos'));
        this.app.use(this.paths.complejos, require('../routes/complejos'));
        this.app.use(this.paths.canchas, require('../routes/canchas'));
        this.app.use(this.paths.retos, require('../routes/retos'));
    }

    listen() {
        this.app.listen(this.port, () => {
            console.log(`Server is running on port ${this.port}`);
        });
    }


}

module.exports = Server;