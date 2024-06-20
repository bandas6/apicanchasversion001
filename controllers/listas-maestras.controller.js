const { request, response } = require("express");
const Roles = require("../models/roles");


const obtenerRoles = async (req = request, res = response) => {

    try {

        const roles = await Roles.find();

        const rolToRemove = 'ADMIN_CANCHAS_ROL';
        const updatedRoles = roles.filter(role => role.rol !== rolToRemove);

        console.log(updatedRoles);

        res.status(200).json({
            ok: true,
            roles
        })

    } catch (error) {

        res.status(400).json({
            ok: false,
            error
        })

    }

}


module.exports = {
    obtenerRoles
}