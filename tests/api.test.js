'use strict';

/**
 * Pruebas de la API.
 *
 * Arrancan el servidor sobre una base de datos temporal y comprueban
 * autenticacion, permisos, validacion, el modelo de balance y —sobre todo—
 * que los unicos metodos de retiro posibles son Robux e items de MM2.
 *
 *   node tests/api.test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');

// Base de datos aislada por ejecucion.
const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mm2t-')), 'test.sqlite');
process.env.DATABASE_FILE = tmpDb;
process.env.SESSION_SECRET = 'test-secret-not-for-production';
process.env.NODE_ENV = 'test';
process.env.SEED_DEMO = 'false';
// Las pruebas crean muchas cuentas desde la misma IP: se eleva solo ese
// limite. El limitador de retiros por usuario se mantiene en su valor real
// y tiene su propia prueba.
process.env.RATE_LIMIT_REGISTER_MAX = '500';

const app = require('../server');
const { db } = require('../src/db');
const settings = require('../src/services/settings');
const balanceService = require('../src/services/balance');
const submissionsService = require('../src/services/submissions');

let server;
let base;
let cookie = '';

const req = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let payload = null;
  try { payload = await res.json(); } catch { /* respuesta sin cuerpo */ }
  return { status: res.status, body: payload };
};

/** Crea e inicia sesion con un creador nuevo. El limitador de peticiones
 *  es por usuario, asi que cada bloque de pruebas usa el suyo. */
let seq = 0;
async function newCreator() {
  seq += 1;
  cookie = '';
  const res = await req('POST', '/api/auth/register', {
    email: `c${seq}-${Date.now()}@mm2trades.gg`,
    username: `creator_${seq}_${Date.now().toString(36)}`,
    password: 'segura1234'
  });
  assert.equal(res.status, 201);
  return res.body.data;
}

/** Acredita saldo al creador de la sesion actual, via servicio (como el staff). */
function grant(amountRobux) {
  const creator = db.prepare('SELECT * FROM creators ORDER BY id DESC LIMIT 1').get();
  balanceService.credit(creator.id, amountRobux, { memo: 'saldo de prueba' });
  return creator;
}

before(async () => {
  settings.ensureDefaults();
  // El servidor ya siembra los tiers al arrancar. Las pruebas fijan las
  // tasas de T5 de forma explicita para no depender de esos valores por
  // defecto: si administracion los cambia, las cuentas de aqui siguen
  // siendo deterministas.
  db.prepare(`
    INSERT OR IGNORE INTO tiers (key, name, rank, long_rate_per_1k, short_rate_per_1k, multiplier, benefits)
    VALUES ('T5', 'Starter', 1, 400, 200, 1, '[]')
  `).run();
  db.prepare(`
    UPDATE tiers SET long_rate_per_1k = 400, short_rate_per_1k = 200, multiplier = 1
    WHERE key = 'T5'
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO mm2_items (slug, name, rarity, category, value_robux, stock)
    VALUES ('test-godly', 'Test Godly', 'godly', 'knife', 5000, 2)
  `).run();

  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { if (server) server.close(); });

/* ------------------------------ Sesion ----------------------------- */

test('el dashboard exige sesion iniciada', async () => {
  const res = await req('GET', '/api/me/dashboard');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'unauthorized');
});

