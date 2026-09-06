'use strict';

const { db } = require('../db');
const balance = require('./balance');
const settings = require('./settings');
const notifications = require('./notifications');
const audit = require('../lib/audit');
const { conflict, badRequest, notFound, forbidden } = require('../lib/errors');

/**
 * RETIROS.
 *
 * Regla absoluta del programa: los unicos metodos son ROBUX y ITEMS DE MM2.
 * No existe ni existira PayPal, cripto, gift cards, transferencia, tarjeta,
 * dinero real ni saldo de tienda. La lista se valida aqui, en settings y en
 * el CHECK de la tabla withdrawals.
 */
const METHODS = Object.freeze(['robux', 'mm2_item']);

const METHOD_LABELS = { robux: 'Robux', mm2_item: 'Item MM2' };
const STATUS_LABELS = {
  pending: 'Pendiente',
  processing: 'En proceso',
  completed: 'Completado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado'
};
const OPEN_STATUSES = ['pending', 'processing'];

function nextPublicId() {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM withdrawals').get();
  return `WD-${String(row.n).padStart(5, '0')}`;
}

function shape(row) {
  if (!row) return null;
  let item = null;
  try { item = row.item_snapshot ? JSON.parse(row.item_snapshot) : null; } catch { item = null; }
  return {
    id: row.id,
    public_id: row.public_id,
    method: row.method,
    method_label: METHOD_LABELS[row.method] || row.method,
    amount_robux: row.amount_robux,
    roblox_username: row.roblox_username,
    roblox_user_id: row.roblox_user_id,
    item,
    status: row.status,
    status_label: STATUS_LABELS[row.status] || row.status,
    staff_note: row.staff_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at
  };
}

const countOpen = db.prepare(`
  SELECT COUNT(*) AS n FROM withdrawals
  WHERE creator_id = ? AND status IN ('pending','processing')
`);
const lastRequest = db.prepare(`
  SELECT created_at FROM withdrawals WHERE creator_id = ?
  ORDER BY created_at DESC LIMIT 1
`);

/**
 * Crea una solicitud de retiro.
 * Todo se revalida en servidor: importe, metodo, balance, limites, estado
 * de la cuenta y disponibilidad del item. Nada se acepta tal cual del cliente.
 */
