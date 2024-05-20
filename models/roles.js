const { Schema, model } = require('mongoose');

const RolesSchema = new Schema({
    roles: {
        type: String,
        // default: 'USER_ROL'
    }
});

module.exports = model('role', RolesSchema)