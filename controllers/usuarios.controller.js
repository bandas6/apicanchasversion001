const { response } = require("express");
const Usuarios = require("../models/usuarios");
const RoleChangeAudit = require("../models/role-change-audits");
const { auditAdminGeneralAction } = require("../helpers/audit-admin-general");
const bcryptjs = require('bcryptjs');
const { uploadBufferToCloudinary } = require('../helpers/cloudinary');
const { recalculateUserReliability } = require('../helpers/reservation-reputation');
const {
    CATALOGOS_PERFIL,
    normalizeCatalogValue,
    normalizeScheduleValues,
    resolveAllowedPositions,
    resolveAllowedCourtTypes,
    uniqueStrings,
} = require('../helpers/profile-catalogs');

const getSelectedSports = (payload = {}) =>
    uniqueStrings([
        ...(Array.isArray(payload.deportesPrincipales) ? payload.deportesPrincipales : []),
        ...(Array.isArray(payload.deportesFavoritos) ? payload.deportesFavoritos : []),
    ]);

const validateProfileCatalogs = (payload = {}) => {
    const selectedSports = getSelectedSports(payload);
    const validaciones = [
        ['ciudad', CATALOGOS_PERFIL.ciudades, 'Debes seleccionar una ciudad valida'],
        ['zonaPreferida', CATALOGOS_PERFIL.zonas, 'Debes seleccionar una zona valida'],
        ['nivelJuego', CATALOGOS_PERFIL.niveles, 'Debes seleccionar un nivel valido'],
        ['pieDominante', CATALOGOS_PERFIL.pieDominante, 'Debes seleccionar tu perfil dominante'],
        ['estiloJuego', CATALOGOS_PERFIL.estiloJuego, 'Debes seleccionar un estilo de juego valido'],
        ['disponibilidadHabitual', CATALOGOS_PERFIL.disponibilidadHabitual, 'Debes seleccionar una disponibilidad valida'],
    ];

    for (const [key, allowedValues, message] of validaciones) {
        if (!payload[key]) {
            continue;
        }

        const normalized = normalizeCatalogValue(payload[key], allowedValues);
        if (!normalized) {
            throw new Error(message);
        }
        payload[key] = normalized;
    }

    if (payload.posicion) {
        const posicion = normalizeCatalogValue(payload.posicion, resolveAllowedPositions(selectedSports));
        if (!posicion) {
            throw new Error('La posicion preferida no coincide con los deportes seleccionados');
        }
        payload.posicion = posicion;
    }

    if (payload.tipoCanchaPreferida) {
        const tipoCancha = normalizeCatalogValue(
            payload.tipoCanchaPreferida,
            resolveAllowedCourtTypes(selectedSports),
        );
        if (!tipoCancha) {
            throw new Error('El tipo de cancha preferida no coincide con los deportes seleccionados');
        }
        payload.tipoCanchaPreferida = tipoCancha;
    }
};

const normalizarPayloadUsuario = (data = {}) => {
    const payload = { ...data };

    ['nombre', 'apellido', 'correo', 'posicion', 'bio', 'ciudad', 'nivelJuego', 'pieDominante', 'estiloJuego', 'disponibilidadHabitual', 'zonaPreferida', 'tipoCanchaPreferida', 'fotoUrl', 'nombre_archivo_imagen', 'identidadTipoDocumento', 'identidadNumeroDocumento', 'identidadNombreCompleto', 'identidadDocumentoFrontalUrl', 'identidadDocumentoPosteriorUrl', 'identidadSelfieUrl', 'identidadObservaciones']
        .forEach((key) => {
            if (typeof payload[key] === 'string') {
                payload[key] = payload[key].trim();
            }
        });

    ['deportesFavoritos', 'deportesPrincipales'].forEach((key) => {
        if (payload[key] === '' || payload[key] == null) {
            payload[key] = [];
        } else if (Array.isArray(payload[key])) {
            payload[key] = uniqueStrings(payload[key]);
        }
    });

    payload.horariosPreferidos = normalizeScheduleValues(payload.horariosPreferidos);

    if (payload.puntuacion !== undefined) {
        payload.puntuacion = Number(payload.puntuacion || 0);
    }

    if (payload.valoracion !== undefined) {
        payload.valoracion = Number(payload.valoracion || 0);
    }

    validateProfileCatalogs(payload);

    return payload;
};

