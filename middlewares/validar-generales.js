const Solicitudes = require("../models/solicitudes");

const retoYaExistente = async (usuarioRetado, { req }) => {
    const { id } = req.params; // ID del equipo
    const equipo = await Equipos.findById(id);

    if (!equipo) {
        throw new Error('Equipo no encontrado');
    }

    const retoExistente = equipo.retos.find(reto => reto.usuarioRetado.toString() === usuarioRetado.toString());
    if (retoExistente) {
        throw new Error(`El reto ya existe en el equipo`);
    }
};

const solicitudYaExiste = async (usuario, { req }) => {
    const { complejo } = req.body; // Cambiado a usuarioDos para evitar conflicto de nombres

    console.log(req.body)
    // Busca una solicitud donde ambos usuarios estén presentes
    const solicitud = await Solicitudes.findOne({
        $or: [
            { usuario, complejo }, // Ajuste aquí para definir el campo 'solicitud'
        ]
    });

    console.log(solicitud); // Cambiado 'partido' a 'solicitud'

    if (solicitud) {
        throw new Error(`Ya has enviado una solicitud a este complejo`);
    }
};


module.exports = {
    retoYaExistente,
    solicitudYaExiste
};