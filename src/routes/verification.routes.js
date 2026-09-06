'use strict';

const express = require('express');
const { db } = require('../db');
const v = require('../lib/validate');
const { randomCode } = require('../lib/crypto');
const { asyncHandler, conflict, notFound } = require('../lib/errors');
const { requireCreator } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const config = require('../config');
const audit = require('../lib/audit');

const router = express.Router();
router.use(requireCreator);

/**
 * VERIFICACION DE CUENTA DE ROBLOX
 *
 * Metodo seguro: generamos una frase unica y el creador la pega en la
 * descripcion de su perfil de Roblox. El staff la comprueba y aprueba.
 *
 * MM2 Trades NUNCA pide contrasenas, cookies, .ROBLOSECURITY ni tokens.
 * Cualquier intento de enviar esos campos se rechaza en validate.js.
 */
const limiter = rateLimit({ windowMs: 10 * 60_000, max: config.rateLimits.verification, key: (req) => `vf:${req.user.id}` });

router.get('/', asyncHandler(async (req, res) => {
  const latest = db.prepare(`
    SELECT id, roblox_username, phrase, status, staff_note, created_at, resolved_at
    FROM roblox_verifications WHERE creator_id = ?
    ORDER BY created_at DESC, id DESC LIMIT 1
  `).get(req.creator.id);

  res.json({
    ok: true,
    data: {
      verified: !!req.creator.roblox_verified,
      roblox_username: req.creator.roblox_username,
      roblox_user_id: req.creator.roblox_user_id,
      request: latest || null,
      never_asked: [
        'Contrasena de Roblox',
        'Cookies de sesion o .ROBLOSECURITY',
        'Tokens de acceso',
        'Codigos de verificacion en dos pasos'
      ]
    }
  });
}));

router.post('/', limiter, asyncHandler(async (req, res) => {
  const body = v.requireBody(req);
  v.rejectSensitiveFields(body);

  const username = v.robloxUsername(body.roblox_username ?? req.creator.roblox_username);
  const pending = db.prepare(`
    SELECT id FROM roblox_verifications WHERE creator_id = ? AND status = 'pending'
  `).get(req.creator.id);
  if (pending) {
    throw conflict('verification_pending', 'Ya tienes una verificacion pendiente de revision.');
  }

  const code = randomCode(6);
  const phrase = `MM2 Trades creator · ${username} · verify-${code}`;

  const info = db.prepare(`
    INSERT INTO roblox_verifications (creator_id, roblox_username, phrase, code)
    VALUES (?, ?, ?, ?)
  `).run(req.creator.id, username, phrase, code);

  // Guarda el usuario declarado, aun sin verificar.
  db.prepare(`
    UPDATE creators SET roblox_username = ?, roblox_verified = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(username, req.creator.id);

  audit.log({ actorId: req.user.id, action: 'roblox.verification_request', entity: 'creator', entityId: req.creator.id });

  res.status(201).json({
    ok: true,
    data: {
      id: info.lastInsertRowid,
      phrase,
      status: 'pending',
      instructions: [
        'Copia la frase de arriba.',
        'Pegala en la descripcion ("About") de tu perfil de Roblox.',
        'Vuelve aqui y avisa al staff en tu ticket para que la revise.',
        'Cuando quede verificada puedes quitarla de tu perfil.'
      ]
    }
  });
}));

router.delete('/:id(\\d+)', asyncHandler(async (req, res) => {
  const row = db.prepare(`
    SELECT * FROM roblox_verifications WHERE id = ? AND creator_id = ?
  `).get(Number(req.params.id), req.creator.id);
  if (!row) throw notFound('Esa solicitud de verificacion no existe.');
  if (row.status !== 'pending') throw conflict('verification_closed', 'Esa solicitud ya fue resuelta.');
  db.prepare(`UPDATE roblox_verifications SET status = 'expired', resolved_at = datetime('now') WHERE id = ?`)
    .run(row.id);
  res.json({ ok: true });
}));

module.exports = router;
