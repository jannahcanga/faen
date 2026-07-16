// watchlist.js
// The ONLY file in this app allowed to touch localStorage.
// Everything else (app.js) must go through these functions so that later we
// can swap localStorage for a server sync without touching any UI code.

const OLD_STORAGE_KEY = "gl-hub:watchlist";
const STORAGE_KEY = "faen:watchlist";

// One-time migration: move saved shows from the old key to the new one.
(function migrate() {
  try {
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      localStorage.setItem(STORAGE_KEY, old);
      localStorage.removeItem(OLD_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — nothing to migrate.
  }
})();

function readIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    // Corrupt or blocked storage (private mode, quota, bad JSON) -> empty list.
    return [];
  }
}

function writeIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable (e.g. private browsing) — fail silently, v0 has no backend anyway.
  }
}

/** Array of saved show ids. */
export function getSaved() {
  return readIds();
}

/** Whether a given show id is saved. */
export function isSaved(id) {
  return readIds().includes(id);
}

/** Save a show id (no-op if already saved). */
export function add(id) {
  const ids = readIds();
  if (!ids.includes(id)) {
    ids.push(id);
    writeIds(ids);
  }
}

/** Remove a show id (no-op if not saved). */
export function remove(id) {
  writeIds(readIds().filter((existing) => existing !== id));
}

/** Flip saved state for a show id. Returns the new saved state (true/false). */
export function toggle(id) {
  if (isSaved(id)) {
    remove(id);
    return false;
  }
  add(id);
  return true;
}