const TIPOS_DOCUMENTO_VALIDOS = ['CC', 'CE', 'TI', 'PASAPORTE'];

const buildCloudinaryPublicId = (...parts) =>
    parts
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .join('-')
        .replace(/[^a-zA-Z0-9-_]/g, '_');

const uploadImageIfPresent = async ({ file, folder, publicId }) => {
    if (!file?.buffer) {
        return null;
    }

    const result = await uploadBufferToCloudinary({
        buffer: file.buffer,
        folder,
        publicId,
    });

    return result?.secure_url || '';
};

const esReferenciaArchivoValida = (value = '') => {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return false;
    }

    return normalized.startsWith('http://')
        || normalized.startsWith('https://')
        || normalized.startsWith('archivo_local:');
};

const isGeneralAdmin = (req = {}) => req.usuarioAuth?.rol === 'ADMIN_GENERAL_ROL';

const canReadFullUsuario = (req = {}, usuario = null) => {
    if (!usuario) {
        return false;
    }

    if (isGeneralAdmin(req)) {
        return true;
    }

    return String(req.usuarioAuth?._id || '') === String(usuario._id || '');
};

const toPublicUsuario = (usuario = null) => {
    if (!usuario) {
        return null;
    }

    const source = typeof usuario.toJSON === 'function'
        ? usuario.toJSON()
        : { ...usuario };

    return {
        uid: source.uid || source._id,
        nombre: source.nombre || '',
        apellido: source.apellido || '',
        imagenUrl: source.imagenUrl || source.fotoUrl || source.nombre_archivo_imagen || '',
        fotoUrl: source.fotoUrl || '',
        bio: source.bio || '',
        ciudad: source.ciudad || '',
        nivelJuego: source.nivelJuego || '',
        posicion: source.posicion || '',
        puntuacion: Number(source.puntuacion || 0),
        valoracion: Number(source.valoracion || 0),
        deportesFavoritos: Array.isArray(source.deportesFavoritos) ? source.deportesFavoritos : [],
        deportesPrincipales: Array.isArray(source.deportesPrincipales) ? source.deportesPrincipales : [],
        pieDominante: source.pieDominante || '',
        estiloJuego: source.estiloJuego || '',
        disponibilidadHabitual: source.disponibilidadHabitual || '',
        zonaPreferida: source.zonaPreferida || '',
        horariosPreferidos: Array.isArray(source.horariosPreferidos) ? source.horariosPreferidos : [],
        tipoCanchaPreferida: source.tipoCanchaPreferida || '',
        rol: source.rol || 'USER_ROL',
        equipo_id: source.equipo_id || null,
        estado: source.estado === true,
    };
};

const obtenerUsuarios = async (req = require, res = response) => {
    try {
        const { limit = 0, desde = 0, rol, identidadVerificada, identidadEstado, destacados } = req.query;
        const query = { estado: true };
        const fullAccess = isGeneralAdmin(req);

        if (rol && (fullAccess || rol === 'USER_ROL')) {
            query.rol = rol;
        } else if (!fullAccess) {
            query.rol = 'USER_ROL';
        }

        if (destacados === 'true') {
            query.rol = 'USER_ROL';
            query.identidadEstado = 'aprobada';
        }

        if (fullAccess && identidadVerificada !== undefined) {
            query.identidadVerificada = identidadVerificada === 'true';
        }

        if (fullAccess && identidadEstado) {
            query.identidadEstado = identidadEstado;
        }

        const [total, usuarios] = await Promise.all([
            Usuarios.countDocuments(query),
            Usuarios.find(query)
                .skip(Number(desde))
                .limit(Number(limit))
                .populate('equipo_id')
                .select('-password') // Excluir el campo password directamente en la consulta
                .select('__v') // Excluir el campo contrasenia directamente en la consulta
        ]);

        return res.status(200).json({
            ok: true,
            total,
            usuarios: fullAccess ? usuarios : usuarios.map(toPublicUsuario)
        });

    } catch (error) {
        return res.status(500).json({ // Usar 500 para errores del servidor
            ok: false,
            error: error.message // Mejor solo enviar el mensaje de error
        });
    }
};

