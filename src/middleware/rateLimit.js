'use strict';

const { tooMany } = require('../lib/errors');

/** Limitador en memoria, suficiente para una instancia unica. */
function rateLimit({ windowMs = 60_000, max = 30, key = (req) => req.ip } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref?.();

  return function limiter(req, _res, next) {
    const k = key(req);
    const now = Date.now();
    const entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      hits.set(k, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) return next(tooMany());
    next();
  };
}

module.exports = { rateLimit };
