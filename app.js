require('dotenv').config();
const Server = require('./models/server');

const server = new Server();

server.listen().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
});