const create = db.transaction((creator, input) => {
  // 1. Metodo permitido
  const method = String(input.method || '');
  if (!METHODS.includes(method)) {
    throw badRequest('method_not_allowed',
      'Metodo de retiro no permitido. Solo puedes retirar en Robux o en items de MM2.');
  }
  if (!settings.withdrawalMethods().includes(method)) {
    throw badRequest('method_disabled', 'Ese metodo de retiro esta desactivado ahora mismo.');
  }

  // 2. Estado de la cuenta
  if (creator.status !== 'active') {
    throw forbidden('Tu cuenta de creador no esta activa. Contacta con el staff.');
  }
  if (settings.get('withdrawal.requires_roblox_verification', false) && !creator.roblox_verified) {
    throw forbidden('Verifica tu cuenta de Roblox antes de solicitar un retiro.');
  }

  // 3. Limites de solicitudes abiertas y espera entre retiros
  const maxOpen = Number(settings.get('withdrawal.max_open_requests', 2));
  if (maxOpen > 0 && countOpen.get(creator.id).n >= maxOpen) {
    throw conflict('withdrawal_open_limit',
      `Ya tienes ${maxOpen} retiro(s) en curso. Espera a que se resuelvan antes de pedir otro.`);
  }
  const cooldown = Number(settings.get('withdrawal.cooldown_hours', 0));
  if (cooldown > 0) {
    const last = lastRequest.get(creator.id);
    if (last) {
      const elapsedH = (Date.now() - new Date(`${last.created_at}Z`).getTime()) / 36e5;
      if (elapsedH < cooldown) {
        throw conflict('withdrawal_cooldown',
          `Debes esperar ${Math.ceil(cooldown - elapsedH)} h antes de solicitar otro retiro.`);
      }
    }
  }

  // 4. Importe y datos propios de cada metodo
  const minRobux = Number(settings.get('withdrawal.min_robux', 0));
  const maxRobux = Number(settings.get('withdrawal.max_robux_per_request', 100000));

  let amount;
  let itemRow = null;
  let robloxUsername = null;
  let robloxUserId = null;

  if (method === 'robux') {
    amount = Number(input.amount_robux);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw badRequest('amount_invalid', 'Indica una cantidad de Robux valida.');
    }
    robloxUsername = input.roblox_username || creator.roblox_username;
    robloxUserId = input.roblox_user_id || creator.roblox_user_id || null;
    if (!robloxUsername) {
      throw badRequest('roblox_account_required',
        'Necesitamos tu usuario de Roblox para enviarte los Robux.');
    }
  } else {
    // mm2_item: el importe lo fija el catalogo, nunca el cliente.
    const itemId = Number(input.item_id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw badRequest('item_required', 'Selecciona un item de MM2.');
    }
    itemRow = db.prepare('SELECT * FROM mm2_items WHERE id = ?').get(itemId);
    if (!itemRow || !itemRow.active) throw notFound('Ese item no esta disponible.');
    if (itemRow.stock <= 0) {
      throw conflict('item_out_of_stock', `"${itemRow.name}" esta agotado ahora mismo.`);
    }
    amount = itemRow.value_robux;
    robloxUsername = input.roblox_username || creator.roblox_username;
    robloxUserId = input.roblox_user_id || creator.roblox_user_id || null;
    if (!robloxUsername) {
      throw badRequest('roblox_account_required',
        'Necesitamos tu usuario de Roblox para entregarte el item en el juego.');
    }
  }

  if (minRobux > 0 && amount < minRobux) {
    throw badRequest('amount_below_min',
      `El retiro minimo es de ${minRobux.toLocaleString('es-ES')} R$.`);
  }
  if (maxRobux > 0 && amount > maxRobux) {
    throw badRequest('amount_above_max',
      `El maximo por solicitud es de ${maxRobux.toLocaleString('es-ES')} R$.`);
  }

  // 5. Balance suficiente, leido de la base de datos
  const bal = balance.get(creator.id);
  if (amount > bal.available) {
    throw conflict('insufficient_balance',
      `No tienes saldo suficiente. Disponible: ${bal.available.toLocaleString('es-ES')} R$.`);
  }

  // 6. Alta + retencion de fondos
  const publicId = nextPublicId();
  const info = db.prepare(`
    INSERT INTO withdrawals
      (public_id, creator_id, method, amount_robux, roblox_username, roblox_user_id,
       item_id, item_snapshot, status)
    VALUES
      (@public_id, @creator_id, @method, @amount, @roblox_username, @roblox_user_id,
       @item_id, @item_snapshot, 'pending')
  `).run({
    public_id: publicId,
    creator_id: creator.id,
    method,
    amount,
    roblox_username: robloxUsername,
    roblox_user_id: robloxUserId,
    item_id: itemRow ? itemRow.id : null,
    item_snapshot: itemRow ? JSON.stringify({
      id: itemRow.id, slug: itemRow.slug, name: itemRow.name,
      rarity: itemRow.rarity, value_robux: itemRow.value_robux, image_url: itemRow.image_url
    }) : null
  });

  const withdrawalId = info.lastInsertRowid;
  balance.hold(creator.id, amount, { refId: withdrawalId, memo: `Retiro ${publicId}` });

  if (itemRow) {
    db.prepare('UPDATE mm2_items SET stock = stock - 1 WHERE id = ? AND stock > 0').run(itemRow.id);
  }

  notifications.push(creator.id, {
    type: 'info',
    icon: 'wallet',
    title: 'Retiro solicitado',
    body: `${publicId} por ${amount.toLocaleString('es-ES')} R$ esta en cola de procesamiento.`,
    link: '/history'
  });
  audit.log({
    actorId: creator.user_id, action: 'withdrawal.create', entity: 'withdrawal',
    entityId: withdrawalId, meta: { method, amount, item_id: itemRow ? itemRow.id : null }
  });

  return shape(db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId));
});

