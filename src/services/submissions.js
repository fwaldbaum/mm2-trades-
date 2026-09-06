'use strict';

const { db } = require('../db');
const balance = require('./balance');
const tiers = require('./tiers');
const earnings = require('./earnings');
const settings = require('./settings');
const notifications = require('./notifications');
const audit = require('../lib/audit');
const { conflict, badRequest, notFound } = require('../lib/errors');

const CONTENT_TYPES = ['long_form', 'short_form', 'tiktok', 'youtube_short', 'instagram_reel'];
const LONG_FORM_TYPES = ['long_form'];

const CONTENT_LABELS = {
  long_form: 'Formato largo',
  short_form: 'Formato corto',
  tiktok: 'TikTok',
  youtube_short: 'YouTube Short',
  instagram_reel: 'Instagram Reel'
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  in_review: 'En revision',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  paid: 'Pagado'
};

/** El tipo de contenido determina si cobra tasa de formato largo o corto. */
const rateBucket = (contentType) => (LONG_FORM_TYPES.includes(contentType) ? 'long_form' : 'short_form');

function nextPublicId() {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM submissions').get();
  return `SB-${String(row.n).padStart(5, '0')}`;
}

function shape(row) {
  if (!row) return null;
  return {
    id: row.id,
    public_id: row.public_id,
    url: row.url,
    platform: row.platform,
    content_type: row.content_type,
    content_label: CONTENT_LABELS[row.content_type] || row.content_type,
    views: row.views_verified !== null ? row.views_verified : row.views_reported,
    views_reported: row.views_reported,
    views_verified: row.views_verified,
    status: row.status,
    status_label: STATUS_LABELS[row.status] || row.status,
    staff_note: row.staff_note,
    tier_key: row.tier_key_at_submit,
    rate_per_1k: row.rate_at_submit,
    estimated_robux: row.estimated_robux,
    final_robux: row.final_robux,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
    paid_at: row.paid_at
  };
}

const selectById = db.prepare('SELECT * FROM submissions WHERE id = ? AND creator_id = ?');
const selectByUrlKey = db.prepare('SELECT id, creator_id, public_id FROM submissions WHERE url_key = ?');
const countToday = db.prepare(`
  SELECT COUNT(*) AS n FROM submissions
  WHERE creator_id = ? AND date(created_at) = date('now')
`);

/**
 * Crea un envio en estado "in_review".
 * Las views que manda el creador son solo una estimacion declarada: el staff
 * verifica el numero real y ese es el que se paga.
 */
function create(creator, { url, urlKey, platform, contentType, views }) {
  if (!CONTENT_TYPES.includes(contentType)) {
    throw badRequest('content_type_invalid', 'Tipo de contenido no valido.');
  }

  const maxPerDay = Number(settings.get('submission.max_per_day', 5));
  if (maxPerDay > 0 && countToday.get(creator.id).n >= maxPerDay) {
    throw conflict('submission_daily_limit',
      `Has alcanzado el limite de ${maxPerDay} envios por dia. Vuelve a intentarlo manana.`);
  }

  const duplicate = selectByUrlKey.get(urlKey);
  if (duplicate) {
    throw conflict('submission_duplicate',
      duplicate.creator_id === creator.id
        ? `Ya enviaste este video (${duplicate.public_id}). Cada video se puede enviar una sola vez.`
        : 'Este video ya fue registrado en el programa.');
  }

  const tier = creator.tier_id ? tiers.byId(creator.tier_id) : tiers.lowest();
  const calc = earnings.compute(tier, rateBucket(contentType), views || 0);
  const publicId = nextPublicId();

  const info = db.prepare(`
    INSERT INTO submissions
      (public_id, creator_id, url, url_key, platform, content_type, views_reported,
       status, tier_key_at_submit, rate_at_submit, estimated_robux)
    VALUES
      (@public_id, @creator_id, @url, @url_key, @platform, @content_type, @views,
       'in_review', @tier_key, @rate, @estimated)
  `).run({
    public_id: publicId,
    creator_id: creator.id,
    url,
    url_key: urlKey,
    platform,
    content_type: contentType,
    views: views || 0,
    tier_key: tier ? tier.key : null,
    rate: calc.rate,
    estimated: calc.robux
  });

  notifications.push(creator.id, {
    type: 'info',
    icon: 'upload',
    title: 'Video enviado a revision',
    body: `${publicId} esta en cola. Te avisamos en cuanto el staff lo revise.`,
    link: '/dashboard'
  });
  audit.log({
    actorId: creator.user_id,
    action: 'submission.create',
    entity: 'submission',
    entityId: info.lastInsertRowid,
    meta: { url, platform, contentType, views }
  });

  return shape(db.prepare('SELECT * FROM submissions WHERE id = ?').get(info.lastInsertRowid));
}

