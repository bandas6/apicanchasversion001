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

HistorialReservasSchema.methods.toJSON = function () {
    const { __v, _id, ...historial } = this.toObject();
    historial.uid = _id;
    return historial;
}

// Exportar el modelo
module.exports = model('HistorialReserva', HistorialReservasSchema);
