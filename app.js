// app.js
// Faen — all routing + rendering lives here. Vanilla JS, ES modules, no build step.
//
// Data flows:
//   shows.js     -> read-only show/META data
//   watchlist.js -> the ONLY thing allowed to touch localStorage for watchlist
//   settings.js  -> the ONLY thing allowed to touch localStorage for preferences
//   analytics.js -> the ONLY thing allowed to log/send events

import { shows, META } from "./shows.js";
import { getSaved, isSaved, add as addSaved, remove as removeSaved, toggle as toggleSaved } from "./watchlist.js";
import { track } from "./analytics.js";
import { getSetting, setSetting, getSavedTheme, saveTheme } from "./settings.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR = { Monday:"Mon", Tuesday:"Tue", Wednesday:"Wed", Thursday:"Thu", Friday:"Fri", Saturday:"Sat", Sunday:"Sun" };
const STATUS_LABELS = { upcoming:"Upcoming", airing:"Airing", completed:"Completed", hiatus:"On hiatus" };
const SOCIAL_LABELS = { instagram:"IG", x:"X", tiktok:"TT" };

// ---------------------------------------------------------------------------
// DOM refs (all persistent — never re-queried)
// ---------------------------------------------------------------------------

const appEl          = document.getElementById("app");
const mainEl         = document.getElementById("main");
const topBarEl       = document.getElementById("top-bar");
const tabBarEl       = document.getElementById("tab-bar");
const toastContainer = document.getElementById("toastContainer");

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const scrollPositions = {};      // hash → scrollTop, for restoration on back
let   scopeOpen       = false;   // scope dropdown open state
let   undoTimer       = null;    // setTimeout handle for undo toast
let   pendingUndoId   = null;    // show id for pending undo

// Calendar state — persists across day-strip taps (scope + selected day)
const calState = {
  selectedDay: todayWeekdayName(),
  scope: "all",  // "all" | "saved"
};

// Shows/browse state — persists across navigations (filters survive a show detail visit)
const showsState = {
  query:   "",
  status:  "",
  tags:    [],
  country: "",
  year:    "",
};

// ---------------------------------------------------------------------------
// Theme management
// ---------------------------------------------------------------------------

function currentTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Minimalist line icons for the theme toggle — 1.5px stroke, inherits color
const ICON_SUN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
  <circle cx="12" cy="12" r="4.5"/>
  <line x1="12" y1="2"    x2="12" y2="4.5"/>
  <line x1="12" y1="19.5" x2="12" y2="22"/>
  <line x1="4.22" y1="4.22"   x2="5.93" y2="5.93"/>
  <line x1="18.07" y1="18.07" x2="19.78" y2="19.78"/>
  <line x1="2"    y1="12" x2="4.5" y2="12"/>
  <line x1="19.5" y1="12" x2="22"  y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.93" y2="18.07"/>
  <line x1="18.07" y1="5.93" x2="19.78" y2="4.22"/>
</svg>`;

const ICON_MOON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

// Heart icons — filled for saved, outline for unsaved. Size param in px.
function heartSVG(filled, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="${filled ? "currentColor" : "none"}" stroke="currentColor"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 21C12 21 3 14.5 3 8.5a5.5 5.5 0 0 1 9-4.243A5.5 5.5 0 0 1 21 8.5c0 6-9 12.5-9 12.5Z"/>
  </svg>`;
}

// Large line icons for empty states — 48px, inherits color (→ var(--text-dim) via CSS)
const ICON_EMPTY_CALENDAR = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="4" width="18" height="18" rx="3"/>
  <path d="M16 2v4M8 2v4M3 10h18"/>
  <circle cx="8" cy="15" r="0.5" fill="currentColor"/>
  <circle cx="12" cy="15" r="0.5" fill="currentColor"/>
  <circle cx="16" cy="15" r="0.5" fill="currentColor"/>
</svg>`;

const ICON_EMPTY_SEARCH = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
  <circle cx="11" cy="11" r="8"/>
  <path d="M21 21l-4.35-4.35"/>
</svg>`;

const ICON_EMPTY_HEART = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 21C12 21 3 14.5 3 8.5a5.5 5.5 0 0 1 9-4.243A5.5 5.5 0 0 1 21 8.5c0 6-9 12.5-9 12.5Z"/>
</svg>`;

// Person/account icon for the parked Account section
const ICON_ACCOUNT = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="8" r="4"/>
  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
</svg>`;

// Common IANA timezone list for the time zone picker.
// "auto" means "use the browser's detected zone" (the default).
const TIMEZONES = [
  { value: "auto",                  label: "Automatic (use my device)" },
  { value: "Asia/Bangkok",          label: "Bangkok (UTC+7)" },
  { value: "Asia/Singapore",        label: "Singapore (UTC+8)" },
  { value: "Asia/Kuala_Lumpur",     label: "Kuala Lumpur (UTC+8)" },
  { value: "Asia/Jakarta",          label: "Jakarta (UTC+7)" },
  { value: "Asia/Manila",           label: "Manila (UTC+8)" },
  { value: "Asia/Ho_Chi_Minh",      label: "Ho Chi Minh City (UTC+7)" },
  { value: "Asia/Tokyo",            label: "Tokyo (UTC+9)" },
  { value: "Asia/Seoul",            label: "Seoul (UTC+9)" },
  { value: "Asia/Shanghai",         label: "Shanghai (UTC+8)" },
  { value: "Asia/Taipei",           label: "Taipei (UTC+8)" },
  { value: "Asia/Hong_Kong",        label: "Hong Kong (UTC+8)" },
  { value: "Asia/Kolkata",          label: "India (UTC+5:30)" },
  { value: "Asia/Dubai",            label: "Dubai (UTC+4)" },
  { value: "Europe/London",         label: "London (GMT/BST)" },
  { value: "Europe/Paris",          label: "Paris/Berlin (CET/CEST)" },
  { value: "Europe/Moscow",         label: "Moscow (UTC+3)" },
  { value: "America/New_York",      label: "New York (ET)" },
  { value: "America/Chicago",       label: "Chicago (CT)" },
  { value: "America/Denver",        label: "Denver (MT)" },
  { value: "America/Los_Angeles",   label: "Los Angeles (PT)" },
  { value: "America/Sao_Paulo",     label: "São Paulo (BRT)" },
  { value: "Australia/Sydney",      label: "Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland",      label: "Auckland (NZST/NZDT)" },
];

