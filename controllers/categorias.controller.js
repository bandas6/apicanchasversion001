const { response, request } = require("express");
const Categoria = require("../models/categorias.modelo");

const guardarCategoria = async (res = response, req = request) => {

    try {

        const { ...res } = req.body;
        const categoria = new Categoria(res);

        await categoria.save();

        res.status(200).json({
            ok: true,
            categoria
        });

    } catch (error) {
        res.status(400).json({
            msg: 'Hubo un error al crear la categoría',
            error
        })
    }

}

const obtenerCategorias = async (res = response, req = request) => {

    try {

        const categorias = await Categoria.find({ estado: true }).sort('descripcion')

        res.status(200).json({
            ok: true,
            categorias
        });

    } catch (error) {
        res.status(500).json({
            msg: 'Hubo un error al obtener las categorías',
            error
        })
    }

}

const obtenerCategoria = async (res = response, req = request) => {

    try {

        const { id } = req.params;
        const categoria = await Categoria.findById(id);

        if (!categoria) {
            return res.status(404).json({
                msg: 'Categoría no encontrada'
            });
        }

        res.status(200).json({
            ok: true,
            categoria
        });

    } catch (error) {
        res.status(500).json({
            msg: 'Hubo un error al obtener la categoría',
            error
        })
    }

}

const actualizarCategoria = async (res = response, req = request) => {

    try {
        const { id } = req.params;
        const { ...rest } = req.body;

        const categoria = await Categoria.findByIdAndUpdate(id, rest, { new: true });

        res.status(200).json({
            ok: true,
            categoria
        })

    } catch (error) {

        res.status(400).json({
            msg: 'Hubo un error al actualizar la categoría',
            error
        })

    }

}

const eliminarCategoria = async (resp = response, req = request) => {

    try {

        const { id } = req.params;

        const categoria = await Categoria.findByIdAndUpdate(id, { estado: false });

        if (!categoria) {
            return res.status(404).json({
                msg: 'Categoría no encontrada'
            });
        }

        resp.status(200).json({
            ok: true,
            msg: 'Categoría eliminada correctamente'
        })

    } catch (error) {

        res.status(500).json({
            msg: 'Hubo un error al eliminar la categoría',
            error
        })


    }
}

module.exports = {
    guardarCategoria,
    obtenerCategorias,
    obtenerCategoria,
    actualizarCategoria,
    eliminarCategoria
}