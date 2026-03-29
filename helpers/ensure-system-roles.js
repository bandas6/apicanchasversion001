const Roles = require('../models/roles');
const Usuarios = require('../models/usuarios');

const SYSTEM_ROLES = [
    {
        rol: 'USER_ROL',
        etiqueta: 'USUARIO',
        descripcion: 'Usuario final de la plataforma',
    },
    {
        rol: 'ADMIN_ROL',
        etiqueta: 'USUARIO ADMINISTRADOR',
        descripcion: 'Administrador operativo de complejos asignados',
    },
    {
        rol: 'ADMIN_GENERAL_ROL',
        etiqueta: 'SUPERADMIN',
        descripcion: 'Superadministrador interno de la plataforma',
    },
];

const ROLE_ALIASES = {
    USER_ROL: 'USER_ROL',
    user_rol: 'USER_ROL',
    ADMIN_ROL: 'ADMIN_ROL',
    admin_rol: 'ADMIN_ROL',
    ADMIN_USER_ROL: 'ADMIN_ROL',
    admin_user_rol: 'ADMIN_ROL',
    ADMIN_GENERAL_ROL: 'ADMIN_GENERAL_ROL',
    admin_general_rol: 'ADMIN_GENERAL_ROL',
};

const normalizeRoleCode = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    return ROLE_ALIASES[raw] || raw.toUpperCase();
};

const ensureSystemRoles = async () => {
    const legacyRoles = await Roles.collection.find({
        rol: { $exists: false },
        roles: { $exists: true },
    }).toArray();

    for (const legacyRole of legacyRoles) {
        const normalizedRole = normalizeRoleCode(legacyRole.roles);

        if (!normalizedRole) {
            continue;
        }

        await Roles.collection.updateOne(
            { _id: legacyRole._id },
            {
                $set: {
                    rol: normalizedRole,
                },
                $unset: {
                    roles: '',
                },
            }
        );
    }

    for (const role of SYSTEM_ROLES) {
        await Roles.updateOne(
            { rol: role.rol },
            { $set: role },
            { upsert: true }
        );
    }

    const canonicalRoles = await Roles.find({
        rol: { $in: SYSTEM_ROLES.map((item) => item.rol) },
    }).lean();

    const rolesToNormalize = await Roles.find({}).lean();
    for (const role of rolesToNormalize) {
        const normalizedRole = normalizeRoleCode(role.rol);
        const systemRole = SYSTEM_ROLES.find((item) => item.rol === normalizedRole);

        if (!systemRole) {
            continue;
        }

        const canonical = canonicalRoles.find((item) => item.rol === normalizedRole);
        const isCanonicalDoc = canonical && String(canonical._id) === String(role._id);

        if (isCanonicalDoc) {
            await Roles.updateOne(
                { _id: role._id },
                {
                    $set: {
                        rol: normalizedRole,
                        etiqueta: systemRole.etiqueta,
                        descripcion: systemRole.descripcion,
                    },
                }
            );
            continue;
        }

        if (canonical) {
            await Roles.updateOne(
                { _id: canonical._id },
                {
                    $set: {
                        rol: normalizedRole,
                        etiqueta: systemRole.etiqueta,
                        descripcion: systemRole.descripcion,
                    },
                }
            );
            await Roles.deleteOne({ _id: role._id });
            continue;
        }

        await Roles.updateOne(
            { _id: role._id },
            {
                $set: {
                    rol: normalizedRole,
                    etiqueta: systemRole.etiqueta,
                    descripcion: systemRole.descripcion,
                },
            }
        );
    }

    await Roles.deleteMany({
        rol: {
            $nin: SYSTEM_ROLES.map((item) => item.rol),
        },
    });

    const usuarios = await Usuarios.find({
        rol: {
            $in: Object.keys(ROLE_ALIASES),
        },
    }).select('_id rol');

    for (const usuario of usuarios) {
        const normalizedRole = normalizeRoleCode(usuario.rol);
        if (normalizedRole && normalizedRole !== usuario.rol) {
            await Usuarios.updateOne(
                { _id: usuario._id },
                { $set: { rol: normalizedRole } }
            );
        }
    }
};

module.exports = {
    SYSTEM_ROLES,
    normalizeRoleCode,
    ensureSystemRoles,
};
