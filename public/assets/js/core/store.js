/** Estado compartido de la aplicacion con suscripcion simple. */

const listeners = new Set();

export const store = {
  profile: null,
  program: null,
  notifications: { items: [], unread: 0 },
  ready: false
};

export function setState(patch) {
  Object.assign(store, patch);
  listeners.forEach((fn) => fn(store));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
