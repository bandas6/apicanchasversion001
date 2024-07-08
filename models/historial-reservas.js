const { Schema, model } = require('mongoose');


const HistorialReservasSchema = new Schema({

    reservas: [{
        type: Schema.Types.ObjectId,
        ref: 'Reserva',
        required: true
    }],
    usuario_id: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    }
});

// Exportar el modelo
module.exports = model('HistorialReserva', HistorialReservasSchema);