const obtenerJugadoresPublicos = async (req = require, res = response) => {
    req.query = {
        ...req.query,
        rol: 'USER_ROL',
    };
    return obtenerUsuarios(req, res);
};

const obtenerMiUsuario = async (req = require, res = response) => {
    try {
        const usuarioId = req.usuarioAuth?._id;
        const usuario = await Usuarios.findById(usuarioId)
            .populate('equipo_id')
            .select('-password')
            .select('__v');

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado'
            });
        }

        return res.status(200).json({
            ok: true,
            usuario,
        });
    } catch (error) {
        console.error('[Usuarios] Error actualizando foto de perfil', {
            message: error.message,
            name: error.name,
            http_code: error.http_code,
        });
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

// Obtener usuario por id
const obtenerUsuario = async (req = require, res = response) => {

    try {

        const { id } = req.params;

        const usuario = await Usuarios.findById(id).populate('equipo_id')

        if (!usuario || !usuario.estado) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado'
            })
        }

        if (!canReadFullUsuario(req, usuario) && usuario.rol !== 'USER_ROL') {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado'
            })
        }

        return res.status(200).json({
            ok: true,
            usuario: canReadFullUsuario(req, usuario) ? usuario : toPublicUsuario(usuario)
        })

    } catch (error) {

        return res.status(500).json({
            ok: false,
            error: error.message
        })

    }

}

// Guardar usuarios en DB
const guardarUsuario = async (req = require, res = response) => {

    try {

        const data = normalizarPayloadUsuario(req.body);
        data.rol = 'USER_ROL';
        const usuario = new Usuarios(data);

        // Ecriptar contraseña
        const salt = await bcryptjs.genSaltSync();
        usuario.password = bcryptjs.hashSync(data.password, salt);

        //guardar en DB
        await usuario.save();
        res.status(201).json({
            ok: true,
            usuario
        })

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        })


    }

}

// Actualizar usuarios en DB
const actualizarUsuario = async (req = require, res = response) => {

    try {

        const { id } = req.params;
        const {
            _id,
            password,
            google,
            correo,
            rol,
            identidadVerificada,
            identidadEstado,
            identidadVerificadaPor,
            identidadVerificadaAt,
            identidadSolicitadaAt,
            ...restoRaw
        } = req.body;
        const resto = normalizarPayloadUsuario(restoRaw);

        if (req.usuarioAuth?.rol === 'ADMIN_GENERAL_ROL') {
            if (rol !== undefined) {
                resto.rol = rol;
            }
        } else {
            delete resto.estado;
            delete resto.complejo;
            delete resto.identidadObservaciones;
        }

        delete resto.identidadVerificada;
        delete resto.identidadEstado;
        delete resto.identidadVerificadaPor;
        delete resto.identidadVerificadaAt;
        delete resto.identidadSolicitadaAt;

        if (password) {
            const salt = await bcryptjs.genSaltSync();
            resto.password = bcryptjs.hashSync(password, salt);
        }

        const usuario = await Usuarios.findByIdAndUpdate(id, resto, { new: true });

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_USER',
            resourceType: 'usuario',
            resourceId: usuario?._id,
            targetUsuario: usuario?._id,
            targetCorreo: usuario?.correo || '',
            summary: 'Actualizacion global de usuario',
            metadata: {
                camposActualizados: Object.keys(resto),
            },
        });

        res.status(200).json({
            ok: true,
            usuario
        })


    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        })

    }

}

// Eliminar usuarios en DB
const eliminarUsuario = async (req = require, res = response) => {

    try {
        const { id } = req.params;

        const usuario = await Usuarios.findByIdAndUpdate(id, { estado: false });

        await auditAdminGeneralAction({
            req,
            action: 'DISABLE_USER',
            resourceType: 'usuario',
            resourceId: usuario?._id,
            targetUsuario: usuario?._id,
            targetCorreo: usuario?.correo || '',
            summary: 'Usuario desactivado por superadmin',
        });

        res.status(200).json({
            ok: true,
            usuario
        })

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        })

    }


}

const obtenerJugadorPublico = async (req = require, res = response) => {
    req.usuarioAuth = null;
    return obtenerUsuario(req, res);
}

