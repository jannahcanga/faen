// app.js
// GL Hub — all routing + rendering lives here. Vanilla JS, ES modules, no
// build step. Every view is a plain template-string render into #app; we
// re-render the whole view on any state change since the dataset is small.
//
// Data flows in one direction:
//   shows.js      -> read-only show/META data
//   watchlist.js  -> the ONLY thing allowed to touch localStorage
//   analytics.js  -> the ONLY thing allowed to log/send events
// app.js never touches localStorage or an analytics vendor directly.

import { shows, META } from "./shows.js";
import { getSaved, isSaved, toggle as toggleSaved } from "./watchlist.js";
import { track } from "./analytics.js";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const appEl = document.getElementById("app");
const mainEl = document.getElementById("main");

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Escape user-facing strings before they go into innerHTML. */
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function groupBy(list, key) {
  return list.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});
}

/**
 * Asia/Bangkok has no DST and is always UTC+7, so we can convert a plain
 * "HH:MM" air time straight to a UTC instant (anchored to "today") without
 * needing a timezone database. We then format that instant in whatever
 * timezone the viewer's browser is already using.
 */
function bangkokTimeToLocalString(airTimeTH) {
  const [hours, minutes] = airTimeTH.split(":").map(Number);
  const now = new Date();
  const utcInstant = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours - 7, minutes)
  );
  return utcInstant.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatAirTime(schedule) {
  if (!schedule?.airTimeTH) return "";
  const local = bangkokTimeToLocalString(schedule.airTimeTH);
  return `${schedule.airTimeTH} ICT &middot; ${local} your time`;
}

function todayWeekdayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

const STATUS_LABELS = {
  upcoming: "Upcoming",
  airing: "Airing",
  completed: "Completed",
  hiatus: "On hiatus",
};

function statusBadge(status) {
  return `<span class="badge badge--${status}">${STATUS_LABELS[status] || status}</span>`;
}

const SOCIAL_LABELS = { instagram: "IG", x: "X", tiktok: "TT" };

