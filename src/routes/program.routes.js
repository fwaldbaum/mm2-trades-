'use strict';

const express = require('express');
const settings = require('../services/settings');
const earnings = require('../services/earnings');
const { asyncHandler } = require('../lib/errors');

const router = express.Router();

/**
 * Configuracion publica del programa. Solo lectura: los valores los
 * define administracion, el creador nunca los modifica.
 */
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: {
      name: settings.get('program.name'),
      currency: settings.get('program.currency'),
      disclaimer: settings.get('legal.disclaimer'),
      earnings_model: earnings.describe(),
      withdrawal: {
        methods: settings.withdrawalMethods(),
        min_robux: settings.get('withdrawal.min_robux'),
        max_robux_per_request: settings.get('withdrawal.max_robux_per_request'),
        max_open_requests: settings.get('withdrawal.max_open_requests'),
        processing_note: settings.get('withdrawal.processing_note')
      },
      submission: {
        rules: settings.get('submission.rules'),
        max_per_day: settings.get('submission.max_per_day'),
        window_days: settings.get('submission.window_days')
      },
      tiers_note: settings.get('tiers.upgrade_note')
    }
  });
}));

module.exports = router;
