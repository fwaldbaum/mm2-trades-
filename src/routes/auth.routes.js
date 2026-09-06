'use strict';

const express = require('express');
const auth = require('../services/auth');
const creators = require('../services/creators');
const v = require('../lib/validate');
const { asyncHandler } = require('../lib/errors');
const { rateLimit } = require('../middleware/rateLimit');
const config = require('../config');
const { setSessionCookie, clearSessionCookie, requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 10 * 60_000, max: config.rateLimits.login });
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, max: config.rateLimits.register });

router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
  const body = v.requireBody(req);
  v.rejectSensitiveFields(body);

  const email = v.email(body.email);
  const username = v.str(body.username, 'username', { min: 3, max: 24 });
  if (!/^[A-Za-z0-9_.-]+$/.test(username)) {
    const { badRequest } = require('../lib/errors');
    throw badRequest('username_invalid', 'El usuario solo admite letras, numeros, punto, guion y guion bajo.');
  }
  const password = v.password(body.password);
  const displayName = v.str(body.display_name, 'display_name', { min: 2, max: 40, required: false }) || username;

  const user = auth.register({ email, username, password, displayName });
  const session = auth.createSession(user, { userAgent: req.get('user-agent'), ip: req.ip });
  setSessionCookie(res, session.cookie);

  const creator = creators.byUserId(user.id);
  res.status(201).json({ ok: true, data: creators.profile(creator, user) });
}));

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const body = v.requireBody(req);
  v.rejectSensitiveFields(body);
  const identifier = v.str(body.identifier ?? body.email ?? body.username, 'identifier', { max: 190 });
  const password = v.str(body.password, 'password', { min: 1, max: 128, trim: false });

  const { user, session } = auth.login({
    identifier, password, userAgent: req.get('user-agent'), ip: req.ip
  });
  setSessionCookie(res, session.cookie);

  const creator = creators.byUserId(user.id);
  res.json({ ok: true, data: creator ? creators.profile(creator, user) : { username: user.username, email: user.email } });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const config = require('../config');
  auth.logout(req.cookies ? req.cookies[config.sessionCookieName] : null);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

/** Sesion actual. Devuelve authenticated:false en vez de 401 para no ensuciar la consola. */
router.get('/session', asyncHandler(async (req, res) => {
  if (!req.user || !req.creator) return res.json({ ok: true, data: { authenticated: false } });
  res.json({ ok: true, data: { authenticated: true, profile: creators.profile(req.creator, req.user) } });
}));

router.post('/password', requireAuth, asyncHandler(async (req, res) => {
  const body = v.requireBody(req);
  v.rejectSensitiveFields(body);
  const current = v.str(body.current_password, 'current_password', { min: 1, max: 128, trim: false });
  const next = v.password(body.new_password, 'new_password');

  const { db } = require('../db');
  const { verifyPassword, hashPassword } = require('../lib/crypto');
  const { badRequest } = require('../lib/errors');
  if (!verifyPassword(current, req.user.password_hash)) {
    throw badRequest('password_incorrect', 'La contrasena actual no es correcta.');
  }
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(hashPassword(next), req.user.id);
  // Cierra el resto de sesiones abiertas.
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.session.id);
  require('../lib/audit').log({ actorId: req.user.id, action: 'auth.password_change', entity: 'user', entityId: req.user.id });
  res.json({ ok: true });
}));

module.exports = router;
