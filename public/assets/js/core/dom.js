/**
 * Utilidades minimas de DOM.
 * `h` construye elementos sin plantillas de cadena, de modo que ningun
 * dato del servidor se interpreta nunca como HTML.
 */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'html') el.innerHTML = value;            // solo para SVG propio
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value') el.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'selected') el[key] = !!value;
    else el.setAttribute(key, value);
  }

  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

/** SVG a partir de una cadena controlada por la propia aplicacion. */
export function svg(markup) {
  const wrap = document.createElement('div');
  wrap.innerHTML = markup.trim();
  return wrap.firstElementChild;
}

/** Cierra un panel al hacer clic fuera o pulsar Escape. */
export function onDismiss(el, handler) {
  const onClick = (e) => { if (!el.contains(e.target)) handler(); };
  const onKey = (e) => { if (e.key === 'Escape') handler(); };
  setTimeout(() => {
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  }, 0);
  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
  };
}

/** Anima un numero desde 0 hasta su valor final. */
export function countUp(el, target, { duration = 900, format = (n) => String(n) } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !target) {
    el.textContent = format(target);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = format(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
