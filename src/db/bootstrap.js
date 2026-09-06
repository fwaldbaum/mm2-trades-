'use strict';

/**
 * Datos estructurales minimos para que el programa funcione: la escalera
 * de tiers y el catalogo de recompensas MM2.
 *
 * Se ejecuta al arrancar el servidor, no solo desde el script de sembrado,
 * para que un despliegue siga siendo valido aunque su comando de arranque
 * sea "node server.js" en vez de "npm run start:prod".
 *
 * Solo inserta lo que falta. Nunca pisa valores que administracion haya
 * cambiado: si una tabla ya tiene filas, no toca nada.
 */

const { db } = require('./index');
const ITEMS = require('./items');

// Punto de partida de una instalacion nueva. Editable despues desde
// administracion; estos numeros no vuelven a aplicarse.
const DEFAULT_TIERS = [
  { key: 'T5', name: 'Starter', rank: 1, long: 375,  short: 188, subs: 1000,   views: 5000,
    benefits: ['Codigo de creador propio', 'Retiros en Robux e items MM2', 'Soporte por ticket'] },
  { key: 'T4', name: 'Creator', rank: 2, long: 500,  short: 250, subs: 10000,  views: 15000,
    benefits: ['Todo lo de Starter', 'Revision prioritaria de envios', 'Recursos de marca descargables'] },
  { key: 'T3', name: 'Rising',  rank: 3, long: 750,  short: 375, subs: 25000,  views: 30000,
    benefits: ['Todo lo de Creator', 'Acceso anticipado a sorteos', 'Item exclusivo por temporada'] },
  { key: 'T2', name: 'Partner', rank: 4, long: 1000, short: 500, subs: 50000,  views: 50000,
    benefits: ['Todo lo de Rising', 'Campanas pagadas a medida', 'Contacto directo con el equipo'] },
  { key: 'T1', name: 'Elite',   rank: 5, long: 1250, short: 625, subs: 100000, views: 100000,
    benefits: ['Todo lo de Partner', 'Retiros con prioridad maxima', 'Colaboraciones destacadas en la plataforma'] }
];

const REQUIREMENTS_NOTE =
  'Cumples el requisito con suscriptores O con media de views, lo que te favorezca.';

const insertTier = db.prepare(`
  INSERT INTO tiers (key, name, rank, long_rate_per_1k, short_rate_per_1k, multiplier,
                     min_subscribers, min_avg_views, benefits, requirements_note)
  VALUES (@key, @name, @rank, @long, @short, 1, @subs, @views, @benefits, @note)
  ON CONFLICT(key) DO NOTHING
`);

const insertItem = db.prepare(`
  INSERT INTO mm2_items (slug, name, rarity, category, value_robux, image_url, accent, stock)
  VALUES (@slug, @name, @rarity, @category, @value_robux, @image_url, @accent, @stock)
  ON CONFLICT(slug) DO NOTHING
`);

/**
 * @returns {{tiers:number, items:number}} filas insertadas en esta llamada
 */
function ensureStructuralData() {
  const result = { tiers: 0, items: 0 };

  db.transaction(() => {
    for (const t of DEFAULT_TIERS) {
      const info = insertTier.run({
        ...t,
        benefits: JSON.stringify(t.benefits),
        note: REQUIREMENTS_NOTE
      });
      result.tiers += info.changes;
    }

    for (const item of ITEMS) {
      const info = insertItem.run({
        ...item,
        image_url: `/assets/img/items/${item.slug}.svg`
      });
      result.items += info.changes;
    }
  })();

  return result;
}

module.exports = { ensureStructuralData, DEFAULT_TIERS };
