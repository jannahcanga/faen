// settings.js
// The ONLY file in this app allowed to touch localStorage for user preferences.
// One of only two files allowed to touch localStorage (the other is watchlist.js).
//
// API:
//   getSetting(key)          -> string | null
//   setSetting(key, value)   -> void
//   exportAllSettings()      -> plain object of all stored settings
//
// Supported keys:
//   "theme"  -> "light" | "dark" | "system"
//   "lang"   -> "en"
//   "tz"     -> IANA timezone string | "auto"

const PREFIX = "faen:setting:";

// One-time migration from the old bare key to the namespaced key.
(function migrate() {
  try {
    const old = localStorage.getItem("faen:theme");
    if (old) {
      localStorage.setItem(PREFIX + "theme", old);
      localStorage.removeItem("faen:theme");
    }
  } catch {
    // Storage unavailable — nothing to migrate.
  }
})();

/** Get a setting value by key. Returns null if not set or storage unavailable. */
export function getSetting(key) {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/** Persist a setting value by key. */
export function setSetting(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {}
}

// ---------------------------------------------------------------------------
// FUTURE LOGIN HOOK — exportAllSettings()
// When a user signs in for the first time, call this to read their local
// settings and upload them to the server. No auth logic lives here.
// ---------------------------------------------------------------------------

/** Returns a plain object of all stored settings for server upload on first sign-in. */
export function exportAllSettings() {
  return {
    theme: getSetting("theme"),
    lang:  getSetting("lang"),
    tz:    getSetting("tz"),
  };
}

// ---------------------------------------------------------------------------
// Legacy shims — keep existing callers of the old settings.js API working.
// ---------------------------------------------------------------------------

/** @deprecated Use getSetting("theme") */
export function getSavedTheme() {
  return getSetting("theme");
}

/** @deprecated Use setSetting("theme", theme) */
export function saveTheme(theme) {
  setSetting("theme", theme);
}
