const { v2: cloudinary } = require('cloudinary');

let configured = false;

const parseCloudinaryUrl = (rawValue = '') => {
    const value = String(rawValue || '').trim();

    if (!value) {
        return null;
    }

    const parsed = new URL(value);
    if (parsed.protocol !== 'cloudinary:') {
        throw new Error('CLOUDINARY_URL invalida. Debe iniciar con cloudinary://');
    }

    const apiKey = decodeURIComponent(parsed.username || '').trim();
    const apiSecret = decodeURIComponent(parsed.password || '').trim();
    const cloudName = String(parsed.hostname || '').trim();

    if (!apiKey || !apiSecret || !cloudName) {
        throw new Error('CLOUDINARY_URL invalida. Faltan api_key, api_secret o cloud_name');
    }

    return {
        cloudName,
        apiKey,
        apiSecret,
    };
};

const ensureCloudinaryConfigured = () => {
    if (configured) {
        return;
    }

    const cloudinaryUrl = String(process.env.CLOUDINARY_URL || '').trim();
    const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

    if (cloudinaryUrl) {
        const parsedConfig = parseCloudinaryUrl(cloudinaryUrl);
        cloudinary.config({
            cloud_name: parsedConfig.cloudName,
            api_key: parsedConfig.apiKey,
            api_secret: parsedConfig.apiSecret,
            secure: true,
        });
        configured = true;
        return;
    }

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary no esta configurado. Define CLOUDINARY_URL o CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET');
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    configured = true;
};

const uploadBufferToCloudinary = ({ buffer, folder, publicId, resourceType = 'image' }) => {
    ensureCloudinaryConfigured();

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: publicId,
                resource_type: resourceType,
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(result);
            }
        );

        stream.end(buffer);
    });
};

module.exports = {
    ensureCloudinaryConfigured,
    uploadBufferToCloudinary,
};