/** El creador puede cancelar su propio retiro mientras siga pendiente. */
const cancel = db.transaction((creator, withdrawalId) => {
  const row = db.prepare('SELECT * FROM withdrawals WHERE id = ? AND creator_id = ?')
    .get(withdrawalId, creator.id);
  if (!row) throw notFound('Ese retiro no existe o no es tuyo.');
  if (row.status !== 'pending') {
    throw conflict('withdrawal_not_cancellable',
      'Solo puedes cancelar un retiro mientras siga pendiente.');
  }
  db.prepare(`UPDATE withdrawals SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`)
    .run(withdrawalId);
  balance.refund(creator.id, row.amount_robux, { refId: withdrawalId, memo: `Cancelacion ${row.public_id}` });
  if (row.item_id) db.prepare('UPDATE mm2_items SET stock = stock + 1 WHERE id = ?').run(row.item_id);

  notifications.push(creator.id, {
    type: 'warning', icon: 'undo',
    title: 'Retiro cancelado',
    body: `${row.public_id} se cancelo y el saldo volvio a tu balance.`,
    link: '/history'
  });
  audit.log({ actorId: creator.user_id, action: 'withdrawal.cancel', entity: 'withdrawal', entityId: withdrawalId });
  return shape(db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId));
});

/** Cambio de estado por parte del staff. */
const setStatus = db.transaction((withdrawalId, status, { note = null, actorId = null } = {}) => {
  const row = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId);
  if (!row) throw notFound('Retiro no encontrado.');
  if (!Object.keys(STATUS_LABELS).includes(status)) {
    throw badRequest('status_invalid', 'Estado de retiro no valido.');
  }
  if (!OPEN_STATUSES.includes(row.status)) {
    throw conflict('withdrawal_closed', 'Ese retiro ya esta cerrado.');
  }

  if (status === 'completed') {
    balance.settle(row.creator_id, row.amount_robux, { refId: row.id, memo: `Pago ${row.public_id}` });
    db.prepare(`UPDATE withdrawals SET status='completed', staff_note=@note,
                updated_at=datetime('now'), completed_at=datetime('now') WHERE id=@id`)
      .run({ id: withdrawalId, note });
    notifications.push(row.creator_id, {
      type: 'success', icon: 'wallet',
      title: row.method === 'robux' ? 'Robux enviados' : 'Item MM2 entregado',
      body: `${row.public_id} se completo correctamente.`,
      link: '/history'
    });
  } else if (status === 'rejected' || status === 'cancelled') {
    balance.refund(row.creator_id, row.amount_robux, { refId: row.id, memo: `Devolucion ${row.public_id}` });
    if (row.item_id) db.prepare('UPDATE mm2_items SET stock = stock + 1 WHERE id = ?').run(row.item_id);
    db.prepare(`UPDATE withdrawals SET status=@status, staff_note=@note, updated_at=datetime('now') WHERE id=@id`)
      .run({ id: withdrawalId, status, note });
    notifications.push(row.creator_id, {
      type: 'danger', icon: 'x',
      title: 'Retiro rechazado',
      body: note || `${row.public_id} fue rechazado y el saldo volvio a tu balance.`,
      link: '/history'
    });
  } else {
    db.prepare(`UPDATE withdrawals SET status=@status, staff_note=@note, updated_at=datetime('now') WHERE id=@id`)
      .run({ id: withdrawalId, status, note });
    notifications.push(row.creator_id, {
      type: 'info', icon: 'clock',
      title: 'Retiro en proceso',
      body: `${row.public_id} ya lo esta gestionando el staff.`,
      link: '/history'
    });
  }

  audit.log({ actorId, action: `withdrawal.${status}`, entity: 'withdrawal', entityId: withdrawalId, meta: { note } });
  return shape(db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId));
});

function listForCreator(creatorId, { limit = 100, offset = 0 } = {}) {
  return db.prepare(`
    SELECT * FROM withdrawals WHERE creator_id = ?
    ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
  `).all(creatorId, limit, offset).map(shape);
}

function getForCreator(id, creatorId) {
  const row = db.prepare('SELECT * FROM withdrawals WHERE id = ? AND creator_id = ?').get(id, creatorId);
  if (!row) throw notFound('Ese retiro no existe o no es tuyo.');
  return shape(row);
}

module.exports = {
  METHODS, METHOD_LABELS, STATUS_LABELS,
  create, cancel, setStatus, listForCreator, getForCreator, shape
};
