'use strict';

/**
 * Inicializa una instalacion: aplica el esquema, crea la estructura de tiers,
 * el catalogo de recompensas MM2 y (opcionalmente) un creador de demostracion
 * con datos de ejemplo para poder recorrer el dashboard.
 *
 * Es idempotente: se puede ejecutar varias veces sin duplicar nada.
 */

const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { db, migrate } = require('../src/db');
const settings = require('../src/services/settings');
const tiersService = require('../src/services/tiers');
const balance = require('../src/services/balance');
const notifications = require('../src/services/notifications');
const creatorsService = require('../src/services/creators');
const { hashPassword } = require('../src/lib/crypto');
const ITEMS = require('../src/db/items');
const { itemSvg } = require('./lib/svg-items');

migrate();
settings.ensureDefaults();

/* ------------------------------------------------------------------ *
 * Tiers
 *
 * Valores de partida. Administracion los edita; el frontend siempre los
 * lee de la API y nunca mantiene copia propia.
 * ------------------------------------------------------------------ */
const TIER_SEED = [
  {
    key: 'T5', name: 'Starter', rank: 1, long: 375, short: 188, multiplier: 1,
    subs: 1000, views: 5000,
    benefits: ['Codigo de creador propio', 'Retiros en Robux e items MM2', 'Soporte por ticket']
  },
  {
    key: 'T4', name: 'Creator', rank: 2, long: 500, short: 250, multiplier: 1,
    subs: 10000, views: 15000,
    benefits: ['Todo lo de Starter', 'Revision prioritaria de envios', 'Recursos de marca descargables']
  },
  {
    key: 'T3', name: 'Rising', rank: 3, long: 750, short: 375, multiplier: 1,
    subs: 25000, views: 30000,
    benefits: ['Todo lo de Creator', 'Acceso anticipado a sorteos', 'Item exclusivo por temporada']
  },
  {
    key: 'T2', name: 'Partner', rank: 4, long: 1000, short: 500, multiplier: 1,
    subs: 50000, views: 50000,
    benefits: ['Todo lo de Rising', 'Campanas pagadas a medida', 'Contacto directo con el equipo']
  },
  {
    key: 'T1', name: 'Elite', rank: 5, long: 1250, short: 625, multiplier: 1,
    subs: 100000, views: 100000,
    benefits: ['Todo lo de Partner', 'Retiros con prioridad maxima', 'Colaboraciones destacadas en la plataforma']
  }
];

const upsertTier = db.prepare(`
  INSERT INTO tiers (key, name, rank, long_rate_per_1k, short_rate_per_1k, multiplier,
                     min_subscribers, min_avg_views, benefits, requirements_note)
  VALUES (@key, @name, @rank, @long, @short, @multiplier, @subs, @views, @benefits, @note)
  ON CONFLICT(key) DO NOTHING
`);
db.transaction(() => {
  for (const t of TIER_SEED) {
    upsertTier.run({
      ...t,
      benefits: JSON.stringify(t.benefits),
      note: 'Cumples el requisito con suscriptores O con media de views, lo que te favorezca.'
    });
  }
})();

/* ------------------------------------------------------------------ *
 * Catalogo de recompensas MM2 + sus ilustraciones
 * ------------------------------------------------------------------ */
const imgDir = path.join(config.ROOT, 'public', 'assets', 'img', 'items');
fs.mkdirSync(imgDir, { recursive: true });

const upsertItem = db.prepare(`
  INSERT INTO mm2_items (slug, name, rarity, category, value_robux, image_url, accent, stock)
  VALUES (@slug, @name, @rarity, @category, @value_robux, @image_url, @accent, @stock)
  ON CONFLICT(slug) DO UPDATE SET image_url = excluded.image_url
`);
db.transaction(() => {
  for (const item of ITEMS) {
    const file = `${item.slug}.svg`;
    fs.writeFileSync(path.join(imgDir, file), itemSvg(item));
    upsertItem.run({ ...item, image_url: `/assets/img/items/${file}` });
  }
})();

console.log(`[seed] ${TIER_SEED.length} tiers y ${ITEMS.length} recompensas MM2 listas.`);

/* ------------------------------------------------------------------ *
 * Creador de demostracion
 * ------------------------------------------------------------------ */
