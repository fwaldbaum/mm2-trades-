'use strict';

const express = require('express');
const submissions = require('../services/submissions');
const settings = require('../services/settings');
const tiers = require('../services/tiers');
const earnings = require('../services/earnings');
const v = require('../lib/validate');
const { asyncHandler, badRequest } = require('../lib/errors');
const { requireCreator } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const config = require('../config');

const router = express.Router();
router.use(requireCreator);

const submitLimiter = rateLimit({
  windowMs: 60_000,
  max: config.rateLimits.submission,
  key: (req) => `sub:${req.user ? req.user.id : req.ip}`
});

/** Reglas y opciones del formulario de envio. */
router.get('/meta', asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: {
      content_types: submissions.CONTENT_TYPES.map((key) => ({
        key,
        label: submissions.CONTENT_LABELS[key],
        rate_bucket: submissions.rateBucket(key)
      })),
      statuses: submissions.STATUS_LABELS,
      rules: settings.get('submission.rules'),
      max_per_day: settings.get('submission.max_per_day'),
      window_days: settings.get('submission.window_days'),
      earnings_model: earnings.describe()
    }
  });
}));

/** Estimacion de ganancias en vivo mientras el creador rellena el formulario. */
router.get('/estimate', asyncHandler(async (req, res) => {
  const views = v.int(req.query.views, 'views', { min: 0, max: 1_000_000_000 });
  const contentType = v.oneOf(req.query.content_type, 'content_type', submissions.CONTENT_TYPES);
  const tier = req.creator.tier_id ? tiers.byId(req.creator.tier_id) : tiers.lowest();
  const calc = earnings.compute(tier, submissions.rateBucket(contentType), views);
  res.json({ ok: true, data: { ...calc, tier_key: tier ? tier.key : null } });
}));

router.get('/', asyncHandler(async (req, res) => {
  const status = req.query.status
    ? v.oneOf(req.query.status, 'status', Object.keys(submissions.STATUS_LABELS))
    : null;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json({ ok: true, data: submissions.listForCreator(req.creator.id, { status, limit, offset }) });
}));

router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  res.json({ ok: true, data: submissions.getForCreator(Number(req.params.id), req.creator.id) });
}));

/** Alta de un envio. La URL, el tipo y las views se revalidan en servidor. */
router.post('/', submitLimiter, asyncHandler(async (req, res) => {
  const body = v.requireBody(req);
  v.rejectSensitiveFields(body);

  const { url, platform, urlKey } = v.videoUrl(body.url);
  const contentType = v.oneOf(body.content_type, 'content_type', submissions.CONTENT_TYPES);
  const views = v.int(body.views ?? 0, 'views', { min: 0, max: 1_000_000_000, required: false }) || 0;

  // Coherencia entre plataforma del enlace y tipo declarado.
  const expected = {
    tiktok: 'tiktok',
    instagram_reel: 'instagram',
    youtube_short: 'youtube',
    long_form: 'youtube'
  }[contentType];
  if (expected && platform !== expected) {
    throw badRequest('platform_mismatch',
      `El enlace es de ${platform} pero elegiste "${submissions.CONTENT_LABELS[contentType]}". Revisa el tipo de contenido.`);
  }

  const created = submissions.create(req.creator, { url, urlKey, platform, contentType, views });
  res.status(201).json({ ok: true, data: created });
}));

module.exports = router;