function updateThemeToggle() {
  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    const dark = currentTheme() === "dark";
    btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
  });
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  setSetting("theme", next);
  track("change_setting", { key: "theme" });
  updateThemeToggle();
}

function initTheme() {
  const saved = getSetting("theme");
  if (saved === "light" || saved === "dark") {
    document.documentElement.dataset.theme = saved;
  } else {
    // "system" or null — remove explicit override so CSS media query takes effect
    delete document.documentElement.dataset.theme;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function groupBy(list, key) {
  return list.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});
}

function slugify(str) {
  return String(str).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function todayWeekdayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

// Returns array of { day, dateNum, isToday } for Mon-Sun of the current week
function getWeekDates() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun…6=Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  return DAYS.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      day,
      dateNum: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
    };
  });
}

// Bangkok is fixed UTC+7 (no DST). Convert "HH:MM" BKK → viewer's preferred timezone.
function bangkokToLocal(airTimeTH) {
  if (!airTimeTH) return "";
  const [h, m] = airTimeTH.split(":").map(Number);
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h - 7, m));
  const tzSetting = getSetting("tz");
  const opts = { hour: "2-digit", minute: "2-digit" };
  if (tzSetting && tzSetting !== "auto") {
    try {
      return utc.toLocaleTimeString(undefined, { ...opts, timeZone: tzSetting });
    } catch {
      // Invalid IANA string — fall through to device default.
    }
  }
  return utc.toLocaleTimeString(undefined, opts);
}

function statusBadge(status) {
  const cls = status === "completed" ? "badge--completed" : `badge--${status}`;
  return `<span class="badge ${cls}">${escapeHTML(STATUS_LABELS[status] || status)}</span>`;
}

function socialIconsHTML(socials = {}) {
  return Object.keys(SOCIAL_LABELS)
    .filter((k) => socials?.[k])
    .map((k) => `
      <a class="social-icon" href="${escapeHTML(socials[k])}" target="_blank" rel="noopener noreferrer"
         data-action="open-social" data-platform="${k}" aria-label="${SOCIAL_LABELS[k]} profile">
        ${SOCIAL_LABELS[k]}
      </a>`)
    .join("");
}

// ---------------------------------------------------------------------------
// Top bar — content changes per route; listeners delegated on topBarEl
// ---------------------------------------------------------------------------

topBarEl.addEventListener("click", (e) => {
  if (e.target.closest("#themeToggle")) { toggleTheme(); return; }
  if (e.target.closest("[data-action='go-back']")) { e.preventDefault(); history.back(); return; }
  if (e.target.closest("#scopeBtn")) { toggleScopeDropdown(); return; }
  if (e.target.closest("[data-action='set-scope']")) { handleSetScope(e); return; }
  // Close on outside click (handled in document listener)
});

function renderTopBar(route) {
  switch (route.view) {
    case "calendar": renderCalTopBar();             break;
    case "shows":    renderSimpleTopBar("Shows");   break;
    case "saved":    renderSimpleTopBar("Saved");   break;
    case "show": {
      const show = shows.find((s) => s.id === route.id);
      renderDetailTopBar(show ? show.title.en : "Show");
      break;
    }
    case "person":   renderDetailTopBar(route.slug.replace(/-/g, " ")); break;
    case "about":    renderDetailTopBar("About");   break;
    case "settings": renderSimpleTopBar("Settings"); break;
    default:         renderCalTopBar();
  }
  updateThemeToggle();
}

function renderCalTopBar() {
  topBarEl.innerHTML = `
    <div class="top-bar__inner">
      <button class="scope-trigger" id="scopeBtn"
              aria-haspopup="listbox" aria-expanded="${scopeOpen}">
        <span class="scope-trigger__label" id="scopeLabel">${getScopeLabel()}</span>
        <span class="scope-trigger__caret" aria-hidden="true">▾</span>
      </button>
      <button class="theme-toggle" id="themeToggle" type="button"></button>
    </div>
    <div class="scope-dropdown" id="scopeDropdown" role="listbox" ${scopeOpen ? "" : "hidden"}>
      <button class="scope-option ${calState.scope==="all"?"is-selected":""}" role="option"
              data-action="set-scope" data-scope="all">All shows</button>
      <button class="scope-option ${calState.scope==="saved"?"is-selected":""}" role="option"
              data-action="set-scope" data-scope="saved">Saved only</button>
    </div>
  `;
}

function renderSimpleTopBar(title) {
  topBarEl.innerHTML = `
    <div class="top-bar__inner">
      <span class="top-bar__title">${escapeHTML(title)}</span>
      <button class="theme-toggle" id="themeToggle" type="button"></button>
    </div>
  `;
}

