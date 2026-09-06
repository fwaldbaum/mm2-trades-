'use strict';

const { db } = require('../db');
const config = require('../config');
const { hashPassword, verifyPassword, randomId, signValue, unsignValue } = require('../lib/crypto');
const creators = require('./creators');
const tiers = require('./tiers');
const balance = require('./balance');
const notifications = require('./notifications');
const audit = require('../lib/audit');
const { conflict, unauthorized } = require('../lib/errors');

const selectUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const selectUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const selectUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const insertSession = db.prepare(`
  INSERT INTO sessions (id, user_id, user_agent, ip, expires_at)
  VALUES (@id, @user_id, @user_agent, @ip, datetime('now', @ttl))
`);
const selectSession = db.prepare(`
  SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')
`);
const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');
const purgeSessions = db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`);

/** Alta de creador. Crea usuario, perfil, codigo y balance en una transaccion. */
const register = db.transaction(({ email, username, password, displayName }) => {
  if (selectUserByEmail.get(email)) throw conflict('email_taken', 'Ese correo ya esta registrado.');
  if (selectUserByUsername.get(username)) throw conflict('username_taken', 'Ese nombre de usuario ya existe.');

  const userInfo = db.prepare(`
    INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, 'creator')
  `).run(email, username, hashPassword(password));
  const userId = userInfo.lastInsertRowid;

  const starter = tiers.lowest();
  const creatorInfo = db.prepare(`
    INSERT INTO creators (user_id, display_name, tier_id) VALUES (?, ?, ?)
  `).run(userId, displayName || username, starter ? starter.id : null);
  const creatorId = creatorInfo.lastInsertRowid;

  balance.ensure(creatorId);
  creators.ensureCode(creators.byId(creatorId));
  notifications.push(creatorId, {
    type: 'success', icon: 'star',
    title: 'Bienvenido al programa de creadores',
    body: 'Ya tienes tu codigo. Publica contenido con MM2 Trades y envialo para empezar a ganar.',
    link: '/help'
  });
  audit.log({ actorId: userId, action: 'auth.register', entity: 'user', entityId: userId });

  return selectUserById.get(userId);
});

function login({ identifier, password, userAgent, ip }) {
  const id = String(identifier || '').trim();
  const user = id.includes('@')
    ? selectUserByEmail.get(id.toLowerCase())
    : selectUserByUsername.get(id);
  // Comparacion en tiempo constante tambien cuando el usuario no existe.
  const stored = user ? user.password_hash : hashPassword('__no_user__');
  const ok = verifyPassword(password, stored);
  if (!user || !ok) throw unauthorized('Usuario o contrasena incorrectos.');
  if (user.status !== 'active') throw unauthorized('Tu cuenta esta suspendida. Contacta con el staff.');

  const session = createSession(user, { userAgent, ip });
  audit.log({ actorId: user.id, action: 'auth.login', entity: 'user', entityId: user.id, ip });
  return { user, session };
}

function createSession(user, { userAgent = null, ip = null } = {}) {
  purgeSessions.run();
  const id = randomId(32);
  insertSession.run({
    id, user_id: user.id, user_agent: userAgent, ip,
    ttl: `+${config.sessionTtlDays} days`
  });
  return { id, cookie: signValue(id) };
}

function sessionFromCookie(cookieValue) {
  const id = unsignValue(cookieValue);
  if (!id) return null;
  const session = selectSession.get(id);
  if (!session) return null;
  const user = selectUserById.get(session.user_id);
  if (!user || user.status !== 'active') return null;
  return { session, user };
}

function logout(cookieValue) {
  const id = unsignValue(cookieValue);
  if (id) deleteSession.run(id);
}

module.exports = { register, login, logout, sessionFromCookie, createSession, selectUserById };
