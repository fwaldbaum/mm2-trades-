'use strict';

/**
 * Genera la ilustracion SVG de cada recompensa MM2.
 * Se guardan como archivos estaticos y la base de datos apunta a ellos,
 * asi el catalogo no depende de imagenes externas.
 */
function shade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * amount);
  const g = clamp(((n >> 8) & 255) * amount);
  const b = clamp((n & 255) * amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const KNIFE = `
    <path d="M96 34 L118 56 L74 132 L58 116 Z" fill="url(#blade)" stroke="url(#edge)" stroke-width="2"/>
    <path d="M96 34 L118 56 L104 70 L82 48 Z" fill="url(#edge)" opacity=".55"/>
    <path d="M58 116 L74 132 L60 150 L44 134 Z" fill="#1b2136" stroke="url(#edge)" stroke-width="2"/>
    <rect x="38" y="132" width="30" height="36" rx="9" transform="rotate(-45 53 150)" fill="#141a2c" stroke="url(#edge)" stroke-width="2"/>`;

const GUN = `
    <path d="M40 70 H132 a8 8 0 0 1 8 8 v18 a8 8 0 0 1 -8 8 H96 l-8 22 a10 10 0 0 1 -10 7 H62 a8 8 0 0 1 -8 -9 l6 -20 H40 a8 8 0 0 1 -8 -8 V78 a8 8 0 0 1 8 -8 z"
          fill="url(#blade)" stroke="url(#edge)" stroke-width="2"/>
    <rect x="52" y="80" width="62" height="8" rx="4" fill="url(#edge)" opacity=".6"/>
    <circle cx="126" cy="88" r="5" fill="#0b0f1a" opacity=".7"/>`;

function itemSvg({ accent = '#7c5cff', category = 'knife', rarity = 'common' }) {
  const light = shade(accent, 1.25);
  const dark = shade(accent, 0.45);
  const art = category === 'gun' ? GUN : KNIFE;
  const isTop = ['godly', 'ancient'].includes(rarity);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180" role="img">
  <defs>
    <linearGradient id="blade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="55%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".85"/>
      <stop offset="100%" stop-color="${light}" stop-opacity=".5"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="${isTop ? '.42' : '.26'}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="180" height="180" rx="20" fill="#0d1220"/>
  <circle cx="90" cy="86" r="74" fill="url(#glow)"/>
  <g transform="rotate(-8 90 90)">${art}</g>
</svg>`;
}

module.exports = { itemSvg, shade };