function socialIconsHTML(socials = {}) {
  return Object.keys(SOCIAL_LABELS)
    .filter((key) => socials[key])
    .map(
      (key) => `
      <a class="social-icon" href="${escapeHTML(socials[key])}" target="_blank" rel="noopener noreferrer"
         data-action="open-social" data-platform="${key}" aria-label="${SOCIAL_LABELS[key]} profile">
        ${SOCIAL_LABELS[key]}
      </a>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Show card (reused by Home / Browse / Saved)
// ---------------------------------------------------------------------------

function showCardHTML(show) {
  const saved = isSaved(show.id);
  const timeLine = formatAirTime(show.schedule);
  return `
    <li class="card">
      <a class="card__link" href="#/show/${encodeURIComponent(show.id)}">
        <img class="card__poster" src="${escapeHTML(show.poster?.url || "")}"
             alt="${escapeHTML(show.title.en)} poster" loading="lazy" width="120" height="160" />
        <div class="card__body">
          <h3 class="card__title">${escapeHTML(show.title.en)}</h3>
          <p class="card__ship">${escapeHTML(show.ship)}</p>
          ${statusBadge(show.status)}
          ${timeLine ? `<p class="card__time">${timeLine}</p>` : ""}
        </div>
      </a>
      <button class="card__save ${saved ? "is-saved" : ""}" type="button"
              data-action="toggle-save" data-show-id="${show.id}"
              aria-pressed="${saved}" aria-label="${saved ? "Remove from saved shows" : "Save show"}">
        &#9825;
      </button>
    </li>`;
}

// ---------------------------------------------------------------------------
// Home view — weekly calendar
// ---------------------------------------------------------------------------

function renderHome() {
  const airingNow = shows.filter((s) => s.status === "airing");
  const today = todayWeekdayName();

  const dayColumns = DAYS.map((day) => {
    const dayShows = shows.filter(
      (s) => (s.status === "airing" || s.status === "upcoming") && s.schedule?.airDay === day
    );
    const isToday = day === today;
    return `
      <section class="day-col ${isToday ? "day-col--today" : ""}">
        <h2 class="day-col__heading">${day}${isToday ? ' <span class="today-pill">Today</span>' : ""}</h2>
        ${
          dayShows.length
            ? `<ul class="card-list">${dayShows.map(showCardHTML).join("")}</ul>`
            : `<p class="empty-note">Nothing scheduled</p>`
        }
      </section>`;
  }).join("");

  appEl.innerHTML = `
    <h1 class="view-title">This week</h1>
    ${
      airingNow.length
        ? `
      <section class="rail">
        <h2 class="rail__heading">Airing now</h2>
        <ul class="card-list card-list--rail">${airingNow.map(showCardHTML).join("")}</ul>
      </section>`
        : ""
    }
    <div class="week-grid">${dayColumns}</div>
  `;
}

// ---------------------------------------------------------------------------
// Browse / Search view
// ---------------------------------------------------------------------------

// Lives outside the render function so filters survive a re-render.
const browseState = { query: "", status: "all", tag: "all" };

function allTags() {
  const tagSet = new Set();
  shows.forEach((s) => (s.tags || []).forEach((t) => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

function filteredShows() {
  const query = browseState.query.trim().toLowerCase();
  return shows.filter((show) => {
    if (browseState.status !== "all" && show.status !== browseState.status) return false;
    if (browseState.tag !== "all" && !(show.tags || []).includes(browseState.tag)) return false;
    if (query) {
      const haystack = `${show.title.en} ${show.title.romanized} ${show.ship}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function renderBrowse() {
  const results = filteredShows();
  const statuses = ["all", "airing", "upcoming", "completed", "hiatus"];
  const tags = allTags();

  appEl.innerHTML = `
    <h1 class="view-title">Browse</h1>
    <div class="search-row">
      <label class="sr-only" for="searchInput">Search by title or ship</label>
      <input id="searchInput" type="search" placeholder="Search title or ship&hellip;" value="${escapeHTML(browseState.query)}" />
    </div>
    <div class="chip-row" role="group" aria-label="Filter by status">
      ${statuses
        .map(
          (s) => `
        <button class="chip ${browseState.status === s ? "chip--active" : ""}" type="button"
                data-filter="status" data-value="${s}">${s === "all" ? "All" : STATUS_LABELS[s]}</button>`
        )
        .join("")}
    </div>
    ${
      tags.length
        ? `
    <div class="chip-row" role="group" aria-label="Filter by tag">
      <button class="chip ${browseState.tag === "all" ? "chip--active" : ""}" type="button"
              data-filter="tag" data-value="all">All tags</button>
      ${tags
        .map(
          (t) => `
        <button class="chip ${browseState.tag === t ? "chip--active" : ""}" type="button"
                data-filter="tag" data-value="${escapeHTML(t)}">${escapeHTML(t)}</button>`
        )
        .join("")}
    </div>`
        : ""
    }
    <p class="result-count">${results.length} show${results.length === 1 ? "" : "s"}</p>
    ${
      results.length
        ? `<ul class="card-list">${results.map(showCardHTML).join("")}</ul>`
        : `<p class="empty-note">No shows match your search.</p>`
    }
  `;

  const input = document.getElementById("searchInput");
  input.addEventListener("input", () => {
    browseState.query = input.value;
    track("search", { resultCount: filteredShows().length }); // count only, never the raw query
    renderBrowse();
    const refreshedInput = document.getElementById("searchInput");
    refreshedInput.focus();
    refreshedInput.setSelectionRange(refreshedInput.value.length, refreshedInput.value.length);
  });
}

// ---------------------------------------------------------------------------
// Show detail view
// ---------------------------------------------------------------------------

function renderShowDetail(id) {
  const show = shows.find((s) => s.id === id);
  if (!show) {
    appEl.innerHTML = `<p class="empty-note">Show not found. <a href="#/browse">Back to browse</a></p>`;
    return;
  }

  track("open_show", { id });
  const saved = isSaved(show.id);

  const watchByRegion = groupBy(show.watch || [], "region");
  const watchHTML = Object.entries(watchByRegion)
    .map(
      ([region, entries]) => `
    <div class="watch-region">
      <h3 class="watch-region__title">${escapeHTML(region)}</h3>
      <ul class="watch-list">
        ${entries
          .map(
            (w) => `
          <li>
            <a class="watch-btn" href="${escapeHTML(w.url)}" target="_blank" rel="noopener noreferrer"
               data-action="open-watch" data-show-id="${show.id}"
               data-platform="${escapeHTML(w.platform)}" data-region="${escapeHTML(region)}">
              <span class="watch-btn__platform">${escapeHTML(w.platform)}</span>
              ${w.free ? `<span class="badge badge--free">Free</span>` : ""}
              <span class="watch-btn__langs">${(w.languages || []).map(escapeHTML).join(", ")}</span>
            </a>
          </li>`
          )
          .join("")}
      </ul>
    </div>`
    )
    .join("");

  const castHTML = (show.cast || [])
    .map(
      (member) => `
    <li class="cast-item">
      <span class="cast-item__name">${escapeHTML(member.name)}</span>
      <span class="cast-item__character">as ${escapeHTML(member.character)}</span>
      <span class="cast-item__socials">${socialIconsHTML(member.socials)}</span>
    </li>`
    )
    .join("");

  appEl.innerHTML = `
    <a class="back-link" href="#/browse">&larr; Back</a>
    <article class="show-detail">
      <div class="show-detail__head">
        <img class="show-detail__poster" src="${escapeHTML(show.poster?.url || "")}"
             alt="${escapeHTML(show.title.en)} poster" width="160" height="220" />
        <div>
          <h1 class="view-title">${escapeHTML(show.title.en)}</h1>
          <p class="show-detail__native">${escapeHTML(show.title.th)} &middot; ${escapeHTML(show.title.romanized)}</p>
          <p class="show-detail__meta">${escapeHTML(show.ship)} &middot; ${show.year} ${statusBadge(show.status)}</p>
          <div class="show-detail__actions">
            <button class="btn ${saved ? "btn--active" : ""}" type="button"
                    data-action="toggle-save" data-show-id="${show.id}" aria-pressed="${saved}">
              ${saved ? "&#9829; Saved" : "&#9825; Save"}
            </button>
            ${
              show.trailerUrl
                ? `<a class="btn btn--ghost" href="${escapeHTML(show.trailerUrl)}" target="_blank" rel="noopener noreferrer">Watch trailer</a>`
                : ""
            }
          </div>
        </div>
      </div>

      <p class="show-detail__synopsis">${escapeHTML(show.synopsis || "")}</p>

      ${
        show.tags?.length
          ? `<ul class="tag-list">${show.tags.map((t) => `<li class="tag">${escapeHTML(t)}</li>`).join("")}</ul>`
          : ""
      }

      <h2>Where to watch</h2>
      ${watchHTML || `<p class="empty-note">No watch links yet.</p>`}

      <h2>Cast</h2>
      <ul class="cast-list">${castHTML || `<p class="empty-note">No cast info yet.</p>`}</ul>
    </article>
  `;
}

// ---------------------------------------------------------------------------
// Saved view
// ---------------------------------------------------------------------------

function renderSaved() {
  const savedIds = getSaved();
  const savedShows = shows.filter((s) => savedIds.includes(s.id));

  appEl.innerHTML = `
    <h1 class="view-title">Saved</h1>
    ${
      savedShows.length
        ? `<ul class="card-list">${savedShows.map(showCardHTML).join("")}</ul>`
        : `<p class="empty-note">You haven&rsquo;t saved any shows yet. Tap the heart on a show to save it here.</p>`
    }
  `;
}

// ---------------------------------------------------------------------------
// About view
// ---------------------------------------------------------------------------

function renderAbout() {
  appEl.innerHTML = `
    <h1 class="view-title">About &amp; credits</h1>
    <p>${escapeHTML(META.attribution.tmdb)}</p>
    <p>Rights holders can reach me here:
      <a href="mailto:${escapeHTML(META.contactEmail)}">${escapeHTML(META.contactEmail)}</a>
    </p>
    <p>GL Hub is an independent fan project. It is not affiliated with or endorsed by any studio, network, or streaming platform, and it never hosts or streams video — it only links to official sources.</p>
  `;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function parseHash() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const showMatch = hash.match(/^\/show\/(.+)$/);
  if (showMatch) return { view: "show", id: decodeURIComponent(showMatch[1]) };
  if (hash === "/browse") return { view: "browse" };
  if (hash === "/saved") return { view: "saved" };
  if (hash === "/about") return { view: "about" };
  return { view: "home" };
}

const ROUTE_TO_NAV_PATH = { home: "/", browse: "/browse", saved: "/saved", about: "/about" };

function updateNavActiveState(route) {
  const path = ROUTE_TO_NAV_PATH[route.view] || null;
  document.querySelectorAll(".site-nav a").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.route === path);
  });
}

