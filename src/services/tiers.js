'use strict';

const { db } = require('../db');

/**
 * Estructura de tiers. Los valores viven en la base de datos y los define
 * administracion; el frontend nunca los hardcodea.
 *
 * Los defaults sirven unicamente como punto de partida al inicializar
 * una instalacion nueva y son editables despues.
 */
const DEFAULT_TIERS = [
  { key: 'T5', name: 'Starter', rank: 1 },
  { key: 'T4', name: 'Creator', rank: 2 },
  { key: 'T3', name: 'Rising',  rank: 3 },
  { key: 'T2', name: 'Partner', rank: 4 },
  { key: 'T1', name: 'Elite',   rank: 5 }
];

const selectAll = db.prepare('SELECT * FROM tiers WHERE active = 1 ORDER BY rank ASC');
const selectByKey = db.prepare('SELECT * FROM tiers WHERE key = ?');
const selectById = db.prepare('SELECT * FROM tiers WHERE id = ?');
const selectNext = db.prepare('SELECT * FROM tiers WHERE active = 1 AND rank > ? ORDER BY rank ASC LIMIT 1');
const selectLowest = db.prepare('SELECT * FROM tiers WHERE active = 1 ORDER BY rank ASC LIMIT 1');

function shape(row) {
  if (!row) return null;
  let benefits = [];
  try { benefits = JSON.parse(row.benefits || '[]'); } catch { benefits = []; }
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    rank: row.rank,
    rates: {
      long_form: row.long_rate_per_1k,
      short_form: row.short_rate_per_1k,
      per: 1000
    },
    multiplier: row.multiplier,
    requirements: {
      min_subscribers: row.min_subscribers,
      min_avg_views: row.min_avg_views,
      note: row.requirements_note
    },
    benefits,
    // Marca los campos que administracion aun no ha configurado,
    // para que la interfaz muestre "por definir" en lugar de inventar cifras.
    configured: {
      rates: row.long_rate_per_1k > 0 || row.short_rate_per_1k > 0,
      requirements: row.min_subscribers !== null || row.min_avg_views !== null
    }
  };
}

const list = () => selectAll.all().map(shape);
const byKey = (key) => shape(selectByKey.get(key));
const byId = (id) => shape(selectById.get(id));
const next = (rank) => shape(selectNext.get(rank));
const lowest = () => shape(selectLowest.get());

/** Tasa por 1.000 views que corresponde a un tipo de contenido. */
function rateFor(tier, contentType) {
  if (!tier) return 0;
  return contentType === 'long_form' ? tier.rates.long_form : tier.rates.short_form;
}

/**
 * Progreso hacia el siguiente tier a partir de los requisitos configurados.
 * Devuelve null si administracion todavia no los ha definido.
 */
function progressTo(nextTier, stats) {
  if (!nextTier) return null;
  const req = nextTier.requirements;
  const parts = [];
  if (req.min_subscribers) {
    parts.push({
      label: 'Suscriptores',
      current: stats.subscribers || 0,
      target: req.min_subscribers,
      pct: Math.min(100, Math.round(((stats.subscribers || 0) / req.min_subscribers) * 100))
    });
  }
  if (req.min_avg_views) {
    parts.push({
      label: 'Media de views',
      current: stats.avg_views || 0,
      target: req.min_avg_views,
      pct: Math.min(100, Math.round(((stats.avg_views || 0) / req.min_avg_views) * 100))
    });
  }
  if (!parts.length) return null;
  // El requisito se cumple con cualquiera de las dos vias: gana la mas avanzada.
  const pct = Math.max(...parts.map((p) => p.pct));
  return { pct, parts, met: pct >= 100 };
}

module.exports = { DEFAULT_TIERS, list, byKey, byId, next, lowest, rateFor, progressTo, shape };