function renderDetailTopBar(title) {
  topBarEl.innerHTML = `
    <div class="top-bar__inner">
      <button class="back-btn" type="button" data-action="go-back" aria-label="Go back">
        ← Back
      </button>
      <span class="top-bar__title" style="text-align:center">${escapeHTML(title)}</span>
      <button class="theme-toggle" id="themeToggle" type="button"></button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Scope dropdown
// ---------------------------------------------------------------------------

function getScopeLabel() {
  return calState.scope === "saved" ? "Saved only" : "All shows";
}

function toggleScopeDropdown() {
  scopeOpen = !scopeOpen;
  const dd  = document.getElementById("scopeDropdown");
  const btn = document.getElementById("scopeBtn");
  if (dd)  dd.hidden = !scopeOpen;
  if (btn) btn.setAttribute("aria-expanded", String(scopeOpen));
}

function closeScopeDropdown() {
  if (!scopeOpen) return;
  scopeOpen = false;
  const dd  = document.getElementById("scopeDropdown");
  const btn = document.getElementById("scopeBtn");
  if (dd)  dd.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function handleSetScope(e) {
  const scope = e.target.closest("[data-action='set-scope']")?.dataset.scope;
  if (!scope || scope === calState.scope) { closeScopeDropdown(); return; }
  calState.scope = scope;
  scopeOpen = false;
  track("calendar_scope", { scope });
  // Re-render top bar (updates label + closes dropdown) then refresh lineup
  renderCalTopBar();
  updateThemeToggle();
  const lineupEl = document.getElementById("calLineup");
  if (lineupEl) lineupEl.replaceWith(buildCalLineup());
}

// ---------------------------------------------------------------------------
// Tab bar active state
// ---------------------------------------------------------------------------

function updateTabActive(view) {
  const TAB_MAP = { calendar: "calendar", shows: "shows", saved: "saved", settings: "settings" };
  const active  = TAB_MAP[view] || "";
  tabBarEl.querySelectorAll(".tab-bar__item").forEach((a) => {
    const isActive = a.dataset.tab === active;
    a.classList.toggle("is-active", isActive);
    a.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

// ---------------------------------------------------------------------------
// Calendar view
// ---------------------------------------------------------------------------

function getDayShows(dayName) {
  let result = shows.filter(
    (s) => (s.status === "airing") && s.schedule?.airDay === dayName
  );
  if (calState.scope === "saved") {
    const saved = getSaved();
    result = result.filter((s) => saved.includes(s.id));
  }
  return result;
}

function nextAiringDay(fromDay) {
  const idx = DAYS.indexOf(fromDay);
  for (let i = 1; i <= 7; i++) {
    const candidate = DAYS[(idx + i) % 7];
    if (getDayShows(candidate).length > 0) return candidate;
  }
  return null;
}

function lineupCardHTML(show) {
  const saved     = isSaved(show.id);
  const timeTH    = show.schedule?.airTimeTH;
  const timeLocal = timeTH ? bangkokToLocal(timeTH) : null;
  return `
    <article class="lineup-card">
      <a class="lineup-card__link" href="#/show/${encodeURIComponent(show.id)}">
        <img class="lineup-card__poster"
             src="${escapeHTML(show.poster?.url || "")}"
             alt="${escapeHTML(show.title.en)} poster"
             width="80" height="112" loading="lazy" />
        <div class="lineup-card__body">
          <h3 class="lineup-card__title">${escapeHTML(show.title.en)}</h3>
          <p class="lineup-card__ship">${escapeHTML(show.ship)}</p>
          ${timeTH ? `
            <div class="lineup-card__times">
              <span><b>${escapeHTML(timeTH)} ICT</b></span>
              ${timeLocal ? `<span>${escapeHTML(timeLocal)} your time</span>` : ""}
            </div>` : ""}
          <div class="lineup-card__meta">
            ${statusBadge(show.status)}
            ${show.country ? `<span class="badge badge--done">${escapeHTML(show.country)}</span>` : ""}
          </div>
        </div>
      </a>
      <button class="lineup-card__save ${saved ? "is-saved" : ""}" type="button"
              data-action="toggle-save" data-show-id="${show.id}"
              aria-pressed="${saved}"
              aria-label="${saved ? "Remove from saved" : "Save show"}">
        ${heartSVG(saved)}
      </button>
    </article>`;
}

function buildCalLineup() {
  const dayShows = getDayShows(calState.selectedDay);
  const el       = document.createElement("div");
  el.id          = "calLineup";
  el.className   = "cal-content";

  if (dayShows.length) {
    el.innerHTML = `<div class="lineup-list">${dayShows.map(lineupCardHTML).join("")}</div>`;
    return el;
  }

  const next  = nextAiringDay(calState.selectedDay);
  const isToday = calState.selectedDay === todayWeekdayName();
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">${ICON_EMPTY_CALENDAR}</div>
      <p class="empty-state__title">Nothing airing ${isToday ? "today" : "this day"}</p>
      ${calState.scope === "saved"
        ? `<p class="empty-state__body">No saved shows air on ${escapeHTML(calState.selectedDay)}.</p>`
        : `<p class="empty-state__body">No shows are scheduled${next ? ` — but ${escapeHTML(next)} has something.` : " this week."}</p>`}
      ${next ? `
        <button class="btn" data-action="jump-day" data-day="${next}">
          Jump to ${escapeHTML(next)}
        </button>` : ""}
    </div>`;
  return el;
}

function renderCalendar() {
  renderCalTopBar();
  updateThemeToggle();

  const weekDates = getWeekDates();
  const today     = todayWeekdayName();

  const dayStripHTML = weekDates.map(({ day, dateNum, isToday }) => {
    const count      = getDayShows(day).length;
    const isSelected = day === calState.selectedDay;
    return `
      <button class="day-strip__btn${isSelected ? " is-active" : ""}${isToday ? " is-today" : ""}"
              type="button" role="tab" aria-selected="${isSelected}"
              data-action="select-day" data-day="${day}">
        <span class="day-strip__abbr">${DAY_ABBR[day]}</span>
        <span class="day-strip__date">${dateNum}</span>
        ${count > 0 && !isSelected ? `<span class="day-strip__dot" aria-hidden="true"></span>` : ""}
      </button>`;
  }).join("");

  const upcomingShows = shows
    .filter((s) => s.status === "upcoming")
    .filter((s) => calState.scope === "saved" ? getSaved().includes(s.id) : true)
    .sort((a, b) => (a.schedule?.premiereDate || "").localeCompare(b.schedule?.premiereDate || ""));

  const comingSoonHTML = upcomingShows.length ? `
    <section class="coming-soon">
      <p class="section-label">Coming soon</p>
      <div class="lineup-list">${upcomingShows.map(lineupCardHTML).join("")}</div>
    </section>` : "";

  appEl.innerHTML = `
    <div class="day-strip-wrap">
      <div class="day-strip" id="dayStrip" role="tablist" aria-label="Select day">
        ${dayStripHTML}
      </div>
    </div>
    <div id="calLineup" class="cal-content"></div>
    ${comingSoonHTML}
    <footer class="cal-footer">
      <a href="#/about">about faen · credits</a>
    </footer>
  `;

  // Replace placeholder with real lineup
  document.getElementById("calLineup").replaceWith(buildCalLineup());

  // Scroll active day button into view (centered, instant on first load)
  requestAnimationFrame(() => {
    const activeBtn = appEl.querySelector(".day-strip__btn.is-active");
    activeBtn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  });
}

