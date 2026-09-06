'use strict';

const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/** Devuelve una fecha ISO desplazada N meses hacia atras. */
function monthsAgo(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

/** Convierte "3m" | "6m" | "12m" | "all" en un limite inferior de fecha. */
function rangeToSince(range) {
  switch (String(range || '6m').toLowerCase()) {
    case '3m': return monthsAgo(3);
    case '12m': return monthsAgo(12);
    case 'all': return '1970-01-01 00:00:00';
    case '6m':
    default: return monthsAgo(6);
  }
}

/** Lista de meses (YYYY-MM) desde `since` hasta hoy, inclusive. */
function monthBuckets(range) {
  const map = { '3m': 3, '6m': 6, '12m': 12 };
  const count = map[String(range || '6m').toLowerCase()] || 12;
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

module.exports = { nowIso, monthsAgo, rangeToSince, monthBuckets };
