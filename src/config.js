require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    db: process.env.MONGODB_DB || 'registro_municipal',
  },
  mail: {
    host: process.env.MAIL_HOST || 'localhost',
    port: parseInt(process.env.MAIL_PORT || '1025', 10),
    from: process.env.MAIL_FROM || 'no-reply@registro.local',
  },
  magicLinkTtlMin: parseInt(process.env.MAGIC_LINK_TTL_MIN || '15', 10),
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '10', 10),
};

module.exports = config;