// ---------------------------------------------------------------------------
// Shows view
// ---------------------------------------------------------------------------

function allTags() {
  return [...new Set(shows.flatMap((s) => s.tags || []))].sort();
}

function allCountries() {
  return [...new Set(shows.map((s) => s.country).filter(Boolean))].sort();
}

function allYears() {
  return [...new Set(shows.map((s) => s.year).filter(Boolean))].map(String).sort((a, b) => b - a);
}

function hasActiveFilters() {
  return showsState.status || showsState.tags.length || showsState.country || showsState.year;
}

function clearShowsFilters() {
  showsState.status  = "";
  showsState.tags    = [];
  showsState.country = "";
  showsState.year    = "";
}

function getFilteredShows() {
  const q = showsState.query.trim().toLowerCase();
  return shows.filter((s) => {
    if (showsState.status && s.status !== showsState.status) return false;
    if (showsState.country && s.country !== showsState.country) return false;
    if (showsState.year && String(s.year) !== showsState.year) return false;
    if (showsState.tags.length && !showsState.tags.every((t) => (s.tags || []).includes(t))) return false;
    if (q) {
      const hay = [s.title.en, s.title.th, s.title.romanized, s.ship].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function activePillsHTML() {
  const pills = [];
  if (showsState.status) {
    pills.push(`<span class="filter-pill">
      ${escapeHTML(STATUS_LABELS[showsState.status] || showsState.status)}
      <button class="filter-pill__remove" data-action="remove-filter" data-filter="status"
              aria-label="Remove status filter">×</button>
    </span>`);
  }
  showsState.tags.forEach((tag) => {
    pills.push(`<span class="filter-pill">
      ${escapeHTML(tag)}
      <button class="filter-pill__remove" data-action="remove-filter" data-filter="tag"
              data-value="${escapeHTML(tag)}" aria-label="Remove ${escapeHTML(tag)} filter">×</button>
    </span>`);
  });
  if (showsState.country) {
    pills.push(`<span class="filter-pill">
      ${escapeHTML(showsState.country)}
      <button class="filter-pill__remove" data-action="remove-filter" data-filter="country"
              aria-label="Remove country filter">×</button>
    </span>`);
  }
  if (showsState.year) {
    pills.push(`<span class="filter-pill">
      ${escapeHTML(showsState.year)}
      <button class="filter-pill__remove" data-action="remove-filter" data-filter="year"
              aria-label="Remove year filter">×</button>
    </span>`);
  }
  return pills.length ? `<div class="active-filters">${pills.join("")}</div>` : "";
}

function posterCardHTML(show) {
  const saved = isSaved(show.id);
  return `
    <div class="poster-card">
      <a class="poster-card__img-link" href="#/show/${encodeURIComponent(show.id)}"
         aria-label="${escapeHTML(show.title.en)}">
        <img class="poster-card__img"
             src="${escapeHTML(show.poster?.url || "")}"
             alt="${escapeHTML(show.title.en)} poster"
             loading="lazy" />
      </a>
      <div class="poster-card__info">
        <p class="poster-card__title">${escapeHTML(show.title.en)}</p>
        <p class="poster-card__ship">${escapeHTML(show.ship)}</p>
        ${statusBadge(show.status)}
      </div>
      <button class="poster-card__save ${saved ? "is-saved" : ""}" type="button"
              data-action="toggle-save" data-show-id="${show.id}"
              aria-pressed="${saved}"
              aria-label="${saved ? "Remove from saved" : "Save show"}">
        ${heartSVG(saved)}
      </button>
    </div>`;
}

function renderShows() {
  const tags      = allTags();
  const countries = allCountries();
  const years     = allYears();
  const results   = getFilteredShows();

  const chipsStatus = (
    ["airing", "upcoming", "completed", "hiatus"]
      .map((s) => `<button class="chip ${showsState.status===s?"chip--active":""}" type="button"
                           data-action="set-filter" data-filter="status" data-value="${s}">
                     ${STATUS_LABELS[s]}
                   </button>`)
      .join("")
  );

  const chipsTags = tags.map((t) => `
    <button class="chip ${showsState.tags.includes(t)?"chip--active":""}" type="button"
            data-action="set-filter" data-filter="tag" data-value="${escapeHTML(t)}">
      ${escapeHTML(t)}
    </button>`).join("");

  const chipsCountry = countries.map((c) => `
    <button class="chip ${showsState.country===c?"chip--active":""}" type="button"
            data-action="set-filter" data-filter="country" data-value="${escapeHTML(c)}">
      ${escapeHTML(c)}
    </button>`).join("");

  const chipsYear = years.map((y) => `
    <button class="chip ${showsState.year===y?"chip--active":""}" type="button"
            data-action="set-filter" data-filter="year" data-value="${escapeHTML(y)}">
      ${escapeHTML(y)}
    </button>`).join("");

  appEl.innerHTML = `
    <div class="shows-header">
      <div class="shows-search-bar">
        <span class="shows-search-bar__icon" aria-hidden="true">&#128269;</span>
        <label class="sr-only" for="showsSearch">Search shows</label>
        <input id="showsSearch" type="search" autocomplete="off" spellcheck="false"
               placeholder="Search title, romanized, or ship&hellip;"
               value="${escapeHTML(showsState.query)}" />
      </div>
      <div class="chip-row" role="group" aria-label="Filter by status">
        ${chipsStatus}
      </div>
      ${tags.length ? `
        <div class="chip-row" role="group" aria-label="Filter by genre">
          ${chipsTags}
        </div>` : ""}
      ${countries.length > 1 ? `
        <div class="chip-row" role="group" aria-label="Filter by country">
          ${chipsCountry}
        </div>` : ""}
      ${years.length > 1 ? `
        <div class="chip-row" role="group" aria-label="Filter by year">
          ${chipsYear}
        </div>` : ""}
      ${activePillsHTML()}
      <p class="result-count">${results.length} show${results.length !== 1 ? "s" : ""}</p>
    </div>
    <div class="poster-grid-wrap">
      ${results.length
        ? `<div class="poster-grid">${results.map(posterCardHTML).join("")}</div>`
        : `<div class="empty-state">
             <div class="empty-state__icon">${ICON_EMPTY_SEARCH}</div>
             <p class="empty-state__title">No shows found</p>
             <p class="empty-state__body">Try a different search or clear your filters.</p>
             ${hasActiveFilters() ? `<button class="btn btn--ghost" data-action="clear-filters">Clear filters</button>` : ""}
           </div>`}
    </div>
  `;

  // Search input — re-renders on input (restores focus + cursor position)
  const searchEl = document.getElementById("showsSearch");
  searchEl?.addEventListener("input", () => {
    showsState.query = searchEl.value;
    track("search", { resultCount: getFilteredShows().length });
    const pos = searchEl.selectionStart;
    renderShows();
    const newInput = document.getElementById("showsSearch");
    newInput?.focus();
    newInput?.setSelectionRange(pos, pos);
  });
}

// ---------------------------------------------------------------------------
// Saved view
// ---------------------------------------------------------------------------

function showCardHTML(show) {
  const saved   = isSaved(show.id);
  const timeTH  = show.schedule?.airTimeTH;
  const timeLoc = timeTH ? bangkokToLocal(timeTH) : null;
  return `
    <li class="card">
      <a class="card__link" href="#/show/${encodeURIComponent(show.id)}">
        <img class="card__poster"
             src="${escapeHTML(show.poster?.url || "")}"
             alt="${escapeHTML(show.title.en)} poster"
             width="72" height="96" loading="lazy" />
        <div class="card__body">
          <h3 class="card__title">${escapeHTML(show.title.en)}</h3>
          <p class="card__ship">${escapeHTML(show.ship)}</p>
          ${statusBadge(show.status)}
          ${timeTH ? `<p class="card__time">${escapeHTML(timeTH)} ICT${timeLoc ? ` · ${escapeHTML(timeLoc)} your time` : ""}</p>` : ""}
        </div>
      </a>
      <button class="card__save ${saved ? "is-saved" : ""}" type="button"
              data-action="toggle-save" data-show-id="${show.id}"
              aria-pressed="${saved}"
              aria-label="${saved ? "Remove from saved" : "Save show"}">
        ${heartSVG(saved)}
      </button>
    </li>`;
}

function renderSaved() {
  const savedIds   = getSaved();
  const savedShows = shows.filter((s) => savedIds.includes(s.id));

  if (!savedShows.length) {
    appEl.innerHTML = `
      <div class="main-content">
        <div class="empty-state">
          <div class="empty-state__icon">${ICON_EMPTY_HEART}</div>
          <p class="empty-state__title">No faves yet</p>
          <p class="empty-state__body">Go find your ship</p>
          <a class="btn" href="#/shows">Browse shows</a>
        </div>
      </div>`;
    return;
  }

  const groups = { airing: [], upcoming: [], completed: [], hiatus: [] };
  savedShows.forEach((s) => (groups[s.status] ||= []).push(s));

  const groupOrder = [
    { key: "airing",    label: "Airing now" },
    { key: "hiatus",    label: "On hiatus" },
    { key: "upcoming",  label: "Upcoming" },
    { key: "completed", label: "Completed" },
  ];

  const sectionsHTML = groupOrder
    .filter(({ key }) => groups[key]?.length)
    .map(({ key, label }) => `
      <h2 class="group-heading">${label}</h2>
      <ul class="card-list">${groups[key].map(showCardHTML).join("")}</ul>`)
    .join("");

  appEl.innerHTML = `<div class="main-content">${sectionsHTML}</div>`;
}

// ---------------------------------------------------------------------------
// Show detail view
// ---------------------------------------------------------------------------

function renderShowDetail(id) {
  const show = shows.find((s) => s.id === id);
  if (!show) {
    appEl.innerHTML = `<div class="main-content"><p class="empty-note">Show not found. <a href="#/">Go home</a></p></div>`;
    return;
  }

  track("open_show", { id });
  const saved = isSaved(show.id);

  // Episode progress
  const ep    = show.schedule;
  const epHTML = ep?.totalEpisodes
    ? `<div class="ep-progress">
         <p class="ep-progress__label">
           Episode ${ep.currentEpisode ?? 0} of ${ep.totalEpisodes}
           ${ep.premiereDate ? `· Premiered ${ep.premiereDate}` : ""}
           ${ep.finaleDate ? `· Finale ${ep.finaleDate}` : ""}
         </p>
         <div class="ep-progress__track">
           <div class="ep-progress__fill" style="width:${Math.round(((ep.currentEpisode ?? 0) / ep.totalEpisodes) * 100)}%"></div>
         </div>
       </div>` : "";

  // Air schedule
  const airHTML = (ep?.airDay || ep?.airTimeTH)
    ? `<section class="air-schedule">
         ${ep.airDay ? `<div class="air-schedule__row">
           <span class="air-schedule__label">Airs</span>
           <span class="air-schedule__value">${escapeHTML(ep.airDay)}s</span>
         </div>` : ""}
         ${ep.airTimeTH ? `<div class="air-schedule__row">
           <span class="air-schedule__label">Bangkok time</span>
           <span class="air-schedule__value">${escapeHTML(ep.airTimeTH)} ICT</span>
         </div>` : ""}
         ${ep.airTimeTH ? `<div class="air-schedule__row">
           <span class="air-schedule__label">Your time</span>
           <span class="air-schedule__value">${escapeHTML(bangkokToLocal(ep.airTimeTH))}</span>
         </div>` : ""}
       </section>` : "";

  // Where to watch
  const watchByRegion = groupBy(show.watch || [], "region");
  const watchHTML     = Object.entries(watchByRegion)
    .map(([region, entries]) => `
      <div class="watch-region">
        <h3 class="watch-region__title">${escapeHTML(region)}</h3>
        <ul class="watch-list">
          ${entries.map((w) => `
            <li>
              <a class="watch-btn" href="${escapeHTML(w.url)}" target="_blank" rel="noopener noreferrer"
                 data-action="open-watch" data-show-id="${show.id}"
                 data-platform="${escapeHTML(w.platform)}" data-region="${escapeHTML(region)}">
                <span class="watch-btn__platform">${escapeHTML(w.platform)}</span>
                ${w.free ? `<span class="badge badge--free">Free</span>` : ""}
                <span class="watch-btn__langs">${(w.languages || []).map(escapeHTML).join(", ")}</span>
              </a>
            </li>`).join("")}
        </ul>
      </div>`).join("");

  // Cast — tappable to person page (social icon clicks handled separately)
  const castHTML = (show.cast || []).map((member) => {
    const slug = slugify(member.name);
    return `
      <li class="cast-item" data-action="open-person" data-slug="${slug}" role="button" tabindex="0">
        <div style="flex:1;min-width:0">
          <span class="cast-item__name">${escapeHTML(member.name)}</span>
          <span class="cast-item__character"> as ${escapeHTML(member.character)}</span>
        </div>
        <span class="cast-item__socials" onclick="event.stopPropagation()">
          ${socialIconsHTML(member.socials)}
        </span>
      </li>`;
  }).join("");

  appEl.innerHTML = `
    <div class="main-content">
      <article>
        <div class="show-detail__head">
          <img class="show-detail__poster"
               src="${escapeHTML(show.poster?.url || "")}"
               alt="${escapeHTML(show.title.en)} poster"
               width="120" height="168" />
          <div style="min-width:0;flex:1">
            <h1 style="font-size:var(--text-xl);font-weight:700;letter-spacing:-0.02em;margin-bottom:4px">
              ${escapeHTML(show.title.en)}
            </h1>
            <p class="show-detail__native">
              ${escapeHTML(show.title.th)} · ${escapeHTML(show.title.romanized)}
            </p>
            <p class="show-detail__meta">
              ${escapeHTML(show.ship)} · ${show.year}
              ${show.country ? `· ${escapeHTML(show.country)}` : ""}
              ${statusBadge(show.status)}
            </p>
            <div class="show-detail__actions">
              <button class="btn ${saved ? "btn--active" : ""}" type="button"
                      data-action="toggle-save" data-show-id="${show.id}"
                      aria-pressed="${saved}">
                ${heartSVG(saved, 16)} ${saved ? "Saved" : "Save"}
              </button>
              ${show.trailerUrl
                ? `<a class="btn btn--ghost" href="${escapeHTML(show.trailerUrl)}"
                      target="_blank" rel="noopener noreferrer">Trailer</a>`
                : ""}
            </div>
          </div>
        </div>

        ${epHTML}
        ${show.synopsis ? `<p class="show-detail__synopsis">${escapeHTML(show.synopsis)}</p>` : ""}
        ${show.tags?.length
          ? `<ul class="tag-list">${show.tags.map((t) => `<li class="tag">${escapeHTML(t)}</li>`).join("")}</ul>`
          : ""}

        ${airHTML}

        ${show.watch?.length ? `<h2 class="section-heading">Where to watch</h2>${watchHTML}` : ""}

        ${show.cast?.length ? `
          <h2 class="section-heading">Cast</h2>
          <ul class="cast-list">${castHTML}</ul>` : ""}
      </article>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Person page
// ---------------------------------------------------------------------------

function renderPerson(slug) {
  // Scan all shows for any cast member whose slugified name matches
  const appearances = [];
  let personName    = "";
  let personBio     = "";
  let personSocials = {};

  for (const show of shows) {
    for (const member of show.cast || []) {
      if (slugify(member.name) === slug) {
        if (!personName) personName = member.name;
        if (!personBio  && member.bio) personBio = member.bio;
        if (!Object.values(personSocials).some(Boolean) && member.socials) {
          personSocials = member.socials;
        }
        appearances.push({ show, character: member.character });
      }
    }
  }

  if (!appearances.length) {
    appEl.innerHTML = `<div class="main-content"><p class="empty-note">Person not found.</p></div>`;
    return;
  }

  track("open_person", { slug });

  const socialsHTML = Object.values(personSocials).some(Boolean)
    ? `<div class="person-page__socials">${socialIconsHTML(personSocials)}</div>` : "";

  const appearsHTML = appearances.map(({ show, character }) => `
    <li>
      <a class="appears-item__link" href="#/show/${encodeURIComponent(show.id)}">
        <img class="appears-item__poster"
             src="${escapeHTML(show.poster?.url || "")}"
             alt="${escapeHTML(show.title.en)} poster"
             width="44" height="62" loading="lazy" />
        <div class="appears-item__body">
          <p class="appears-item__show">${escapeHTML(show.title.en)}</p>
          <p class="appears-item__char">as ${escapeHTML(character)}</p>
          ${statusBadge(show.status)}
        </div>
      </a>
    </li>`).join("");

  appEl.innerHTML = `
    <div class="main-content">
      <div class="person-page__header">
        <h1 class="person-page__name">${escapeHTML(personName)}</h1>
        ${personBio ? `<p class="person-page__bio">${escapeHTML(personBio)}</p>` : ""}
        ${socialsHTML}
      </div>
      <h2 class="section-heading">Appears in</h2>
      <ul class="appears-list">${appearsHTML}</ul>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// About page
// ---------------------------------------------------------------------------

function renderAbout() {
  appEl.innerHTML = `
    <div class="main-content">
      <div class="about-section">
        <p>${escapeHTML(META.attribution.tmdb)}</p>
        <p>
          Rights holders can reach me at:
          <a href="mailto:${escapeHTML(META.contactEmail)}">${escapeHTML(META.contactEmail)}</a>
        </p>
        <p>
          Faen is an independent fan project. It is not affiliated with or
          endorsed by any studio, network, or streaming platform. It never
          hosts or streams video — it only links to official sources.
        </p>
        ${META.lastUpdated
          ? `<p class="about-last-updated">Data last updated: ${escapeHTML(META.lastUpdated)}</p>`
          : ""}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

function renderSettings() {
  track("open_settings");

  const currentThemeVal = getSetting("theme") || "system";
  const currentTz       = getSetting("tz")    || "auto";
  const currentLang     = getSetting("lang")   || "en";

  const themePills = [
    { value: "light",  label: "Light" },
    { value: "dark",   label: "Dark" },
    { value: "system", label: "System" },
  ].map(({ value, label }) => `
    <button class="theme-pill${currentThemeVal === value ? " is-active" : ""}"
            data-action="change-theme" data-theme="${value}"
            aria-pressed="${currentThemeVal === value}">
      ${escapeHTML(label)}
    </button>`).join("");

  const tzOptions = TIMEZONES.map(({ value, label }) =>
    `<option value="${escapeHTML(value)}"${currentTz === value ? " selected" : ""}>${escapeHTML(label)}</option>`
  ).join("");

  appEl.innerHTML = `
    <div class="settings-screen">

      <!-- Appearance -->
      <section class="settings-section" aria-labelledby="section-appearance">
        <h2 class="settings-section__title" id="section-appearance">Appearance</h2>
        <div class="settings-card">
          <div class="settings-row settings-row--stack">
            <span class="settings-row__label">Theme</span>
            <div class="theme-picker" role="group" aria-label="Theme">
              ${themePills}
            </div>
          </div>
        </div>
      </section>

      <!-- Language -->
      <section class="settings-section" aria-labelledby="section-language">
        <h2 class="settings-section__title" id="section-language">Language</h2>
        <div class="settings-card">
          <div class="settings-row settings-row--stack">
            <span class="settings-row__label">App language</span>
            <select class="settings-select" data-action="change-lang" aria-label="App language">
              <option value="en" selected>English</option>
              <option value="__more" disabled>More coming soon…</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Time zone -->
      <section class="settings-section" aria-labelledby="section-tz">
        <h2 class="settings-section__title" id="section-tz">Time zone</h2>
        <div class="settings-card">
          <div class="settings-row settings-row--stack">
            <span class="settings-row__label">
              Air times
              <span class="settings-row__sub">Shows air in Bangkok time (UTC+7). Converted to your chosen zone.</span>
            </span>
            <select class="settings-select" data-action="change-tz" aria-label="Time zone">
              ${tzOptions}
            </select>
          </div>
        </div>
      </section>

      <!-- Account (parked) -->
      <section class="settings-section" aria-labelledby="section-account">
        <h2 class="settings-section__title" id="section-account">Account</h2>
        <div class="account-card" aria-describedby="account-desc">
          <div class="account-card__icon" aria-hidden="true">${ICON_ACCOUNT}</div>
          <p class="account-card__title">Coming soon</p>
          <p class="account-card__body" id="account-desc">
            Sign in to sync your saved shows and ratings across devices.
          </p>
          <button class="account-card__btn" disabled aria-disabled="true">Sign in</button>
        </div>
      </section>

      <!-- About -->
      <section class="settings-section" aria-labelledby="section-about">
        <h2 class="settings-section__title" id="section-about">About</h2>
        <div class="settings-card">
          <a class="settings-row settings-row--link" href="#/about">
            <span class="settings-row__label">About Faen</span>
            <span class="settings-row__chevron" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </span>
          </a>
          ${META.lastUpdated ? `
          <div class="settings-row settings-row--meta">
            <span class="settings-row__label" style="font-weight:400">Data last updated</span>
            <span class="settings-row__value">${escapeHTML(META.lastUpdated)}</span>
          </div>` : ""}
        </div>
      </section>

    </div>
  `;
}

// ---------------------------------------------------------------------------
// Toast — undo on un-heart from Saved tab
// ---------------------------------------------------------------------------

function showUndoToast(showId, showTitle) {
  clearTimeout(undoTimer);
  pendingUndoId = showId;
  toastContainer.innerHTML = `
    <div class="toast" role="status">
      <span>${escapeHTML(showTitle)} removed</span>
      <button class="toast__undo" data-action="undo-remove" data-show-id="${showId}">Undo</button>
    </div>`;
  undoTimer = setTimeout(hideToast, 4000);
}

function hideToast() {
  toastContainer.innerHTML = "";
  pendingUndoId = null;
}

// ---------------------------------------------------------------------------
// Delegated click handling
// ---------------------------------------------------------------------------

document.addEventListener("click", (e) => {
  // Close scope dropdown on outside click
  if (!e.target.closest(".scope-trigger") && !e.target.closest(".scope-dropdown")) {
    closeScopeDropdown();
  }

  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "toggle-save") {
    e.preventDefault();
    const btn    = e.target.closest("[data-action='toggle-save']");
    const showId = btn.dataset.showId;
    const show   = shows.find((s) => s.id === showId);
    const wasOnSavedTab = parseHash().view === "saved";

    const newSaved = toggleSaved(showId);
    track("toggle_watchlist", { showId, saved: newSaved });

    if (!newSaved && wasOnSavedTab && show) {
      // Show undo toast instead of immediate re-render
      showUndoToast(showId, show.title.en);
      renderSaved();
    } else {
      syncSaveButtons(showId, newSaved);
    }
    return;
  }

  if (action === "undo-remove") {
    const showId = e.target.closest("[data-action='undo-remove']").dataset.showId;
    clearTimeout(undoTimer);
    addSaved(showId);
    hideToast();
    track("toggle_watchlist", { showId, saved: true });
    renderSaved();
    return;
  }

  if (action === "open-watch") {
    const el = e.target.closest("[data-action='open-watch']");
    track("open_watch_link", {
      showId:   el.dataset.showId,
      platform: el.dataset.platform,
      region:   el.dataset.region,
    });
    return; // let the <a> navigate normally
  }

  if (action === "open-social") {
    const el = e.target.closest("[data-action='open-social']");
    track("open_social_link", { platform: el.dataset.platform });
    return;
  }

  if (action === "open-person") {
    e.preventDefault();
    // Don't navigate if user clicked a social icon inside the cast item
    if (e.target.closest("[data-action='open-social']")) return;
    const slug = e.target.closest("[data-action='open-person']").dataset.slug;
    track("open_person", { slug });
    location.hash = `#/person/${encodeURIComponent(slug)}`;
    return;
  }

  if (action === "select-day") {
    const day = e.target.closest("[data-action='select-day']").dataset.day;
    if (day === calState.selectedDay) return;
    calState.selectedDay = day;
    // Update strip buttons
    appEl.querySelectorAll(".day-strip__btn").forEach((btn) => {
      const isActive = btn.dataset.day === day;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });
    // Replace lineup only
    const lineupEl = document.getElementById("calLineup");
    if (lineupEl) lineupEl.replaceWith(buildCalLineup());
    return;
  }

  if (action === "jump-day") {
    const day = e.target.closest("[data-action='jump-day']").dataset.day;
    calState.selectedDay = day;
    renderCalendar();
    return;
  }

  if (action === "set-filter") {
    const el     = e.target.closest("[data-action='set-filter']");
    const filter = el.dataset.filter;
    const value  = el.dataset.value;
    if (filter === "tag") {
      const idx = showsState.tags.indexOf(value);
      if (idx === -1) showsState.tags.push(value);
      else showsState.tags.splice(idx, 1);
    } else {
      showsState[filter] = showsState[filter] === value ? "" : value;
    }
    const pos = document.getElementById("showsSearch")?.selectionStart ?? 0;
    renderShows();
    const inp = document.getElementById("showsSearch");
    inp?.setSelectionRange(pos, pos);
    return;
  }

  if (action === "remove-filter") {
    const el     = e.target.closest("[data-action='remove-filter']");
    const filter = el.dataset.filter;
    const value  = el.dataset.value;
    if (filter === "tag" && value) {
      showsState.tags = showsState.tags.filter((t) => t !== value);
    } else {
      showsState[filter] = filter === "tags" ? [] : "";
    }
    renderShows();
    return;
  }

  if (action === "clear-filters") {
    clearShowsFilters();
    renderShows();
    return;
  }

  if (action === "go-shows") {
    location.hash = "#/shows";
    return;
  }

  if (action === "change-theme") {
    const theme = e.target.closest("[data-action='change-theme']").dataset.theme;
    setSetting("theme", theme);
    track("change_setting", { key: "theme" });
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
    updateThemeToggle();
    // Re-render to update pill active state
    renderSettings();
    return;
  }
});

// Keyboard: Enter/Space on cast items
appEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const castItem = e.target.closest("[data-action='open-person']");
    if (castItem) {
      e.preventDefault();
      castItem.click();
    }
  }
});

