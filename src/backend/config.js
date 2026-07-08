require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const isAsar = __dirname.includes('app.asar');
const dataDir = isAsar
  ? path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), '..', '..', 'data')
  : path.join(__dirname, '..', '..', 'data');
const runtimeConfigPath = path.join(dataDir, 'runtime-config.json');
let runtimeConfig = {};
try { runtimeConfig = JSON.parse(require('fs').readFileSync(runtimeConfigPath, 'utf8')); } catch {}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  jwtExpiry: '24h',
  maintenanceMode: runtimeConfig.maintenance === true || process.env.MAINTENANCE_MODE === 'true',
  adminDisabled: runtimeConfig.adminDisabled === true || process.env.ADMIN_DISABLED === 'true',
  dbPath: process.env.DB_PATH || path.join(dataDir, 'tickets.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(dataDir, 'uploads'),
  logDir: process.env.LOG_DIR || path.join(dataDir, 'logs'),
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'application/zip'],
  ad: {
    enabled: runtimeConfig.adEnabled || process.env.AD_ENABLED === 'true',
    url: process.env.AD_URL || runtimeConfig.adUrl || 'ldap://domain.local',
    baseDN: process.env.AD_BASE_DN || runtimeConfig.adBaseDN || 'DC=domain,DC=local',
    username: process.env.AD_USERNAME || runtimeConfig.adUser || '',
    password: process.env.AD_PASSWORD || runtimeConfig.adPass || '',
    syncInterval: parseInt(process.env.AD_SYNC_INTERVAL, 10) || 3600000
  },
  smtp: {
    enabled: runtimeConfig.smtpEnabled || process.env.SMTP_ENABLED === 'true',
    host: process.env.SMTP_HOST || runtimeConfig.smtpHost || '',
    port: parseInt(process.env.SMTP_PORT, 10) || parseInt(runtimeConfig.smtpPort, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || runtimeConfig.smtpUser || '',
    pass: process.env.SMTP_PASS || runtimeConfig.smtpPass || '',
    from: process.env.SMTP_FROM || runtimeConfig.smtpFrom || 'noreply@hubly.local'
  },
  app: {
    name: 'Hubly',
    version: '2.0.0',
    logoPath: '/api/settings/logo'
  }
};

module.exports = config;
