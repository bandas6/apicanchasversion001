const { request, response } = require("express");


const enviarMensaje = async (req = request, res = response) => {

    const { remitente, destinatario, contenido } = req.body;

    try {
        const nuevoMensaje = new Mensaje({ remitente, destinatario, contenido });
        await nuevoMensaje.save();

        res.status(201).json({
            ok: true,
            mensaje: nuevoMensaje
        });
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
}

const recibirMensaje = async (req = request, res = response) => {
    const { usuarioId } = req.params;

    try {
        const mensajes = await Mensaje.find({ destinatario: usuarioId })
            .populate('remitente', 'nombre')
            .sort({ fechaEnvio: -1 });

        res.status(200).json({
            ok: true,
            mensajes
        });
    } catch (error) {
        console.error('Error al recibir los mensajes:', error);
        res.status(500).json({
            ok: false,
            error: 'Error interno del servidor'
        });
    }
}


module.exports = {
    enviarMensaje,
    recibirMensaje
}