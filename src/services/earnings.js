'use strict';

const settings = require('./settings');
const tiers = require('./tiers');
const { evaluate } = require('../lib/formula');

/**
 * Calculo de ganancias. La formula y el redondeo son configurables
 * desde administracion (settings: earnings.formula, earnings.rounding).
 */
function round(value, mode) {
  switch (mode) {
    case 'round': return Math.round(value);
    case 'ceil': return Math.ceil(value);
    case 'floor':
    default: return Math.floor(value);
  }
}

/**
 * @param {object} tier   tier ya formateado (services/tiers)
 * @param {string} contentType
 * @param {number} views
 * @returns {{robux:number, rate:number, formula:string, breakdown:object}}
 */
function compute(tier, contentType, views) {
  const rate = tiers.rateFor(tier, contentType);
  const multiplier = tier ? Number(tier.multiplier || 1) : 1;
  const bonus = Number(settings.get('earnings.bonus', 0)) || 0;
  const formula = String(settings.get('earnings.formula'));
  const mode = String(settings.get('earnings.rounding', 'floor'));

  let raw = 0;
  try {
    raw = evaluate(formula, { views: Number(views) || 0, rate, multiplier, bonus });
  } catch {
    // Si la formula configurada es invalida se usa la de referencia,
    // para no bloquear el calculo de ganancias.
    raw = ((Number(views) || 0) / 1000) * rate * multiplier;
  }
  const robux = Math.max(0, round(raw + bonus, mode));

  return {
    robux,
    rate,
    multiplier,
    bonus,
    formula,
    breakdown: {
      views: Number(views) || 0,
      rate_per_1k: rate,
      multiplier,
      bonus,
      result: robux
    }
  };
}

/** Descripcion legible de la formula activa, para la seccion explicativa. */
function describe() {
  return {
    formula: String(settings.get('earnings.formula')),
    rounding: String(settings.get('earnings.rounding', 'floor')),
    bonus: Number(settings.get('earnings.bonus', 0)) || 0,
    variables: [
      { name: 'views', label: 'Views del video' },
      { name: 'rate', label: 'Tasa por 1.000 views de tu tier' },
      { name: 'multiplier', label: 'Multiplicador del tier' },
      { name: 'bonus', label: 'Bonus fijo por envio aprobado' }
    ]
  };
}

module.exports = { compute, describe };
