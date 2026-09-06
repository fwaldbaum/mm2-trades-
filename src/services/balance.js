'use strict';

const { db } = require('../db');

/**
 * Balance de un creador.
 *
 *   total_earned = available + locked + withdrawn
 *
 *   available : listo para retirar
 *   locked    : retenido por retiros en curso (pending/processing)
 *   withdrawn : ya pagado
 *
 * "pending" (ganancias estimadas de envios sin aprobar) se calcula aparte y
 * NO forma parte de total_earned: todavia no es dinero del creador.
 *
 * Ninguna de estas cifras se acepta desde el cliente. Se recalculan aqui.
 */

const selectBalance = db.prepare('SELECT * FROM creator_balances WHERE creator_id = ?');
const ensureRow = db.prepare('INSERT OR IGNORE INTO creator_balances (creator_id) VALUES (?)');
const insertLedger = db.prepare(`
  INSERT INTO ledger_entries (creator_id, type, amount, ref_type, ref_id, memo)
  VALUES (@creator_id, @type, @amount, @ref_type, @ref_id, @memo)
`);
const selectPendingEarnings = db.prepare(`
  SELECT COALESCE(SUM(estimated_robux), 0) AS total
  FROM submissions
  WHERE creator_id = ? AND status IN ('pending','in_review')
`);

function ensure(creatorId) {
  ensureRow.run(creatorId);
  return selectBalance.get(creatorId);
}

function get(creatorId) {
  const row = ensure(creatorId);
  const pending = selectPendingEarnings.get(creatorId).total;
  return {
    total_earned: row.total_earned,
    available: row.available,
    locked: row.locked,
    withdrawn: row.withdrawn,
    pending,
    updated_at: row.updated_at
  };
}

function applyDelta(creatorId, { total_earned = 0, available = 0, locked = 0, withdrawn = 0 }) {
  const row = ensure(creatorId);
  const next = {
    total_earned: row.total_earned + total_earned,
    available: row.available + available,
    locked: row.locked + locked,
    withdrawn: row.withdrawn + withdrawn
  };
  for (const [field, value] of Object.entries(next)) {
    if (value < 0) {
      const err = new Error(`El balance quedaria negativo en "${field}".`);
      err.code = 'balance_negative';
      throw err;
    }
  }
  db.prepare(`
    UPDATE creator_balances
       SET total_earned = @total_earned, available = @available,
           locked = @locked, withdrawn = @withdrawn,
           updated_at = datetime('now')
     WHERE creator_id = @creator_id
  `).run({ ...next, creator_id: creatorId });
  return next;
}

/** Acredita una ganancia aprobada. Debe llamarse dentro de una transaccion. */
function credit(creatorId, amount, { refType = null, refId = null, memo = null } = {}) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Importe de ganancia invalido.');
  applyDelta(creatorId, { total_earned: amount, available: amount });
  insertLedger.run({ creator_id: creatorId, type: 'earning', amount, ref_type: refType, ref_id: refId, memo });
}

/** Retiene fondos al solicitar un retiro. */
function hold(creatorId, amount, { refId = null, memo = null } = {}) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Importe de retiro invalido.');
  applyDelta(creatorId, { available: -amount, locked: amount });
  insertLedger.run({ creator_id: creatorId, type: 'withdrawal_hold', amount: -amount, ref_type: 'withdrawal', ref_id: refId, memo });
}

/** Confirma el pago de un retiro: lo retenido pasa a retirado. */
function settle(creatorId, amount, { refId = null, memo = null } = {}) {
  applyDelta(creatorId, { locked: -amount, withdrawn: amount });
  insertLedger.run({ creator_id: creatorId, type: 'withdrawal_settle', amount: 0, ref_type: 'withdrawal', ref_id: refId, memo });
}

/** Devuelve al saldo disponible un retiro rechazado o cancelado. */
function refund(creatorId, amount, { refId = null, memo = null } = {}) {
  applyDelta(creatorId, { locked: -amount, available: amount });
  insertLedger.run({ creator_id: creatorId, type: 'withdrawal_refund', amount, ref_type: 'withdrawal', ref_id: refId, memo });
}

/** Comprobacion de integridad: el libro mayor debe cuadrar con el balance. */
function verifyIntegrity(creatorId) {
  const b = ensure(creatorId);
  const earned = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries
    WHERE creator_id = ? AND type = 'earning'
  `).get(creatorId).total;
  return {
    ok: earned === b.total_earned && b.total_earned === b.available + b.locked + b.withdrawn,
    ledger_earned: earned,
    balance: b
  };
}

module.exports = { get, ensure, credit, hold, settle, refund, verifyIntegrity };
