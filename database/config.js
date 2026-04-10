const mongoose = require('mongoose');
const dns = require('dns');

const configureDnsServers = () => {
    const rawServers = String(process.env.MONGO_DNS_SERVERS || '').trim();

    if (!rawServers) {
        return;
    }

    const servers = rawServers
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean);

    if (!servers.length) {
        return;
    }

    dns.setServers(servers);
    console.log(`Mongo DNS servers: ${servers.join(', ')}`);
};

const dbConnection = async () => {

    try {
        configureDnsServers();
        
        await mongoose.connect(process.env.MONGO_DBCNN);
        console.log('DB online');

    } catch (error) {

        console.log(error);
        if (
            error?.code === 'ECONNREFUSED' &&
            typeof error?.syscall === 'string' &&
            error.syscall.startsWith('query')
        ) {
            console.error(
                'MongoDB Atlas no pudo resolverse por DNS. Revisa tu red o define MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1 en .env.'
            );
        }
        throw new Error('Error a la hora de iniciar la base de datos');

    }

}


module.exports = {
    dbConnection
}