if (!config.seedDemo) {
  console.log('[seed] SEED_DEMO desactivado: no se crean datos de ejemplo.');
  process.exit(0);
}

const DEMO_EMAIL = 'demo@mm2trades.gg';
const DEMO_PASSWORD = 'mm2trades2026';

if (db.prepare('SELECT 1 AS x FROM users WHERE email = ?').get(DEMO_EMAIL)) {
  console.log('[seed] El creador de demostracion ya existe. Nada que hacer.');
  process.exit(0);
}

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

db.transaction(() => {
  const userId = db.prepare(`
    INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, 'creator')
  `).run(DEMO_EMAIL, 'Facux', hashPassword(DEMO_PASSWORD)).lastInsertRowid;

  const t4 = tiersService.byKey('T4');
  const creatorId = db.prepare(`
    INSERT INTO creators (user_id, display_name, tier_id, roblox_username, roblox_user_id,
                          roblox_verified, contact_discord, country, subscribers, avg_views, joined_at)
    VALUES (?, 'Facux', ?, 'Facuw2000', '1554823901', 1, 'facux', 'CL', 18400, 21500, ?)
  `).run(userId, t4 ? t4.id : null, daysAgo(240)).lastInsertRowid;

  balance.ensure(creatorId);
  const code = creatorsService.ensureCode(creatorsService.byId(creatorId));

  // --- Envios repartidos en los ultimos 8 meses -------------------------
  const contentTypes = ['long_form', 'short_form', 'tiktok', 'youtube_short', 'instagram_reel'];
  const platformOf = { long_form: 'youtube', short_form: 'youtube', youtube_short: 'youtube', tiktok: 'tiktok', instagram_reel: 'instagram' };
  const insertSub = db.prepare(`
    INSERT INTO submissions (public_id, creator_id, url, url_key, platform, content_type,
      views_reported, views_verified, status, staff_note, tier_key_at_submit, rate_at_submit,
      estimated_robux, final_robux, created_at, reviewed_at)
    VALUES (@public_id, @creator_id, @url, @url_key, @platform, @content_type,
      @views, @views_verified, @status, @note, @tier_key, @rate, @estimated, @final, @created_at, @reviewed_at)
  `);

  let seq = 0;
  let totalEarned = 0;
  for (let month = 7; month >= 0; month -= 1) {
    const perMonth = rnd(2, 5);
    for (let i = 0; i < perMonth; i += 1) {
      seq += 1;
      const contentType = pick(contentTypes);
      const isLong = contentType === 'long_form';
      const views = isLong ? rnd(4000, 42000) : rnd(9000, 180000);
      const createdAt = daysAgo(month * 30 + rnd(1, 27));
      const isRecent = month === 0 && i >= perMonth - 1;
      const rolled = Math.random();
      const status = isRecent ? 'in_review' : (rolled < 0.12 ? 'rejected' : 'approved');
      const rate = t4 ? (isLong ? t4.rates.long_form : t4.rates.short_form) : 0;
      const amount = Math.floor((views / 1000) * rate);
      const publicId = `SB-${String(seq).padStart(5, '0')}`;
      const slug = `${contentType}-${month}-${i}-${rnd(1000, 9999)}`;
      const platform = platformOf[contentType];
      const url = {
        youtube: contentType === 'long_form'
          ? `https://www.youtube.com/watch?v=${slug}`
          : `https://www.youtube.com/shorts/${slug}`,
        tiktok: `https://www.tiktok.com/@facux/video/${slug}`,
        instagram: `https://www.instagram.com/reel/${slug}/`
      }[platform];

      insertSub.run({
        public_id: publicId,
        creator_id: creatorId,
        url,
        url_key: `${platform}:${slug}`,
        platform,
        content_type: contentType,
        views,
        views_verified: status === 'approved' ? views : null,
        status,
        note: status === 'rejected' ? 'El codigo no aparece en la descripcion del video.' : null,
        tier_key: t4 ? t4.key : null,
        rate,
        estimated: amount,
        final: status === 'approved' ? amount : 0,
        created_at: createdAt,
        reviewed_at: status === 'in_review' ? null : createdAt
      });

      if (status === 'approved' && amount > 0) {
        const subId = db.prepare('SELECT id FROM submissions WHERE public_id = ?').get(publicId).id;
        balance.credit(creatorId, amount, { refType: 'submission', refId: subId, memo: `Ganancia de ${publicId}` });
        totalEarned += amount;
      }
    }
  }

  // --- Uso del codigo ---------------------------------------------------
  const insertEvent = db.prepare(`
    INSERT INTO code_events (code, type, revenue_robux, source, occurred_at) VALUES (?, ?, ?, ?, ?)
  `);
  for (let d = 120; d >= 0; d -= 1) {
    const clicks = rnd(0, 14);
    for (let i = 0; i < clicks; i += 1) insertEvent.run(code, 'click', 0, pick(['youtube', 'tiktok', 'discord']), daysAgo(d));
    const uses = rnd(0, Math.max(1, Math.floor(clicks / 3)));
    for (let i = 0; i < uses; i += 1) insertEvent.run(code, 'use', 0, 'store', daysAgo(d));
    const conversions = rnd(0, Math.max(0, uses));
    for (let i = 0; i < conversions; i += 1) insertEvent.run(code, 'conversion', rnd(400, 6500), 'store', daysAgo(d));
  }

  // --- Retiros ya resueltos --------------------------------------------
  const bal = balance.get(creatorId);
  const firstAmount = Math.min(9000, Math.floor(bal.available * 0.25 / 100) * 100);
  if (firstAmount >= 500) {
    const wid = db.prepare(`
      INSERT INTO withdrawals (public_id, creator_id, method, amount_robux, roblox_username,
        roblox_user_id, status, created_at, updated_at, completed_at)
      VALUES ('WD-00001', ?, 'robux', ?, 'Facuw2000', '1554823901', 'completed', ?, ?, ?)
    `).run(creatorId, firstAmount, daysAgo(46), daysAgo(44), daysAgo(44)).lastInsertRowid;
    balance.hold(creatorId, firstAmount, { refId: wid, memo: 'Retiro WD-00001' });
    balance.settle(creatorId, firstAmount, { refId: wid, memo: 'Pago WD-00001' });
  }

  const item = db.prepare(`SELECT * FROM mm2_items WHERE rarity = 'legendary' ORDER BY value_robux ASC LIMIT 1`).get();
  const bal2 = balance.get(creatorId);
  if (item && bal2.available > item.value_robux) {
    const wid = db.prepare(`
      INSERT INTO withdrawals (public_id, creator_id, method, amount_robux, roblox_username,
        roblox_user_id, item_id, item_snapshot, status, created_at, updated_at)
      VALUES ('WD-00002', ?, 'mm2_item', ?, 'Facuw2000', '1554823901', ?, ?, 'processing', ?, ?)
    `).run(creatorId, item.value_robux, item.id, JSON.stringify({
      id: item.id, slug: item.slug, name: item.name, rarity: item.rarity,
      value_robux: item.value_robux, image_url: item.image_url
    }), daysAgo(3), daysAgo(2)).lastInsertRowid;
    balance.hold(creatorId, item.value_robux, { refId: wid, memo: 'Retiro WD-00002' });
    db.prepare('UPDATE mm2_items SET stock = stock - 1 WHERE id = ?').run(item.id);
  }

  // --- Notificaciones ---------------------------------------------------
  notifications.push(creatorId, { type: 'success', icon: 'check', title: 'Tu video fue aprobado', body: 'SB-00021 sumo ganancias a tu balance.', link: '/history' });
  notifications.push(creatorId, { type: 'info', icon: 'clock', title: 'Retiro en proceso', body: 'WD-00002 ya lo esta gestionando el staff.', link: '/history' });
  notifications.push(creatorId, { type: 'warning', icon: 'trending', title: 'Estas cerca del siguiente tier', body: 'Te faltan pocas views de media para cumplir los requisitos de T3.', link: '/sponsors' });

  console.log(`[seed] Creador de demostracion listo. Codigo: ${code} · Total generado: ${totalEarned} R$`);
})();

console.log('----------------------------------------------------------');
console.log(' Acceso de demostracion');
console.log(`   Correo:      ${DEMO_EMAIL}`);
console.log(`   Contrasena:  ${DEMO_PASSWORD}`);
console.log('----------------------------------------------------------');
