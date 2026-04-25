const express = require('express');
const cors = require('cors');
const { dbConnection } = require('../database/config');
const { ensureSystemRoles } = require('../helpers/ensure-system-roles');
const { runReservationLifecycleSweep } = require('../helpers/reservation-reputation');


class Server {

    constructor() {

        this.app = express();
        this.port = process.env.PORT;

        this.paths = {
            auth: '/api/auth',
            adminGeneral: '/api/admin-general',
            usuarios: '/api/usuarios',
            jugadores: '/api/jugadores',
            deportes: '/api/deportes',
            equipos: '/api/equipos',
            listasMaestras: '/api/listas-maestras',
            partidos: '/api/partidos',
            complejos: '/api/complejos',
            canchas: '/api/canchas',
            retos: '/api/retos',
            solicitudes: '/api/solicitudes',
            pistasHome: '/api/pistas-home',
            centroMensajes: '/api/centro-mensajes',
            complexClaims: '/api/complex-claims',
            reservas: '/api/reservas',
            historialReservas: '/api/historial-reservas',
            mensajes: '/api/mensajes',
            coberturasGeograficas: '/api/coberturas-geograficas',
        }
       
        
        // middlewares
        this.middlewares();

        // rutas de mi aplicacion
        this.routes();
    }

    async conectarDB(){
        await dbConnection();
        await ensureSystemRoles();
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
        this.app.use(this.paths.adminGeneral, require('../routes/admin-general'));
        this.app.use(this.paths.usuarios, require('../routes/usuarios'));
        this.app.use(this.paths.jugadores, require('../routes/jugadores'));
        this.app.use(this.paths.auth, require('../routes/auth'));
        this.app.use(this.paths.deportes, require('../routes/deportes'));
        this.app.use(this.paths.equipos, require('../routes/equipos'));
        this.app.use(this.paths.listasMaestras, require('../routes/listas-maestras'));
        this.app.use(this.paths.partidos, require('../routes/partidos'));
        this.app.use(this.paths.complejos, require('../routes/complejos'));
        this.app.use(this.paths.canchas, require('../routes/canchas'));
        this.app.use(this.paths.retos, require('../routes/retos'));
        this.app.use(this.paths.solicitudes, require('../routes/solicitudes'));
        this.app.use(this.paths.pistasHome, require('../routes/pistas-home'));
        this.app.use(this.paths.centroMensajes, require('../routes/centro-mensajes'));
        this.app.use(this.paths.complexClaims, require('../routes/complex-claims'));
        this.app.use(this.paths.reservas, require('../routes/reservas'));
        this.app.use(this.paths.historialReservas, require('../routes/historial-reserva'));
        this.app.use(this.paths.mensajes, require('../routes/mensajes'));
        this.app.use(this.paths.coberturasGeograficas, require('../routes/coberturas-geograficas'));
    }

    async listen() {
        await this.conectarDB();
        setInterval(() => {
            runReservationLifecycleSweep().catch((error) => {
                console.error('[Reservas] Error en cierre automatico', error.message);
            });
        }, 10 * 60 * 1000);
        this.app.listen(this.port, () => {
            console.log(`Server is running on port ${this.port}`);
        });
    }


}

module.exports = Server;
