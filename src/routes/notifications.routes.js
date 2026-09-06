'use strict';

const express = require('express');
const notifications = require('../services/notifications');
const { asyncHandler } = require('../lib/errors');
const { requireCreator } = require('../middleware/auth');

const router = express.Router();
router.use(requireCreator);

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  res.json({
    ok: true,
    data: {
      items: notifications.list(req.creator.id, limit),
      unread: notifications.unread(req.creator.id)
    }
  });
}));

router.post('/read', asyncHandler(async (req, res) => {
  notifications.readAll(req.creator.id);
  res.json({ ok: true, data: { unread: 0 } });
}));

router.post('/:id(\\d+)/read', asyncHandler(async (req, res) => {
  notifications.readOne(Number(req.params.id), req.creator.id);
  res.json({ ok: true, data: { unread: notifications.unread(req.creator.id) } });
}));

module.exports = router;
