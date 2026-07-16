// settings.js
// Isolated localStorage access for user preferences.
// One of only two files allowed to touch localStorage (the other is watchlist.js).

const THEME_KEY = "faen:theme";

/** Returns "light" | "dark" | null (null = follow system). */
export function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

/** Persist the user's explicit theme choice. */
export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}
