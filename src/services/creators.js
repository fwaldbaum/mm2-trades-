'use strict';

const { db } = require('../db');
const tiers = require('./tiers');
const balance = require('./balance');
const { randomCode } = require('../lib/crypto');

const selectByUser = db.prepare('SELECT * FROM creators WHERE user_id = ?');
const selectById = db.prepare('SELECT * FROM creators WHERE id = ?');
const selectCode = db.prepare('SELECT code FROM creator_codes WHERE creator_id = ? AND active = 1 ORDER BY created_at ASC LIMIT 1');
const codeExists = db.prepare('SELECT 1 AS x FROM creator_codes WHERE code = ?');
const insertCode = db.prepare('INSERT INTO creator_codes (code, creator_id) VALUES (?, ?)');

const byUserId = (userId) => selectByUser.get(userId);
const byId = (id) => selectById.get(id);

/** Genera un codigo unico a partir del nombre del creador. */
function generateCode(displayName) {
  const base = String(displayName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  for (let i = 0; i < 40; i += 1) {
    const candidate = i === 0 && base.length >= 3 ? base : `${base.slice(0, 5) || 'MM2'}${randomCode(3)}`;
    if (!codeExists.get(candidate)) return candidate;
  }
  return `MM2${randomCode(6)}`;
}

function ensureCode(creator) {
  const existing = selectCode.get(creator.id);
  if (existing) return existing.code;
  const code = generateCode(creator.display_name);
  insertCode.run(code, creator.id);
  return code;
}

/** Vista publica del creador que consume el frontend. */
function profile(creator, user) {
  const tier = creator.tier_id ? tiers.byId(creator.tier_id) : tiers.lowest();
  const nextTier = tier ? tiers.next(tier.rank) : null;
  return {
    id: creator.id,
    display_name: creator.display_name,
    username: user ? user.username : creator.display_name,
    email: user ? user.email : null,
    avatar_url: creator.avatar_url,
    initials: String(creator.display_name || '?').trim().slice(0, 2).toUpperCase(),
    code: ensureCode(creator),
    tier,
    next_tier: nextTier,
    roblox: {
      username: creator.roblox_username,
      user_id: creator.roblox_user_id,
      verified: !!creator.roblox_verified
    },
    contact_discord: creator.contact_discord,
    country: creator.country,
    status: creator.status,
    subscribers: creator.subscribers,
    avg_views: creator.avg_views,
    joined_at: creator.joined_at,
    balance: balance.get(creator.id)
  };
}

const EDITABLE_FIELDS = ['display_name', 'roblox_username', 'roblox_user_id', 'contact_discord', 'country', 'avatar_url'];

/**
 * Actualiza solo los campos que el creador puede tocar.
 * Tier, balance, codigo y estado quedan fuera a proposito: los gestiona el staff.
 */
function updateProfile(creatorId, patch) {
  const fields = [];
  const params = { id: creatorId };
  for (const key of EDITABLE_FIELDS) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = patch[key];
    }
  }
  // Cambiar el usuario de Roblox invalida la verificacion anterior.
  if (patch.roblox_username !== undefined) {
    const current = selectById.get(creatorId);
    if (current && current.roblox_username !== patch.roblox_username) {
      fields.push('roblox_verified = 0');
    }
  }
  if (!fields.length) return selectById.get(creatorId);
  db.prepare(`UPDATE creators SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = @id`).run(params);
  return selectById.get(creatorId);
}

module.exports = { byUserId, byId, ensureCode, generateCode, profile, updateProfile, EDITABLE_FIELDS };
