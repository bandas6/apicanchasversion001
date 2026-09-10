require('dotenv').config();
const mongoose = require('mongoose');
const FranjaHoraria = require('../models/franjas-horarias');

/**
 * Siembra el catalogo de franjas horarias (punto 3.2 del checklist
 * 2026-09-02) con las tres que hasta ahora estaban hardcodeadas en el cliente
 * (`grilla_tarifas_widget.dart`).
 *
 * Es idempotente: si la franja ya existe no la toca, asi que se puede correr
 * las veces que haga falta. Sin esto, al pasar la grilla de tarifas de
 * TextField libre a selector, un panel recien desplegado se quedaria sin
 * ninguna opcion que elegir.
 *
 * Uso: node scripts/seed-franjas-horarias.js
 */
const FRANJAS_BASE = [
    { nombre: 'Mañana', orden: 10, descripcion: 'Bloque de la mañana' },
    { nombre: 'Tarde', orden: 20, descripcion: 'Bloque de la tarde' },
    { nombre: 'Noche', orden: 30, descripcion: 'Bloque de la noche' },
];

const run = async () => {
    const uri = process.env.MONGO_DBCNN;
    if (!uri) {
        throw new Error('MONGO_DBCNN no esta configurado');
    }

    await mongoose.connect(uri);

    for (const base of FRANJAS_BASE) {
        const existente = await FranjaHoraria.findOne({
            nombre: new RegExp(`^${base.nombre}$`, 'i'),
        });

        if (existente) {
            console.log(`- "${base.nombre}" ya existe, se deja como esta.`);
            continue;
        }

        const franja = new FranjaHoraria({ ...base, activo: true });
        await franja.save();
        console.log(`+ "${franja.nombre}" creada (slug: ${franja.slug}).`);
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