// Settings selects — timezone and language use native <select> change events
appEl.addEventListener("change", (e) => {
  const action = e.target.dataset.action;

  if (action === "change-tz") {
    const tz = e.target.value;
    setSetting("tz", tz);
    track("change_setting", { key: "tz" });
    return;
  }

  if (action === "change-lang") {
    const lang = e.target.value;
    setSetting("lang", lang);
    track("change_setting", { key: "lang" });
    return;
  }
});

// Sync every on-screen save button for a given show id (avoids full re-render)
function syncSaveButtons(id, saved) {
  document.querySelectorAll(`[data-action="toggle-save"][data-show-id="${id}"]`).forEach((btn) => {
    btn.classList.toggle("is-saved", saved);
    btn.classList.toggle("btn--active", saved);
    btn.setAttribute("aria-pressed", String(saved));
    const isDetailBtn = btn.classList.contains("btn");
    if (isDetailBtn) {
      btn.innerHTML = `${heartSVG(saved, 16)} ${saved ? "Saved" : "Save"}`;
    } else {
      btn.innerHTML = heartSVG(saved);
      btn.setAttribute("aria-label", saved ? "Remove from saved" : "Save show");
    }
  });
}

// ---------------------------------------------------------------------------
// Cloudflare Web Analytics: virtual pageview on hash navigation
// ---------------------------------------------------------------------------

