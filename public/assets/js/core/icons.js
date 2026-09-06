/** Iconografia propia en SVG (trazo, 1.7px, caja de 24). */

import { svg } from './dom.js';

const PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  sponsors:  '<path d="M12 2 9.6 8.2 3 9l4.8 4.5L6.5 20 12 16.8 17.5 20l-1.3-6.5L21 9l-6.6-.8z"/>',
  wallet:    '<path d="M3 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/><circle cx="16.5" cy="13.5" r="1.4"/>',
  history:   '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 7v5l3.5 2"/>',
  help:      '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 4"/><circle cx="12" cy="17.4" r=".9" fill="currentColor" stroke="none"/>',
  user:      '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.6 20a7.6 7.6 0 0 1 14.8 0"/>',
  bell:      '<path d="M18 8.5a6 6 0 1 0-12 0c0 5.2-2 6.5-2 6.5h16s-2-1.3-2-6.5"/><path d="M13.7 19a2 2 0 0 1-3.4 0"/>',
  logout:    '<path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/>',
  menu:      '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  close:     '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  check:     '<path d="m4.5 12.5 5 5 10-11"/>',
  x:         '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>',
  clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  upload:    '<path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  copy:      '<rect x="9" y="9" width="12" height="12" rx="2.4"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
  trending:  '<path d="m3 16 5.5-5.5 3.5 3.5L21 5"/><path d="M15 5h6v6"/>',
  eye:       '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  star:      '<path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8L6.7 20l1-6L3.4 9.9l6-.9z"/>',
  coins:     '<ellipse cx="12" cy="6.5" rx="7.5" ry="3.2"/><path d="M4.5 6.5v5c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2v-5"/><path d="M4.5 11.5v5c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2v-5"/>',
  knife:     '<path d="M14.5 3 20 8.5 9.5 20 4 14.5z"/><path d="m4 14.5 5.5 5.5"/>',
  chart:     '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
  info:      '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/>',
  shield:    '<path d="M12 3 4.5 6v6c0 4.6 3.2 7.9 7.5 9 4.3-1.1 7.5-4.4 7.5-9V6z"/><path d="m9 12 2.2 2.2L15.3 10"/>',
  undo:      '<path d="M3 9h11a5 5 0 0 1 0 10h-4"/><path d="m7 5-4 4 4 4"/>',
  external:  '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
  inbox:     '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M4.6 5.4 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-1.6-7.6A2 2 0 0 0 17.4 4H6.6a2 2 0 0 0-2 1.4z"/>',
  settings:  '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  gift:      '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18"/><path d="M12 9v11"/><path d="M12 9S10.5 4 8 4a2.5 2.5 0 0 0 0 5"/><path d="M12 9s1.5-5 4-5a2.5 2.5 0 0 1 0 5"/>',
  link:      '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.4 1.4"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.4-1.4"/>',
  lock:      '<rect x="4.5" y="10" width="15" height="10.5" rx="2.4"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  arrowRight:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  filter:    '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  plus:      '<path d="M12 5v14"/><path d="M5 12h14"/>'
};

export function icon(name, { size = 18, stroke = 1.7, cls = '' } = {}) {
  const path = PATHS[name] || PATHS.info;
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"
    fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round"
    stroke-linejoin="round" class="${cls}" aria-hidden="true">${path}</svg>`);
}

/** Marca de MM2 Trades: dos hojas cruzadas formando una flecha de intercambio. */
export function logoMark(size = 34) {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${Math.round(size * 0.6)}" height="${Math.round(size * 0.6)}"
    fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 11h16l-4-4"/>
    <path d="M26 21H10l4 4"/>
  </svg>`);
}
