'use strict';

const crypto = require('crypto');
const config = require('../config');

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

/** Hash de contrasena con scrypt (sin dependencias nativas extra). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p)
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function randomId(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos
function randomCode(length = 6) {
  const buf = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

/** Firma HMAC del identificador de sesion, para detectar cookies manipuladas. */
function signValue(value) {
  const mac = crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
  return `${value}.${mac}`;
}

function unsignValue(signed) {
  if (typeof signed !== 'string') return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(value)
    .digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

module.exports = { hashPassword, verifyPassword, randomId, randomCode, signValue, unsignValue };