function sendVirtualPageview() {
  if (typeof history.replaceState === "function") {
    history.replaceState(history.state, document.title, location.href);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function parseHash() {
  const hash = location.hash.replace(/^#/, "") || "/";

  const showMatch   = hash.match(/^\/show\/(.+)$/);
  if (showMatch)   return { view: "show",   id:   decodeURIComponent(showMatch[1]) };

  const personMatch = hash.match(/^\/person\/(.+)$/);
  if (personMatch) return { view: "person", slug: decodeURIComponent(personMatch[1]) };

  if (hash === "/shows")    return { view: "shows" };
  if (hash === "/saved")    return { view: "saved" };
  if (hash === "/about")    return { view: "about" };
  if (hash === "/settings") return { view: "settings" };
  return { view: "calendar" };
}

function dispatch() {
  const route = parseHash();
  closeScopeDropdown();
  renderTopBar(route);
  updateTabActive(route.view);
  updateThemeToggle();

  switch (route.view) {
    case "calendar": renderCalendar();           break;
    case "shows":    renderShows();              break;
    case "saved":    renderSaved();              break;
    case "show":     renderShowDetail(route.id); break;
    case "person":   renderPerson(route.slug);   break;
    case "about":    renderAbout();              break;
    case "settings": renderSettings();           break;
    default:         renderCalendar();
  }

  // Trigger enter animation
  appEl.classList.remove("view-enter");
  void appEl.offsetWidth; // reflow
  appEl.classList.add("view-enter");

  sendVirtualPageview();
}

window.addEventListener("hashchange", (e) => {
  // Save scroll position of the screen we're leaving
  const oldHash = new URL(e.oldURL).hash || "#/";
  scrollPositions[oldHash] = mainEl.scrollTop;

  dispatch();

  // Restore or reset scroll for the new screen
  const newHash = location.hash || "#/";
  requestAnimationFrame(() => {
    mainEl.scrollTop = scrollPositions[newHash] ?? 0;
  });

  mainEl.focus({ preventScroll: true });
});

// ---------------------------------------------------------------------------
// PWA: service worker + install prompt
// ---------------------------------------------------------------------------

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.error("[faen] SW registration failed", err));
  }
}

function wireInstallPrompt() {
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show a subtle install nudge in the calendar footer (if it's rendered)
    const calFooter = document.querySelector(".cal-footer");
    if (calFooter && !calFooter.querySelector(".install-btn")) {
      const btn = document.createElement("button");
      btn.className    = "install-btn";
      btn.style.cssText = "display:block;margin-top:var(--sp-2);color:var(--accent);font-size:var(--text-xs);font-weight:600";
      btn.textContent  = "Add Faen to your home screen";
      btn.onclick = async () => {
        btn.remove();
        await deferredPrompt.prompt();
        deferredPrompt = null;
      };
      calFooter.appendChild(btn);
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    document.querySelector(".install-btn")?.remove();
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

initTheme();
track("app_open");
dispatch();
registerServiceWorker();
wireInstallPrompt();