function renderRoute(route) {
  switch (route.view) {
    case "show":
      renderShowDetail(route.id);
      break;
    case "browse":
      renderBrowse();
      break;
    case "saved":
      renderSaved();
      break;
    case "about":
      renderAbout();
      break;
    default:
      renderHome();
  }
}

function dispatch() {
  const route = parseHash();
  updateNavActiveState(route);
  renderRoute(route);
}

// ---------------------------------------------------------------------------
// Delegated click handling (save button, watch links, social links)
// Attached once; works for every view since #app's contents get swapped out.
// ---------------------------------------------------------------------------

appEl.addEventListener("click", (event) => {
  const saveBtn = event.target.closest('[data-action="toggle-save"]');
  if (saveBtn) {
    event.preventDefault();
    const id = saveBtn.dataset.showId;
    const saved = toggleSaved(id);
    track("toggle_watchlist", { showId: id, saved });
    syncSaveButtons(id, saved);
    return;
  }

  const watchLink = event.target.closest('[data-action="open-watch"]');
  if (watchLink) {
    track("open_watch_link", {
      showId: watchLink.dataset.showId,
      platform: watchLink.dataset.platform,
      region: watchLink.dataset.region,
    });
    return; // let the <a> navigate normally (new tab)
  }

  const socialLink = event.target.closest('[data-action="open-social"]');
  if (socialLink) {
    track("open_social_link", { platform: socialLink.dataset.platform });
    return;
  }

  const filterChip = event.target.closest("[data-filter]");
  if (filterChip) {
    browseState[filterChip.dataset.filter] = filterChip.dataset.value;
    renderBrowse();
  }
});

