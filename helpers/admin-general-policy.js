const parseAllowedAdminGeneralEmails = () => {
    const raw = process.env.ADMIN_GENERAL_ALLOWED_EMAILS || process.env.ADMIN_GENERAL_EMAILS || '';

    return raw
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
};

const getAllowedAdminGeneralEmails = () => parseAllowedAdminGeneralEmails();

const isCorreoPermitidoParaAdminGeneral = (correo = '') => {
    const allowedEmails = parseAllowedAdminGeneralEmails();

    if (allowedEmails.length === 0) {
        return false;
    }

    return allowedEmails.includes(String(correo).trim().toLowerCase());
};

module.exports = {
    getAllowedAdminGeneralEmails,
    isCorreoPermitidoParaAdminGeneral,
};
