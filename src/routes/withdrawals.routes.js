'use strict';

const express = require('express');
const withdrawals = require('../services/withdrawals');
const balance = require('../services/balance');
const settings = require('../services/settings');
const v = require('../lib/validate');
const { asyncHandler } = require('../lib/errors');
const { requireCreator } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const config = require('../config');

const router = express.Router();
router.use(requireCreator);

const withdrawLimiter = rateLimit({
  windowMs: 60_000,
  max: config.rateLimits.withdrawal,
  key: (req) => `wd:${req.user ? req.user.id : req.ip}`
});

/**
 * Opciones del formulario de retiro.
 * Solo se exponen dos metodos: Robux e items de MM2.
 */
router.get('/meta', asyncHandler(async (req, res) => {
  const methods = settings.withdrawalMethods();
  res.json({
    ok: true,
    data: {
      methods: methods.map((key) => ({
        key,
        label: withdrawals.METHOD_LABELS[key],
        description: key === 'robux'
          ? 'Recibe Robux directamente en tu cuenta de Roblox.'
          : 'Canjea tu saldo por un item de Murder Mystery 2 del catalogo.'
      })),
      statuses: withdrawals.STATUS_LABELS,
      balance: balance.get(req.creator.id),
      limits: {
        min_robux: settings.get('withdrawal.min_robux'),
        max_robux_per_request: settings.get('withdrawal.max_robux_per_request'),
        max_open_requests: settings.get('withdrawal.max_open_requests'),
        cooldown_hours: settings.get('withdrawal.cooldown_hours'),
        requires_roblox_verification: settings.get('withdrawal.requires_roblox_verification')
      },
      processing_note: settings.get('withdrawal.processing_note'),
      roblox: {
        username: req.creator.roblox_username,
        user_id: req.creator.roblox_user_id,
        verified: !!req.creator.roblox_verified
      }
    }
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json({ ok: true, data: withdrawals.listForCreator(req.creator.id, { limit, offset }) });
}));

router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  res.json({ ok: true, data: withdrawals.getForCreator(Number(req.params.id), req.creator.id) });
}));

/**
 * Solicita un retiro.
 * El servidor vuelve a comprobar metodo, importe, balance, limites y stock;
 * el cliente no puede decidir cuanto vale un item ni cuanto saldo tiene.
 */
router.post('/', withdrawLimiter, asyncHandler(async (req, res) => {
  const body = v.requireBody(req);
  v.rejectSensitiveFields(body);

  const method = v.oneOf(body.method, 'method', withdrawals.METHODS);
  const input = { method };

  if (method === 'robux') {
    input.amount_robux = v.int(body.amount_robux, 'amount_robux', { min: 1, max: 10_000_000 });
  } else {
    input.item_id = v.int(body.item_id, 'item_id', { min: 1 });
  }
  input.roblox_username = v.robloxUsername(
    body.roblox_username ?? req.creator.roblox_username, 'roblox_username', { required: true }
  );
  input.roblox_user_id = v.robloxUserId(body.roblox_user_id ?? req.creator.roblox_user_id);

  const created = withdrawals.create(req.creator, input);
  res.status(201).json({ ok: true, data: { withdrawal: created, balance: balance.get(req.creator.id) } });
}));

router.post('/:id(\\d+)/cancel', asyncHandler(async (req, res) => {
  const updated = withdrawals.cancel(req.creator, Number(req.params.id));
  res.json({ ok: true, data: { withdrawal: updated, balance: balance.get(req.creator.id) } });
}));

module.exports = router;
