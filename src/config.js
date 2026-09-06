'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

// Carga perezosa de un .env sin dependencias externas.
(function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
})();

const dataDir = path.join(ROOT, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const isProd = process.env.NODE_ENV === 'production';

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) {
    throw new Error('SESSION_SECRET es obligatorio en produccion.');
  }
  // En desarrollo se persiste un secreto local para no invalidar sesiones al reiniciar.
  const secretFile = path.join(dataDir, '.session-secret');
  if (fs.existsSync(secretFile)) {
    sessionSecret = fs.readFileSync(secretFile, 'utf8').trim();
  } else {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, sessionSecret, { mode: 0o600 });
  }
}

module.exports = {
  ROOT,
  isProd,
  port: Number(process.env.PORT || 3000),
  databaseFile: process.env.DATABASE_FILE
    ? path.resolve(ROOT, process.env.DATABASE_FILE)
    : path.join(dataDir, 'mm2trades.sqlite'),
  sessionSecret,
  sessionCookieName: 'mm2t_session',
  sessionTtlDays: 30,
  secureCookies: String(process.env.SECURE_COOKIES || '').toLowerCase() === 'true' || isProd,
  seedDemo: String(process.env.SEED_DEMO ?? 'true').toLowerCase() === 'true',
  currency: { code: 'ROBUX', symbol: 'R$' },

  // Limites anti-abuso. Configurables por entorno; los valores por defecto
  // son los de produccion.
  rateLimits: {
    login: Number(process.env.RATE_LIMIT_LOGIN_MAX || 20),
    register: Number(process.env.RATE_LIMIT_REGISTER_MAX || 10),
    submission: Number(process.env.RATE_LIMIT_SUBMISSION_MAX || 10),
    withdrawal: Number(process.env.RATE_LIMIT_WITHDRAWAL_MAX || 8),
    verification: Number(process.env.RATE_LIMIT_VERIFICATION_MAX || 6)
  }
};
