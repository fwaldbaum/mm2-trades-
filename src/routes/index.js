'use strict';

const express = require('express');

const router = express.Router();

router.get('/health', (_req, res) => res.json({ ok: true, service: 'mm2-trades-creators', time: new Date().toISOString() }));

router.use('/program', require('./program.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/me', require('./me.routes'));
router.use('/submissions', require('./submissions.routes'));
router.use('/withdrawals', require('./withdrawals.routes'));
router.use('/items', require('./items.routes'));
router.use('/tiers', require('./tiers.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/roblox-verification', require('./verification.routes'));

module.exports = router;
