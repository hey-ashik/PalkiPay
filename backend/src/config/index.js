'use strict';

const path = require('path');
const fs = require('fs');

// Load `.env` from the repo root first, then allow `backend/.env` to override.
// Real environment variables (e.g. set in the Hostinger panel) always win.
const dotenv = require('dotenv');
const rootEnv = path.resolve(__dirname, '../../../.env');
const backendEnv = path.resolve(__dirname, '../../.env');
for (const file of [backendEnv, rootEnv]) {
  if (fs.existsSync(file)) dotenv.config({ path: file, quiet: true });
}

const env = process.env.NODE_ENV || 'development';
const appUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  env,
  isProd: env === 'production',
  port: int(process.env.PORT, 3000),
  appUrl,
  /** When APP_URL is not set, public links are built from the incoming request's host. */
  appUrlExplicit: Boolean(process.env.APP_URL),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: int(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || 'palkipay',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    connectionLimit: int(process.env.DB_POOL_SIZE, 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    cookieName: 'pp_session',
  },

  payments: {
    expiryMinutes: int(process.env.PAYMENT_EXPIRY_MINUTES, 60),
    verifyTimeoutSeconds: int(process.env.VERIFY_TIMEOUT_SECONDS, 90),
  },

  telegram: {
    // Webhooks need a public HTTPS URL; fall back to long-polling elsewhere.
    mode: process.env.TELEGRAM_MODE || (appUrl.startsWith('https://') ? 'webhook' : 'polling'),
  },
};

if (!config.jwt.secret) {
  if (config.isProd) {
    throw new Error('JWT_SECRET must be set in production. See .env.example.');
  }
  config.jwt.secret = 'palkipay-dev-only-secret-do-not-use-in-production';
  console.warn('[config] JWT_SECRET not set — using an insecure development secret.');
}

module.exports = config;
