'use strict';

const { badRequest } = require('./errors');

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function requireBody(req) {
  if (!isPlainObject(req.body)) throw badRequest('invalid_body', 'Cuerpo de la peticion invalido.');
  return req.body;
}

function str(value, field, { min = 1, max = 500, required = true, trim = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest('field_required', `El campo "${field}" es obligatorio.`, { field });
    return null;
  }
  if (typeof value !== 'string') throw badRequest('field_invalid', `El campo "${field}" debe ser texto.`, { field });
  const out = trim ? value.trim() : value;
  if (out.length < min) throw badRequest('field_too_short', `"${field}" debe tener al menos ${min} caracteres.`, { field });
  if (out.length > max) throw badRequest('field_too_long', `"${field}" no puede superar ${max} caracteres.`, { field });
  return out;
}

function int(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest('field_required', `El campo "${field}" es obligatorio.`, { field });
    return null;
  }
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[\s,._]/g, ''));
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw badRequest('field_invalid', `"${field}" debe ser un numero entero.`, { field });
  }
  if (n < min) throw badRequest('field_min', `"${field}" debe ser como minimo ${min}.`, { field, min });
  if (n > max) throw badRequest('field_max', `"${field}" no puede superar ${max}.`, { field, max });
  return n;
}

function oneOf(value, field, allowed, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest('field_required', `El campo "${field}" es obligatorio.`, { field });
    return null;
  }
  const v = String(value);
  if (!allowed.includes(v)) {
    throw badRequest('field_invalid', `Valor no permitido para "${field}".`, { field, allowed });
  }
  return v;
}

function email(value, field = 'email') {
  const v = str(value, field, { max: 190 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    throw badRequest('email_invalid', 'Introduce un correo valido.', { field });
  }
  return v;
}

function password(value, field = 'password') {
  const v = str(value, field, { min: 8, max: 128, trim: false });
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) {
    throw badRequest('password_weak', 'La contrasena debe incluir letras y numeros.', { field });
  }
  return v;
}

const ROBLOX_USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
function robloxUsername(value, field = 'roblox_username', { required = true } = {}) {
  const v = str(value, field, { min: 3, max: 20, required });
  if (v === null) return null;
  if (!ROBLOX_USERNAME_RE.test(v)) {
    throw badRequest('roblox_username_invalid',
      'El usuario de Roblox solo admite letras, numeros y guion bajo (3-20 caracteres).', { field });
  }
  return v;
}

function robloxUserId(value, field = 'roblox_user_id', { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest('field_required', `El campo "${field}" es obligatorio.`, { field });
    return null;
  }
  const v = String(value).trim();
  if (!/^[0-9]{1,20}$/.test(v)) {
    throw badRequest('roblox_id_invalid', 'El ID de Roblox debe ser numerico.', { field });
  }
  return v;
}

/**
 * Detecta y rechaza cualquier intento de enviar credenciales sensibles.
 * MM2 Trades nunca pide contrasenas de Roblox, cookies ni tokens.
 */
const FORBIDDEN_SECRET_FIELDS = [
  'roblox_password', 'robloxpassword', 'roblosecurity', '.roblosecurity',
  'cookie', 'cookies', 'session_cookie', 'auth_token', 'roblox_token', 'roblox_cookie'
];
function rejectSensitiveFields(body) {
  if (!isPlainObject(body)) return;
  for (const key of Object.keys(body)) {
    const norm = key.toLowerCase().replace(/[^a-z.]/g, '');
    if (FORBIDDEN_SECRET_FIELDS.includes(norm)) {
      throw badRequest('sensitive_field_rejected',
        'MM2 Trades nunca solicita contrasenas, cookies ni tokens de Roblox. La peticion fue rechazada.');
    }
  }
}

/** URL http(s) de una plataforma de video soportada. */
const PLATFORM_HOSTS = {
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com'],
  instagram: ['instagram.com', 'www.instagram.com']
};

function videoUrl(value, field = 'url') {
  const raw = str(value, field, { max: 500 });
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw badRequest('url_invalid', 'El enlace no es una URL valida.', { field });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw badRequest('url_invalid', 'El enlace debe empezar por http:// o https://', { field });
  }
  const host = parsed.hostname.toLowerCase();
  let platform = null;
  for (const [name, hosts] of Object.entries(PLATFORM_HOSTS)) {
    if (hosts.includes(host)) { platform = name; break; }
  }
  if (!platform) {
    throw badRequest('url_platform_unsupported',
      'Solo aceptamos enlaces de YouTube, TikTok o Instagram.', { field });
  }
  // Clave normalizada para impedir enviar el mismo video dos veces.
  const key = `${platform}:${host.replace(/^(www|m|vm|music)\./, '')}${parsed.pathname.replace(/\/+$/, '')}` +
    (parsed.searchParams.get('v') ? `?v=${parsed.searchParams.get('v')}` : '');
  return { url: parsed.toString(), platform, urlKey: key.toLowerCase() };
}

module.exports = {
  requireBody, str, int, oneOf, email, password,
  robloxUsername, robloxUserId, rejectSensitiveFields, videoUrl, isPlainObject
};
