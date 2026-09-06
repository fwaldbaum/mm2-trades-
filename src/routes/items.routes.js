'use strict';

const express = require('express');
const { db } = require('../db');
const { asyncHandler } = require('../lib/errors');
const { requireCreator } = require('../middleware/auth');

const router = express.Router();
router.use(requireCreator);

const RARITY_ORDER = ['godly', 'ancient', 'vintage', 'legendary', 'rare', 'uncommon', 'common'];
const RARITY_LABELS = {
  godly: 'Godly', ancient: 'Ancient', vintage: 'Vintage', legendary: 'Legendary',
  rare: 'Rare', uncommon: 'Uncommon', common: 'Common'
};

/**
 * Catalogo de recompensas MM2. Nombres, valores, imagenes y stock salen
 * siempre de la base de datos: el frontend no mantiene ninguna lista.
 */
router.get('/', asyncHandler(async (req, res) => {
  const rows = db.prepare(`
    SELECT id, slug, name, rarity, category, value_robux, image_url, accent, stock
    FROM mm2_items WHERE active = 1
    ORDER BY value_robux DESC
  `).all();

  const items = rows.map((r) => ({
    ...r,
    rarity_label: RARITY_LABELS[r.rarity] || r.rarity,
    available: r.stock > 0
  }));

  const groups = RARITY_ORDER
    .map((rarity) => ({
      rarity,
      label: RARITY_LABELS[rarity],
      items: items.filter((i) => i.rarity === rarity)
    }))
    .filter((g) => g.items.length > 0);

  res.json({ ok: true, data: { items, groups, rarities: RARITY_ORDER, labels: RARITY_LABELS } });
}));

module.exports = router;