/** Update every on-screen save button for `id` without a full re-render. */
function syncSaveButtons(id, saved) {
  document.querySelectorAll(`[data-action="toggle-save"][data-show-id="${id}"]`).forEach((btn) => {
    btn.classList.toggle("is-saved", saved);
    btn.classList.toggle("btn--active", saved);
    btn.setAttribute("aria-pressed", String(saved));
    if (btn.classList.contains("card__save")) {
      btn.setAttribute("aria-label", saved ? "Remove from saved shows" : "Save show");
    } else {
      btn.innerHTML = saved ? "&#9829; Saved" : "&#9825; Save";
    }
  });
  // The Saved view's list itself needs to gain/lose the item.
  if (parseHash().view === "saved") renderSaved();
}

// ---------------------------------------------------------------------------
// Cloudflare Web Analytics: virtual pageview on hash navigation
// ---------------------------------------------------------------------------

function sendVirtualPageview() {
  // CF's beacon script tracks SPA navigations by watching history.pushState/
  // replaceState. Hash changes alone don't trigger it, so we re-announce the
  // current URL via replaceState (not pushState, to avoid creating a
  // duplicate back-button entry for a navigation that already happened).
  // This is a best-effort nudge — CF's internals aren't publicly documented,
  // so confirm in your dashboard once a real CF_BEACON_TOKEN is wired up.
  if (typeof history.replaceState === "function") {
    history.replaceState(history.state, document.title, location.href);
  }
}

window.addEventListener("hashchange", () => {
  dispatch();
  sendVirtualPageview();
  mainEl.focus({ preventScroll: true });
});

// ---------------------------------------------------------------------------
// PWA: service worker registration + install prompt
// ---------------------------------------------------------------------------

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.error("SW registration failed", err));
  }
}

function wireInstallPrompt() {
  const installBtn = document.getElementById("installBtn");
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    installBtn.hidden = true;
    await deferredPrompt.prompt();
    deferredPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

track("app_open");
dispatch();
registerServiceWorker();
wireInstallPrompt();