const obtenerResumenReputacionUsuario = async (req = require, res = response) => {
    try {
        const { id } = req.params;
        const currentUserId = String(req.usuarioAuth?._id || '');
        const isGeneralAdmin = req.usuarioAuth?.rol === 'ADMIN_GENERAL_ROL';
        const isSameUser = currentUserId === String(id || '');

        if (!isGeneralAdmin && !isSameUser) {
            return res.status(403).json({
                ok: false,
                error: 'No puedes consultar el resumen de reputacion de otro usuario',
            });
        }

        const usuario = await Usuarios.findById(id);
        if (!usuario || !usuario.estado) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado',
            });
        }

        const summary = await recalculateUserReliability(usuario._id);

        return res.status(200).json({
            ok: true,
            summary: {
                userId: usuario._id,
                reliabilityScore: summary?.reliabilityScore ?? Number(usuario.reliabilityScore || 100),
                attendanceCount: summary?.attendanceCount ?? Number(usuario.attendanceCount || 0),
                lateCount: summary?.lateCount ?? Number(usuario.lateCount || 0),
                noShowCount: summary?.noShowCount ?? Number(usuario.noShowCount || 0),
                lateCancelCount: summary?.lateCancelCount ?? Number(usuario.lateCancelCount || 0),
                reliabilityBadge: summary?.reliabilityBadge || usuario.reliabilityBadge || 'confiable',
            },
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

const actualizarMiUsuario = async (req = require, res = response) => {
    try {
        req.params = {
            ...req.params,
            id: String(req.usuarioAuth?._id || ''),
        };
        return await actualizarUsuario(req, res);
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

const actualizarFotoPerfilUsuario = async (req = require, res = response) => {
    try {
        const userId = String(req.usuarioAuth?._id || '');
        const fotoFile = req.file;

        if (!userId) {
            return res.status(401).json({
                ok: false,
                error: 'Sesion no valida'
            });
        }

        if (!fotoFile?.buffer) {
            return res.status(400).json({
                ok: false,
                error: 'Debes adjuntar una foto de perfil'
            });
        }

        const usuario = await Usuarios.findById(userId);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado'
            });
        }

        const uploadedUrl = await uploadImageIfPresent({
            file: fotoFile,
            folder: 'canchas/usuarios/perfil',
            publicId: buildCloudinaryPublicId('perfil', userId, Date.now()),
        });

        usuario.fotoUrl = uploadedUrl;
        usuario.nombre_archivo_imagen = uploadedUrl;
        await usuario.save();

        return res.status(200).json({
            ok: true,
            usuario,
            fotoUrl: uploadedUrl,
            msg: 'Foto de perfil actualizada'
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

const actualizarRolUsuario = async (req = require, res = response) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;
        const actorId = String(req.usuarioAuth?._id || '');

        const usuarioObjetivo = await Usuarios.findById(id);

        if (!usuarioObjetivo) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado'
            });
        }

        if (!usuarioObjetivo.estado) {
            return res.status(400).json({
                ok: false,
                error: 'No se puede cambiar el rol de un usuario inactivo'
            });
        }

        if (String(usuarioObjetivo._id) === actorId && usuarioObjetivo.rol !== rol) {
            return res.status(400).json({
                ok: false,
                error: 'No puedes cambiar tu propio rol desde este endpoint'
            });
        }

        if (
            ['ADMIN_ROL', 'ADMIN_GENERAL_ROL'].includes(usuarioObjetivo.rol) &&
            usuarioObjetivo.rol !== rol
        ) {
            const totalAdminsActivos = await Usuarios.countDocuments({
                rol: usuarioObjetivo.rol,
                estado: true,
            });

            if (totalAdminsActivos <= 1) {
                return res.status(400).json({
                    ok: false,
                    error: `No puedes remover el ultimo ${usuarioObjetivo.rol} activo del sistema`
                });
            }
        }

        const rolAnterior = usuarioObjetivo.rol;

        usuarioObjetivo.rol = rol;
        usuarioObjetivo.refreshTokenHash = '';
        await usuarioObjetivo.save();

        await RoleChangeAudit.create({
            actorUsuario: req.usuarioAuth._id,
            actorCorreo: req.usuarioAuth?.correo || '',
            usuarioObjetivo: usuarioObjetivo._id,
            correoObjetivo: usuarioObjetivo.correo || '',
            rolAnterior,
            rolNuevo: rol,
        });

        await auditAdminGeneralAction({
            req,
            action: 'UPDATE_ROLE',
            resourceType: 'usuario',
            resourceId: usuarioObjetivo._id,
            targetUsuario: usuarioObjetivo._id,
            targetCorreo: usuarioObjetivo.correo || '',
            summary: `Cambio de rol a ${rol}`,
            metadata: {
                rolAnterior,
                rolNuevo: rol,
            },
        });

        return res.status(200).json({
            ok: true,
            usuario: usuarioObjetivo,
            msg: `Rol actualizado a ${rol}`
        });
    } catch (error) {
        console.error('[Usuarios] Error enviando identidad', {
            message: error.message,
            name: error.name,
            http_code: error.http_code,
            response: error.response,
        });
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const actualizarRolGeneralUsuario = async (req = require, res = response) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;
        const actorId = String(req.usuarioAuth?._id || '');

        const usuarioObjetivo = await Usuarios.findById(id);

        if (!usuarioObjetivo) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado'
            });
        }

        if (!usuarioObjetivo.estado) {
            return res.status(400).json({
                ok: false,
                error: 'No se puede cambiar el rol de un usuario inactivo'
            });
        }

        if (String(usuarioObjetivo._id) === actorId && usuarioObjetivo.rol !== rol) {
            return res.status(400).json({
                ok: false,
                error: 'No puedes cambiar tu propio rol general desde este endpoint'
            });
        }

        const rolAnterior = usuarioObjetivo.rol;
        const promotingToGeneralAdmin = rol === 'ADMIN_GENERAL_ROL';
        const removingGeneralAdmin = rolAnterior === 'ADMIN_GENERAL_ROL' && rol !== 'ADMIN_GENERAL_ROL';

        if (!promotingToGeneralAdmin && !removingGeneralAdmin) {
            return res.status(400).json({
                ok: false,
                error: 'Este endpoint solo gestiona asignacion o revocacion de ADMIN_GENERAL_ROL'
            });
        }

        if (promotingToGeneralAdmin) {
            if (rolAnterior !== 'ADMIN_ROL') {
                return res.status(400).json({
                    ok: false,
                    error: 'Solo un ADMIN_ROL puede promocionarse a ADMIN_GENERAL_ROL'
                });
            }
        }

        if (removingGeneralAdmin) {
            const totalGeneralAdminsActivos = await Usuarios.countDocuments({
                rol: 'ADMIN_GENERAL_ROL',
                estado: true,
            });

            if (totalGeneralAdminsActivos <= 1) {
                return res.status(400).json({
                    ok: false,
                    error: 'No puedes remover el ultimo ADMIN_GENERAL_ROL activo del sistema'
                });
            }
        }

        usuarioObjetivo.rol = rol;
        usuarioObjetivo.refreshTokenHash = '';
        await usuarioObjetivo.save();

        await RoleChangeAudit.create({
            actorUsuario: req.usuarioAuth._id,
            actorCorreo: req.usuarioAuth?.correo || '',
            usuarioObjetivo: usuarioObjetivo._id,
            correoObjetivo: usuarioObjetivo.correo || '',
            rolAnterior,
            rolNuevo: rol,
        });

        await auditAdminGeneralAction({
            req,
            action: promotingToGeneralAdmin ? 'GRANT_GENERAL_ADMIN' : 'REVOKE_GENERAL_ADMIN',
            resourceType: 'usuario',
            resourceId: usuarioObjetivo._id,
            targetUsuario: usuarioObjetivo._id,
            targetCorreo: usuarioObjetivo.correo || '',
            summary: promotingToGeneralAdmin
                ? 'Asignacion de ADMIN_GENERAL_ROL'
                : 'Revocacion de ADMIN_GENERAL_ROL',
            metadata: {
                rolAnterior,
                rolNuevo: rol,
            },
        });

        return res.status(200).json({
            ok: true,
            usuario: usuarioObjetivo,
            msg: `Rol general actualizado a ${rol}`
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const actualizarDocumentosIdentidadUsuario = async (req = require, res = response) => {
    try {
        const { id } = req.params;
        const actorId = String(req.usuarioAuth?._id || '');
        const isGeneralAdmin = req.usuarioAuth?.rol === 'ADMIN_GENERAL_ROL';
        const isSelf = actorId === String(id);

        if (!isGeneralAdmin && !isSelf) {
            return res.status(403).json({
                ok: false,
                error: 'Solo puedes enviar documentos para tu propia cuenta'
            });
        }

        const usuario = await Usuarios.findById(id);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado'
            });
        }

        const payload = normalizarPayloadUsuario(req.body);
        const files = req.files || {};
        const frontalFile = Array.isArray(files.documentoFrontal) ? files.documentoFrontal[0] : null;
        const posteriorFile = Array.isArray(files.documentoPosterior) ? files.documentoPosterior[0] : null;
        const selfieFile = Array.isArray(files.selfie) ? files.selfie[0] : null;
        const tipoDocumento = String(payload.identidadTipoDocumento || '').toUpperCase();
        const numeroDocumento = String(payload.identidadNumeroDocumento || '').trim();
        const nombreCompleto = String(payload.identidadNombreCompleto || '').trim();
        const frontalSubido = await uploadImageIfPresent({
            file: frontalFile,
            folder: 'canchas/usuarios/identidad',
            publicId: buildCloudinaryPublicId('identidad-frontal', usuario._id, Date.now()),
        });
        const posteriorSubido = await uploadImageIfPresent({
            file: posteriorFile,
            folder: 'canchas/usuarios/identidad',
            publicId: buildCloudinaryPublicId('identidad-posterior', usuario._id, Date.now()),
        });
        const selfieSubida = await uploadImageIfPresent({
            file: selfieFile,
            folder: 'canchas/usuarios/identidad',
            publicId: buildCloudinaryPublicId('identidad-selfie', usuario._id, Date.now()),
        });
        const frontal = frontalSubido || payload.identidadDocumentoFrontalUrl || usuario.identidadDocumentoFrontalUrl;
        const posterior = posteriorSubido || payload.identidadDocumentoPosteriorUrl || usuario.identidadDocumentoPosteriorUrl;
        const selfie = selfieSubida || payload.identidadSelfieUrl || usuario.identidadSelfieUrl;

        if (!TIPOS_DOCUMENTO_VALIDOS.includes(tipoDocumento)) {
            return res.status(400).json({
                ok: false,
                error: 'Debes seleccionar un tipo de documento valido'
            });
        }

        if (!numeroDocumento || numeroDocumento.length < 5) {
            return res.status(400).json({
                ok: false,
                error: 'Debes ingresar un numero de documento valido'
            });
        }

        if (!nombreCompleto || nombreCompleto.length < 6) {
            return res.status(400).json({
                ok: false,
                error: 'Debes ingresar el nombre completo del documento'
            });
        }

        if (!frontal) {
            return res.status(400).json({
                ok: false,
                error: 'Debes adjuntar al menos la foto frontal del documento'
            });
        }

        if (!selfie) {
            return res.status(400).json({
                ok: false,
                error: 'Debes adjuntar una selfie de verificacion'
            });
        }

        if (!esReferenciaArchivoValida(frontal)) {
            return res.status(400).json({
                ok: false,
                error: 'La referencia del documento frontal no es valida'
            });
        }

        if (posterior && !esReferenciaArchivoValida(posterior)) {
            return res.status(400).json({
                ok: false,
                error: 'La referencia del documento posterior no es valida'
            });
        }

        if (!esReferenciaArchivoValida(selfie)) {
            return res.status(400).json({
                ok: false,
                error: 'La referencia de la selfie no es valida'
            });
        }

        usuario.identidadTipoDocumento = tipoDocumento;
        usuario.identidadNumeroDocumento = numeroDocumento;
        usuario.identidadNombreCompleto = nombreCompleto;
        usuario.identidadDocumentoFrontalUrl = frontal;
        usuario.identidadDocumentoPosteriorUrl = posterior;
        usuario.identidadSelfieUrl = selfie;
        usuario.identidadEstado = 'pendiente';
        usuario.identidadVerificada = false;
        usuario.identidadObservaciones = '';
        usuario.identidadSolicitadaAt = new Date();
        usuario.identidadIntentos = Number(usuario.identidadIntentos || 0) + 1;
        usuario.identidadVerificadaAt = null;
        usuario.identidadVerificadaPor = null;

        await usuario.save();

        await auditAdminGeneralAction({
            req,
            action: 'SUBMIT_IDENTITY_DOCUMENTS',
            resourceType: 'usuario',
            resourceId: usuario._id,
            targetUsuario: usuario._id,
            targetCorreo: usuario.correo || '',
            summary: selfie
                ? 'Documentos de identidad y selfie cargados'
                : 'Documento de identidad cargado para revision',
        });

        return res.status(200).json({
            ok: true,
            usuario,
            msg: 'Documentos enviados para validacion'
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const actualizarVerificacionIdentidadUsuario = async (req = require, res = response) => {
    try {
        const { id } = req.params;
        const { estado, observaciones = '' } = normalizarPayloadUsuario(req.body);
        const reviewNotes = String(observaciones || '').trim();
        const usuario = await Usuarios.findById(id);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                error: 'Usuario no encontrado'
            });
        }

        if (usuario.rol !== 'USER_ROL') {
            return res.status(400).json({
                ok: false,
                error: 'Solo los usuarios con USER_ROL pueden pasar por este flujo'
            });
        }

        if (!usuario.identidadDocumentoFrontalUrl) {
            return res.status(400).json({
                ok: false,
                error: 'El usuario no tiene documento frontal cargado'
            });
        }

        if (!usuario.identidadSelfieUrl) {
            return res.status(400).json({
                ok: false,
                error: 'El usuario no tiene selfie de verificacion cargada'
            });
        }

        if (estado === 'rechazada' && !reviewNotes) {
            return res.status(400).json({
                ok: false,
                error: 'Debes enviar observaciones al rechazar la identidad'
            });
        }

        usuario.identidadEstado = estado;
        usuario.identidadVerificada = estado === 'aprobada';
        usuario.identidadObservaciones = reviewNotes;
        usuario.identidadVerificadaAt = new Date();
        usuario.identidadVerificadaPor = req.usuarioAuth._id;

        await usuario.save();

        await auditAdminGeneralAction({
            req,
            action: estado === 'aprobada'
                ? 'APPROVE_IDENTITY'
                : 'REJECT_IDENTITY',
            resourceType: 'usuario',
            resourceId: usuario._id,
            targetUsuario: usuario._id,
            targetCorreo: usuario.correo || '',
            summary: estado === 'aprobada'
                ? 'Identidad validada por ADMIN_GENERAL_ROL'
                : 'Identidad rechazada por ADMIN_GENERAL_ROL',
            metadata: {
                observaciones: reviewNotes,
            },
        });

        return res.status(200).json({
            ok: true,
            usuario,
            msg: estado === 'aprobada'
                ? 'Identidad validada correctamente'
                : 'Identidad rechazada correctamente'
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}

const obtenerAuditoriaRoles = async (req = require, res = response) => {
    try {
        const { limit = 20, desde = 0, actor, objetivo } = req.query;
        const query = {};

        if (actor) {
            query.actorUsuario = actor;
        }

        if (objetivo) {
            query.usuarioObjetivo = objetivo;
        }

        const [total, auditorias] = await Promise.all([
            RoleChangeAudit.countDocuments(query),
            RoleChangeAudit.find(query)
                .populate('actorUsuario', 'nombre apellido correo rol')
                .populate('usuarioObjetivo', 'nombre apellido correo rol estado')
                .sort({ fechaCambio: -1 })
                .skip(Number(desde))
                .limit(Number(limit)),
        ]);

        return res.status(200).json({
            ok: true,
            total,
            auditorias,
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

module.exports = {
    guardarUsuario,
    obtenerUsuarios,
    obtenerJugadoresPublicos,
    obtenerMiUsuario,
    obtenerUsuario,
    obtenerJugadorPublico,
    actualizarUsuario,
    actualizarMiUsuario,
    actualizarFotoPerfilUsuario,
    eliminarUsuario,
    actualizarRolUsuario,
    actualizarRolGeneralUsuario,
    actualizarDocumentosIdentidadUsuario,
    actualizarVerificacionIdentidadUsuario,
    obtenerAuditoriaRoles,
    obtenerResumenReputacionUsuario,
}
