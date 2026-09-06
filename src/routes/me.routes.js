'use strict';

const express = require('express');
const creators = require('../services/creators');
const balance = require('../services/balance');
const stats = require('../services/stats');
const tiers = require('../services/tiers');
const earnings = require('../services/earnings');
const settings = require('../services/settings');
const submissions = require('../services/submissions');
const withdrawals = require('../services/withdrawals');
const v = require('../lib/validate');
const { asyncHandler } = require('../lib/errors');
const { requireCreator } = require('../middleware/auth');

const router = express.Router();
router.use(requireCreator);

/** Perfil del creador autenticado. */
router.get('/', asyncHandler(async (req, res) => {
  res.json({ ok: true, data: creators.profile(req.creator, req.user) });
}));

/** Todo lo que necesita la pantalla principal, en una sola peticion. */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const creator = req.creator;
  const profile = creators.profile(creator, req.user);
  const perf = stats.performance(creator.id);
  const range = String(req.query.range || '6m');
  const progress = tiers.progressTo(profile.next_tier, {
    subscribers: creator.subscribers,
    avg_views: perf.avg_views || creator.avg_views
  });

  res.json({
    ok: true,
    data: {
      profile,
      balance: balance.get(creator.id),
      performance: perf,
      timeseries: stats.timeseries(creator.id, range),
      range,
      tier_progress: progress,
      code_usage: stats.codeUsage(creator.id, 'monthly'),
      submissions: submissions.listForCreator(creator.id, { limit: 6 }),
      withdrawals: withdrawals.listForCreator(creator.id, { limit: 6 }),
      activity: stats.recentActivity(creator.id, 10),
      earnings_model: earnings.describe(),
      withdrawal_methods: settings.withdrawalMethods(),
      limits: {
        min_robux: settings.get('withdrawal.min_robux'),
        max_robux_per_request: settings.get('withdrawal.max_robux_per_request'),
        max_open_requests: settings.get('withdrawal.max_open_requests'),
        processing_note: settings.get('withdrawal.processing_note')
      }
    }
  });
}));

router.get('/balance', asyncHandler(async (req, res) => {
  res.json({ ok: true, data: balance.get(req.creator.id) });
}));

router.get('/performance', asyncHandler(async (req, res) => {
  const range = String(req.query.range || '6m');
  res.json({
    ok: true,
    data: {
      summary: stats.performance(req.creator.id),
      timeseries: stats.timeseries(req.creator.id, range),
      range
    }
  });
}));

router.get('/code', asyncHandler(async (req, res) => {
  const granularity = req.query.granularity === 'weekly' ? 'weekly' : 'monthly';
  res.json({ ok: true, data: stats.codeUsage(req.creator.id, granularity) });
}));

router.get('/earnings', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json({
    ok: true,
    data: {
      items: stats.earningsHistory(req.creator.id, { limit, offset }),
      model: earnings.describe()
    }
  });
}));

router.get('/activity', asyncHandler(async (req, res) => {
  res.json({ ok: true, data: stats.recentActivity(req.creator.id, Math.min(Number(req.query.limit) || 20, 50)) });
}));

/** Actualiza los campos del perfil que el creador puede editar. */
router.patch('/', asyncHandler(async (req, res) => {
  const body = v.requireBody(req);
  v.rejectSensitiveFields(body);

  const patch = {};
  if (body.display_name !== undefined) patch.display_name = v.str(body.display_name, 'display_name', { min: 2, max: 40 });
  if (body.roblox_username !== undefined) patch.roblox_username = v.robloxUsername(body.roblox_username, 'roblox_username', { required: false });
  if (body.roblox_user_id !== undefined) patch.roblox_user_id = v.robloxUserId(body.roblox_user_id);
  if (body.contact_discord !== undefined) patch.contact_discord = v.str(body.contact_discord, 'contact_discord', { max: 40, required: false });
  if (body.country !== undefined) patch.country = v.str(body.country, 'country', { max: 40, required: false });

  const updated = creators.updateProfile(req.creator.id, patch);
  require('../lib/audit').log({
    actorId: req.user.id, action: 'creator.update_profile',
    entity: 'creator', entityId: req.creator.id, meta: Object.keys(patch)
  });
  res.json({ ok: true, data: creators.profile(updated, req.user) });
}));

module.exports = router;