function listForCreator(creatorId, { status = null, limit = 100, offset = 0 } = {}) {
  const params = [creatorId];
  let sql = 'SELECT * FROM submissions WHERE creator_id = ?';
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(sql).all(...params).map(shape);
}

function getForCreator(id, creatorId) {
  const row = selectById.get(id, creatorId);
  if (!row) throw notFound('Ese envio no existe o no es tuyo.');
  return shape(row);
}

/**
 * Aprueba un envio y acredita la ganancia. Uso de staff/administracion.
 * Se ejecuta en una transaccion junto al asiento contable.
 */
const approve = db.transaction((submissionId, { verifiedViews = null, note = null, actorId = null } = {}) => {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
  if (!row) throw notFound('Envio no encontrado.');
  if (!['pending', 'in_review'].includes(row.status)) {
    throw conflict('submission_not_reviewable', 'Ese envio ya fue resuelto.');
  }
  const creator = db.prepare('SELECT * FROM creators WHERE id = ?').get(row.creator_id);
  const tier = creator.tier_id ? tiers.byId(creator.tier_id) : tiers.lowest();
  const views = verifiedViews === null ? row.views_reported : verifiedViews;
  const calc = earnings.compute(tier, rateBucket(row.content_type), views);

  db.prepare(`
    UPDATE submissions
       SET status = 'approved', views_verified = @views, final_robux = @amount,
           rate_at_submit = @rate, staff_note = @note, reviewed_at = datetime('now')
     WHERE id = @id
  `).run({ id: submissionId, views, amount: calc.robux, rate: calc.rate, note });

  if (calc.robux > 0) {
    balance.credit(row.creator_id, calc.robux, {
      refType: 'submission', refId: submissionId, memo: `Ganancia de ${row.public_id}`
    });
  }
  notifications.push(row.creator_id, {
    type: 'success',
    icon: 'check',
    title: 'Tu video fue aprobado',
    body: `${row.public_id} sumo ${calc.robux.toLocaleString('es-ES')} R$ a tu balance.`,
    link: '/history'
  });
  audit.log({ actorId, action: 'submission.approve', entity: 'submission', entityId: submissionId, meta: { views, amount: calc.robux } });
  return shape(db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId));
});

const reject = db.transaction((submissionId, { note = null, actorId = null } = {}) => {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
  if (!row) throw notFound('Envio no encontrado.');
  if (!['pending', 'in_review'].includes(row.status)) {
    throw conflict('submission_not_reviewable', 'Ese envio ya fue resuelto.');
  }
  db.prepare(`
    UPDATE submissions SET status = 'rejected', staff_note = @note, reviewed_at = datetime('now')
    WHERE id = @id
  `).run({ id: submissionId, note });
  notifications.push(row.creator_id, {
    type: 'danger',
    icon: 'x',
    title: 'Tu video no paso la revision',
    body: note || `${row.public_id} no cumple las reglas del programa.`,
    link: '/dashboard'
  });
  audit.log({ actorId, action: 'submission.reject', entity: 'submission', entityId: submissionId, meta: { note } });
  return shape(db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId));
});

module.exports = {
  CONTENT_TYPES, CONTENT_LABELS, STATUS_LABELS,
  create, listForCreator, getForCreator, approve, reject, shape, rateBucket
};
