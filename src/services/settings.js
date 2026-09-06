'use strict';

const { db } = require('../db');
const { validateExpression } = require('../lib/formula');

/**
 * Configuracion del programa. Todos estos valores los define
 * administracion; el creador solo los lee.
 */
const DEFAULTS = {
  'program.name': { value: 'MM2 Trades Creator Program', description: 'Nombre publico del programa' },
  'program.currency': { value: { code: 'ROBUX', symbol: 'R$', decimals: 0 }, description: 'Moneda interna del programa' },

  'earnings.formula': {
    value: '(views / 1000) * rate * multiplier',
    description: 'Formula de ganancias. Variables: views, rate, multiplier, bonus.'
  },
  'earnings.rounding': { value: 'floor', description: 'floor | round | ceil al convertir a Robux enteros' },
  'earnings.bonus': { value: 0, description: 'Bonus fijo en R$ aplicado por submission aprobada' },

  'submission.max_per_day': { value: 5, description: 'Maximo de envios por creador y dia' },
  'submission.window_days': {
    value: { short_form: 7, long_form: 30 },
    description: 'Plazo maximo, en dias, para enviar un video tras publicarlo'
  },
  'submission.rules': {
    value: [
      'El contenido debe ser publico en YouTube, TikTok o Instagram.',
      'El formato largo debe durar 3 minutos o mas.',
      'Debe mencionarse MM2 Trades de forma clara, hablada o en pantalla.',
      'Tu codigo de creador debe verse al menos 6 segundos seguidos y sin tapar.',
      'El codigo tiene que aparecer tambien en la descripcion del video.',
      'El video debe seguir publico despues del retiro.',
      'Cada video se puede enviar una sola vez.'
    ],
    description: 'Reglas mostradas al creador antes de enviar contenido'
  },

  'withdrawal.methods': {
    value: ['robux', 'mm2_item'],
    description: 'Metodos de retiro habilitados. Solo se admiten "robux" y "mm2_item".'
  },
  'withdrawal.min_robux': { value: 500, description: 'Retiro minimo en Robux' },
  'withdrawal.max_robux_per_request': { value: 100000, description: 'Maximo por solicitud' },
  'withdrawal.max_open_requests': { value: 2, description: 'Retiros abiertos simultaneos permitidos' },
  'withdrawal.cooldown_hours': { value: 0, description: 'Horas de espera entre solicitudes' },
  'withdrawal.requires_roblox_verification': {
    value: false,
    description: 'Exigir cuenta de Roblox verificada antes de retirar'
  },
  'withdrawal.processing_note': {
    value: 'Los retiros se revisan manualmente y suelen completarse en 24-72 horas.',
    description: 'Aviso mostrado en el formulario de retiro'
  },

  'tiers.upgrade_note': {
    value: 'Los tiers los asigna el staff segun tu rendimiento. Cuando cumplas los requisitos, abre un ticket para solicitar la subida.',
    description: 'Nota del panel de tier'
  },

  'legal.disclaimer': {
    value: 'MM2 Trades es un servicio comunitario independiente y no esta afiliado a Roblox Corporation.',
    description: 'Aviso legal del pie de pagina'
  }
};

const selectOne = db.prepare('SELECT value FROM settings WHERE key = ?');
const selectAll = db.prepare('SELECT key, value, description FROM settings');
const upsert = db.prepare(`
  INSERT INTO settings (key, value, description, updated_at)
  VALUES (@key, @value, @description, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
`);
const insertIfMissing = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)
`);

/** Inserta los valores por defecto que aun no existan. No pisa lo ya configurado. */
function ensureDefaults() {
  const run = db.transaction(() => {
    for (const [key, def] of Object.entries(DEFAULTS)) {
      insertIfMissing.run(key, JSON.stringify(def.value), def.description);
    }
  });
  run();
}

function get(key, fallback = undefined) {
  const row = selectOne.get(key);
  if (!row) {
    if (fallback !== undefined) return fallback;
    return DEFAULTS[key] ? DEFAULTS[key].value : undefined;
  }
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

function set(key, value) {
  if (key === 'earnings.formula') validateExpression(String(value));
  if (key === 'withdrawal.methods') {
    const allowed = ['robux', 'mm2_item'];
    const list = Array.isArray(value) ? value : [];
    if (!list.length || list.some((m) => !allowed.includes(m))) {
      throw new Error('Los unicos metodos de retiro admitidos son "robux" y "mm2_item".');
    }
  }
  upsert.run({
    key,
    value: JSON.stringify(value),
    description: DEFAULTS[key] ? DEFAULTS[key].description : null
  });
  return get(key);
}

function all() {
  const out = {};
  for (const row of selectAll.all()) {
    try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
  }
  return out;
}

/**
 * Metodos de retiro efectivos. Blindado: aunque alguien inserte otro valor
 * en la tabla settings, aqui se filtra a la lista permitida.
 */
const ALLOWED_WITHDRAWAL_METHODS = Object.freeze(['robux', 'mm2_item']);
function withdrawalMethods() {
  const configured = get('withdrawal.methods', ALLOWED_WITHDRAWAL_METHODS);
  const list = (Array.isArray(configured) ? configured : ALLOWED_WITHDRAWAL_METHODS)
    .filter((m) => ALLOWED_WITHDRAWAL_METHODS.includes(m));
  return list.length ? list : [...ALLOWED_WITHDRAWAL_METHODS];
}

module.exports = { DEFAULTS, ensureDefaults, get, set, all, withdrawalMethods, ALLOWED_WITHDRAWAL_METHODS };
