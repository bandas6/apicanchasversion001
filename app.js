// Las sedes/canchas de esta app operan en Colombia. Fijar la zona horaria
// del proceso ANTES de cualquier otro require asegura que `new Date()` (y
// sus getters locales: getHours/getMinutes/getDate/getDay) reflejen siempre
// la hora real de Colombia sin importar en que zona horaria corra el host
// (Render u otro). Sin esto, "es de noche" en el reloj del servidor puede
// no coincidir con la hora real del usuario, y toda la logica de
// disponibilidad que compara contra "ahora" (buildAvailabilitySlots y sus
// llamadores) queda calculada con una hora equivocada.
process.env.TZ = 'America/Bogota';

require('dotenv').config();
const Server = require('./models/server');

const server = new Server();

server.listen().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
});
