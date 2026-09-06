/** Formateo de numeros, fechas y textos. */

const LOCALE = 'es-ES';

export const number = (n) => new Intl.NumberFormat(LOCALE).format(Math.round(Number(n) || 0));

/** Importe en Robux. `symbol:false` devuelve solo la cifra. */
export function robux(n, { symbol = true } = {}) {
  const value = number(n);
  return symbol ? `R$ ${value}` : value;
}

/** Abrevia cifras grandes: 12 400 -> 12,4 K */
export function compact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1).replace('.', ',').replace(',0', '')} B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',').replace(',0', '')} K`;
  return number(v);
}

/** El servidor devuelve "YYYY-MM-DD HH:MM:SS" en UTC. */
export function toDate(value) {
  if (!value) return null;
  const iso = String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function date(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function relative(value) {
  const d = toDate(value);
  if (!d) return '—';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return date(value);
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** "2026-09" -> "Sep 26"; "2026-W12" -> "S12" */
export function monthLabel(bucket) {
  const s = String(bucket);
  if (s.includes('-W')) return `S${s.split('-W')[1]}`;
  const [year, month] = s.split('-');
  if (!month) return s;
  return `${MONTHS[Number(month) - 1] || month} ${String(year).slice(2)}`;
}

/** Acorta una URL para mostrarla en tablas. */
export function shortUrl(url, max = 42) {
  try {
    const u = new URL(url);
    const text = `${u.hostname.replace(/^www\./, '')}${u.pathname}`;
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  } catch {
    return String(url || '').slice(0, max);
  }
}

export const percent = (n) => `${Math.round(Number(n) || 0)} %`;

export const platformLabel = (p) => ({
  youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', other: 'Otra'
}[p] || p);