test('el alta rechaza contrasenas debiles', async () => {
  const res = await req('POST', '/api/auth/register', {
    email: 'weak@mm2trades.gg', username: 'weakuser', password: 'abcdefgh'
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'password_weak');
});

test('el alta crea creador, codigo y balance a cero', async () => {
  const res = await req('POST', '/api/auth/register', {
    email: 'creator@mm2trades.gg', username: 'creator1', password: 'segura1234'
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.data.code, 'debe generar un codigo de creador');
  assert.equal(res.body.data.balance.available, 0);
  assert.equal(res.body.data.balance.total_earned, 0);
});

test('no se puede repetir el correo', async () => {
  const res = await req('POST', '/api/auth/register', {
    email: 'creator@mm2trades.gg', username: 'otro', password: 'segura1234'
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'email_taken');
});

test('la contrasena incorrecta no inicia sesion', async () => {
  const saved = cookie;
  cookie = '';
  const res = await req('POST', '/api/auth/login', {
    identifier: 'creator@mm2trades.gg', password: 'incorrecta123'
  });
  assert.equal(res.status, 401);
  cookie = saved;
});

/* ---------------------------- Envios ------------------------------- */

test('rechaza enlaces de plataformas no admitidas', async () => {
  const res = await req('POST', '/api/submissions', {
    url: 'https://vimeo.com/12345', content_type: 'long_form', views: 1000
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'url_platform_unsupported');
});

test('rechaza un tipo de contenido que no encaja con el enlace', async () => {
  const res = await req('POST', '/api/submissions', {
    url: 'https://www.youtube.com/watch?v=abc123', content_type: 'tiktok', views: 1000
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'platform_mismatch');
});

test('crea el envio en revision sin acreditar saldo todavia', async () => {
  const res = await req('POST', '/api/submissions', {
    url: 'https://www.youtube.com/watch?v=video-uno', content_type: 'long_form', views: 20000
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'in_review');
  assert.equal(res.body.data.estimated_robux, 8000); // 20.000 / 1000 * 400

  const bal = await req('GET', '/api/me/balance');
  assert.equal(bal.body.data.available, 0, 'un envio sin aprobar no genera saldo');
  assert.equal(bal.body.data.pending, 8000);
});

test('el mismo video no se puede enviar dos veces', async () => {
  const res = await req('POST', '/api/submissions', {
    url: 'https://youtube.com/watch?v=video-uno', content_type: 'long_form', views: 20000
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'submission_duplicate');
});

/* ---------------------------- Balance ------------------------------ */

test('aprobar acredita saldo y el libro mayor cuadra', async () => {
  const creator = db.prepare('SELECT * FROM creators ORDER BY id DESC LIMIT 1').get();
  const submission = db.prepare('SELECT * FROM submissions WHERE creator_id = ?').get(creator.id);
  submissionsService.approve(submission.id, { verifiedViews: 30000 });

  const bal = await req('GET', '/api/me/balance');
  assert.equal(bal.body.data.available, 12000); // 30.000 / 1000 * 400
  assert.equal(bal.body.data.total_earned, 12000);

  const integrity = balanceService.verifyIntegrity(creator.id);
  assert.equal(integrity.ok, true, 'el balance debe cuadrar con los asientos');
});

/* ---------------------------- Retiros ------------------------------ */

test('SOLO existen dos metodos de retiro: robux y mm2_item', async () => {
  const meta = await req('GET', '/api/withdrawals/meta');
  const keys = meta.body.data.methods.map((m) => m.key).sort();
  assert.deepEqual(keys, ['mm2_item', 'robux']);

  const program = await req('GET', '/api/program');
  assert.deepEqual([...program.body.data.withdrawal.methods].sort(), ['mm2_item', 'robux']);
});

test('rechaza cualquier otro metodo de pago', async () => {
  await newCreator();
  for (const method of ['paypal', 'crypto', 'gift_card', 'bank_transfer']) {
    const res = await req('POST', '/api/withdrawals', { method, amount_robux: 1000 });
    assert.equal(res.status, 400, `${method} deberia rechazarse`);
    assert.equal(res.body.error.code, 'field_invalid');
  }
});

test('rechaza el resto de metodos prohibidos', async () => {
  await newCreator();
  for (const method of ['cash', 'store_credit', 'card', 'transfer']) {
    const res = await req('POST', '/api/withdrawals', { method, amount_robux: 1000 });
    assert.equal(res.status, 400, `${method} deberia rechazarse`);
  }
});

test('la configuracion no admite habilitar otros metodos', () => {
  assert.throws(() => settings.set('withdrawal.methods', ['robux', 'paypal']));
  // Aunque se fuerce el valor en la tabla, el servicio lo filtra.
  db.prepare(`UPDATE settings SET value = ? WHERE key = 'withdrawal.methods'`)
    .run(JSON.stringify(['robux', 'paypal', 'crypto']));
  assert.deepEqual(settings.withdrawalMethods(), ['robux']);
  settings.set('withdrawal.methods', ['robux', 'mm2_item']);
});

test('la base de datos impide guardar un retiro con otro metodo', () => {
  const creator = db.prepare('SELECT * FROM creators ORDER BY id DESC LIMIT 1').get();
  assert.throws(() => {
    db.prepare(`
      INSERT INTO withdrawals (public_id, creator_id, method, amount_robux, roblox_username)
      VALUES ('WD-BAD', ?, 'paypal', 100, 'alguien')
    `).run(creator.id);
  }, /CHECK constraint failed/);
});

test('rechaza credenciales sensibles de Roblox', async () => {
  await newCreator();
  const res = await req('POST', '/api/withdrawals', {
    method: 'robux', amount_robux: 1000, roblox_username: 'alguien', '.ROBLOSECURITY': 'token'
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'sensitive_field_rejected');
});

test('no permite retirar mas saldo del disponible', async () => {
  await newCreator();
  grant(10000);
  const res = await req('POST', '/api/withdrawals', {
    method: 'robux', amount_robux: 11000, roblox_username: 'CreatorUno'
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'insufficient_balance');
});

test('respeta el retiro minimo configurado', async () => {
  await newCreator();
  grant(10000);
  const res = await req('POST', '/api/withdrawals', {
    method: 'robux', amount_robux: 10, roblox_username: 'CreatorUno'
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'amount_below_min');
});

test('el retiro en Robux retiene saldo sin marcarlo como retirado', async () => {
  await newCreator();
  grant(12000);
  const res = await req('POST', '/api/withdrawals', {
    method: 'robux', amount_robux: 2000, roblox_username: 'CreatorUno', roblox_user_id: '12345'
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.withdrawal.method, 'robux');
  assert.equal(res.body.data.balance.available, 10000);
  assert.equal(res.body.data.balance.locked, 2000);
  assert.equal(res.body.data.balance.withdrawn, 0);
});

test('el precio de un item lo fija el catalogo, no el cliente', async () => {
  await newCreator();
  grant(12000);
  const item = db.prepare(`SELECT * FROM mm2_items WHERE slug = 'test-godly'`).get();
  const res = await req('POST', '/api/withdrawals', {
    method: 'mm2_item', item_id: item.id, amount_robux: 1, roblox_username: 'CreatorUno'
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.withdrawal.amount_robux, 5000, 'debe usar el valor del catalogo');
  assert.equal(res.body.data.balance.available, 7000);

  const stock = db.prepare('SELECT stock FROM mm2_items WHERE id = ?').get(item.id);
  assert.equal(stock.stock, 1, 'el stock se reserva al solicitar el retiro');
});

test('cancelar un retiro devuelve el saldo y repone el stock', async () => {
  const w = db.prepare(`SELECT * FROM withdrawals WHERE method = 'mm2_item' ORDER BY id DESC LIMIT 1`).get();
  const res = await req('POST', `/api/withdrawals/${w.id}/cancel`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.withdrawal.status, 'cancelled');
  assert.equal(res.body.data.balance.available, 12000);

  const stock = db.prepare('SELECT stock FROM mm2_items WHERE id = ?').get(w.item_id);
  assert.equal(stock.stock, 2, 'el stock vuelve al catalogo');
});

test('un creador no puede ver ni tocar los retiros de otro', async () => {
  const target = db.prepare('SELECT id FROM withdrawals ORDER BY id ASC LIMIT 1').get();
  await newCreator();
  const res = await req('GET', `/api/withdrawals/${target.id}`);
  assert.equal(res.status, 404, 'no debe filtrar retiros ajenos');
  const cancelRes = await req('POST', `/api/withdrawals/${target.id}/cancel`);
  assert.equal(cancelRes.status, 404, 'no debe poder cancelar retiros ajenos');
});

test('el limitador corta una rafaga de solicitudes de retiro', async () => {
  await newCreator();
  grant(50000);
  let limited = false;
  for (let i = 0; i < 12; i += 1) {
    const res = await req('POST', '/api/withdrawals', {
      method: 'robux', amount_robux: 600, roblox_username: 'CreatorUno'
    });
    if (res.status === 429) { limited = true; break; }
  }
  assert.equal(limited, true, 'debe devolver 429 al superar el limite');
});

/* ---------------------------- Configuracion ------------------------ */

test('la formula de ganancias es configurable y se valida', () => {
  assert.throws(() => settings.set('earnings.formula', 'process.exit(1)'));
  assert.throws(() => settings.set('earnings.formula', '(views / 0)'));
  settings.set('earnings.formula', '(views / 1000) * rate * 2');
  const tier = require('../src/services/tiers').byKey('T5');
  const calc = require('../src/services/earnings').compute(tier, 'long_form', 10000);
  assert.equal(calc.robux, 8000); // 10 * 400 * 2
  settings.set('earnings.formula', '(views / 1000) * rate * multiplier');
});

test('el creador no puede modificar su tier ni su balance desde la API', async () => {
  const before = await req('GET', '/api/me');
  const res = await req('PATCH', '/api/me', {
    display_name: 'Nuevo Nombre', tier_id: 99, balance: { available: 999999 }, code: 'HACKED'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.display_name, 'Nuevo Nombre');
  assert.equal(res.body.data.code, before.body.data.code, 'el codigo no cambia');
  assert.deepEqual(res.body.data.balance, before.body.data.balance, 'el balance no cambia');
});

test('la verificacion de Roblox nunca pide credenciales', async () => {
  const res = await req('GET', '/api/roblox-verification');
  assert.equal(res.status, 200);
  const list = res.body.data.never_asked.join(' ').toLowerCase();
  assert.ok(list.includes('contrasena'));
  assert.ok(list.includes('roblosecurity'));

  const bad = await req('POST', '/api/roblox-verification', {
    roblox_username: 'Alguien', roblox_password: 'secreta'
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'sensitive_field_rejected');
});
