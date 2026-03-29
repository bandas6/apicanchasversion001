require('dotenv').config();
const mongoose = require('mongoose');
const { ensureSystemRoles } = require('../helpers/ensure-system-roles');

const run = async () => {
    const uri = process.env.MONGO_DBCNN;

    if (!uri) {
        throw new Error('MONGO_DBCNN no esta configurado');
    }

    await mongoose.connect(uri);
    await ensureSystemRoles();
    console.log('Roles y usuarios normalizados correctamente.');
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
