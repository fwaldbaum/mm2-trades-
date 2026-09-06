'use strict';

const express = require('express');
const tiers = require('../services/tiers');
const stats = require('../services/stats');
const earnings = require('../services/earnings');
const settings = require('../services/settings');
const { asyncHandler } = require('../lib/errors');
const { requireCreator } = require('../middleware/auth');

const router = express.Router();
router.use(requireCreator);

/** Estructura completa de tiers + situacion del creador actual. */
router.get('/', asyncHandler(async (req, res) => {
  const all = tiers.list();
  const current = req.creator.tier_id ? tiers.byId(req.creator.tier_id) : tiers.lowest();
  const next = current ? tiers.next(current.rank) : null;
  const perf = stats.performance(req.creator.id);
  const progress = tiers.progressTo(next, {
    subscribers: req.creator.subscribers,
    avg_views: perf.avg_views || req.creator.avg_views
  });

  res.json({
    ok: true,
    data: {
      tiers: all,
      current,
      next,
      progress,
      upgrade_note: settings.get('tiers.upgrade_note'),
      earnings_model: earnings.describe(),
      creator_stats: {
        subscribers: req.creator.subscribers,
        avg_views: perf.avg_views || req.creator.avg_views
      }
    }
  });
}));

module.exports = router;
