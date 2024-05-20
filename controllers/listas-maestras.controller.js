const { request, response } = require("express");
const Roles = require("../models/roles");


const obtenerRoles = async (req = request, res = response) => {

    try {

        const roles = await Roles.find();

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