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

module.exports = {
    retoYaExistente,
};