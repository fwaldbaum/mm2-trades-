'use strict';

const { db } = require('../db');
const { rangeToSince, monthBuckets } = require('../lib/dates');

/** Resumen de rendimiento del creador. */
function performance(creatorId) {
  const s = db.prepare(`
    SELECT
      COUNT(*)                                                       AS total,
      SUM(CASE WHEN status IN ('approved','paid') THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'rejected'           THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN status IN ('pending','in_review') THEN 1 ELSE 0 END) AS in_review,
      COALESCE(SUM(CASE WHEN status IN ('approved','paid')
              THEN COALESCE(views_verified, views_reported) ELSE 0 END), 0) AS total_views,
      COALESCE(SUM(final_robux), 0)                                  AS earned
    FROM submissions WHERE creator_id = ?
  `).get(creatorId);

  const best = db.prepare(`
    SELECT public_id, url, content_type, COALESCE(views_verified, views_reported) AS views, final_robux
    FROM submissions
    WHERE creator_id = ? AND status IN ('approved','paid')
    ORDER BY views DESC LIMIT 1
  `).get(creatorId) || null;

  const approved = s.approved || 0;
  return {
    submissions_total: s.total || 0,
    submissions_approved: approved,
    submissions_rejected: s.rejected || 0,
    submissions_in_review: s.in_review || 0,
    total_views: s.total_views || 0,
    earned_robux: s.earned || 0,
    avg_views: approved ? Math.round((s.total_views || 0) / approved) : 0,
    approval_rate: s.total ? Math.round((approved / s.total) * 100) : 0,
    best_video: best
  };
}

/** Serie mensual de views y ganancias, para el grafico principal. */
function timeseries(creatorId, range = '6m') {
  const since = rangeToSince(range);
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month,
           COALESCE(SUM(COALESCE(views_verified, views_reported)), 0) AS views,
           COALESCE(SUM(final_robux), 0) AS earnings,
           COUNT(*) AS submissions
    FROM submissions
    WHERE creator_id = ? AND status IN ('approved','paid') AND created_at >= ?
    GROUP BY month ORDER BY month ASC
  `).all(creatorId, since);

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  let buckets;
  if (String(range).toLowerCase() === 'all') {
    buckets = rows.length ? rows.map((r) => r.month) : monthBuckets('6m');
  } else {
    buckets = monthBuckets(range);
  }
  return buckets.map((month) => {
    const r = byMonth.get(month);
    return {
      month,
      views: r ? r.views : 0,
      earnings: r ? r.earnings : 0,
      submissions: r ? r.submissions : 0
    };
  });
}

/** Uso del codigo de creador, agregado por semana o por mes. */
function codeUsage(creatorId, granularity = 'monthly') {
  const codeRow = db.prepare('SELECT code FROM creator_codes WHERE creator_id = ? AND active = 1 LIMIT 1').get(creatorId);
  const empty = { code: codeRow ? codeRow.code : null, totals: { clicks: 0, uses: 0, conversions: 0, revenue_robux: 0 }, series: [] };
  if (!codeRow) return empty;

  const totals = db.prepare(`
    SELECT
      SUM(CASE WHEN type = 'click'      THEN 1 ELSE 0 END) AS clicks,
      SUM(CASE WHEN type = 'use'        THEN 1 ELSE 0 END) AS uses,
      SUM(CASE WHEN type = 'conversion' THEN 1 ELSE 0 END) AS conversions,
      COALESCE(SUM(revenue_robux), 0)                      AS revenue
    FROM code_events WHERE code = ?
  `).get(codeRow.code);

  const fmt = granularity === 'weekly' ? '%Y-W%W' : '%Y-%m';
  const series = db.prepare(`
    SELECT strftime('${fmt}', occurred_at) AS bucket,
           SUM(CASE WHEN type = 'click'      THEN 1 ELSE 0 END) AS clicks,
           SUM(CASE WHEN type = 'use'        THEN 1 ELSE 0 END) AS uses,
           SUM(CASE WHEN type = 'conversion' THEN 1 ELSE 0 END) AS conversions,
           COALESCE(SUM(revenue_robux), 0) AS revenue
    FROM code_events
    WHERE code = ? AND occurred_at >= datetime('now', ?)
    GROUP BY bucket ORDER BY bucket ASC
  `).all(codeRow.code, granularity === 'weekly' ? '-84 days' : '-12 months');

  return {
    code: codeRow.code,
    totals: {
      clicks: totals.clicks || 0,
      uses: totals.uses || 0,
      conversions: totals.conversions || 0,
      revenue_robux: totals.revenue || 0,
      conversion_rate: totals.clicks ? Math.round(((totals.conversions || 0) / totals.clicks) * 100) : 0
    },
    series
  };
}

/** Historial de ganancias, una fila por envio aprobado o pagado. */
function earningsHistory(creatorId, { limit = 100, offset = 0 } = {}) {
  return db.prepare(`
    SELECT s.public_id, s.url, s.content_type, s.tier_key_at_submit AS tier_key,
           s.rate_at_submit AS rate, s.final_robux AS robux, s.status,
           COALESCE(s.views_verified, s.views_reported) AS views,
           COALESCE(s.reviewed_at, s.created_at) AS dated_at
    FROM submissions s
    WHERE s.creator_id = ? AND s.status IN ('approved','paid')
    ORDER BY dated_at DESC LIMIT ? OFFSET ?
  `).all(creatorId, limit, offset);
}

/** Actividad reciente: mezcla de envios, movimientos de balance y retiros. */
function recentActivity(creatorId, limit = 12) {
  const rows = db.prepare(`
    SELECT * FROM (
      SELECT 'submission' AS kind, public_id AS ref, status AS state,
             final_robux AS amount, created_at AS at, content_type AS extra
        FROM submissions WHERE creator_id = @cid
      UNION ALL
      SELECT 'submission_review', public_id, status, final_robux, reviewed_at, content_type
        FROM submissions WHERE creator_id = @cid AND reviewed_at IS NOT NULL
      UNION ALL
      SELECT 'withdrawal', public_id, status, amount_robux, created_at, method
        FROM withdrawals WHERE creator_id = @cid
      UNION ALL
      SELECT 'withdrawal_update', public_id, status, amount_robux, updated_at, method
        FROM withdrawals WHERE creator_id = @cid AND updated_at > created_at
    )
    WHERE at IS NOT NULL
    ORDER BY at DESC LIMIT @limit
  `).all({ cid: creatorId, limit });
  return rows;
}

module.exports = { performance, timeseries, codeUsage, earningsHistory, recentActivity };
