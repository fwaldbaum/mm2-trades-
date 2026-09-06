'use strict';

const config = require('../config');
const auth = require('../services/auth');
const creatorsService = require('../services/creators');
const { unauthorized, forbidden } = require('../lib/errors');

/** Adjunta req.user / req.creator si la cookie de sesion es valida. */
function attachUser(req, _res, next) {
  const cookie = req.cookies ? req.cookies[config.sessionCookieName] : null;
  if (cookie) {
    const found = auth.sessionFromCookie(cookie);
    if (found) {
      req.user = found.user;
      req.session = found.session;
      req.creator = creatorsService.byUserId(found.user.id) || null;
    }
  }
  next();
}

function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

/** Exige que la cuenta tenga perfil de creador (el dashboard es para creadores). */
function requireCreator(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (!req.creator) return next(forbidden('Tu cuenta no tiene un perfil de creador asociado.'));
  next();
}

function setSessionCookie(res, cookieValue) {
  res.cookie(config.sessionCookieName, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(config.sessionCookieName, { path: '/' });
}

module.exports = { attachUser, requireAuth, requireCreator, setSessionCookie, clearSessionCookie };
