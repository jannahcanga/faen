// shows.js
// Single source of truth for all show data in Faen.
// Exports:
//   shows  -> Array<Show>  (see field shapes below)
//   META   -> { attribution: { tmdb }, contactEmail }
//
// Do not change the shape of these objects without updating every view that
// reads them (app.js). Dates are ISO strings (YYYY-MM-DD). Times are 24h
// "HH:MM" strings in the show's own timezone (schedule.timezone).
//
// This is placeholder/example data so the app has something to render.
// Replace with real shows, real posters, and real cast info before going live.

export const shows = [
  {
    id: "love-at-first-night",
    title: {
      en: "Love at First Night",
      th: "รักครั้งแรกในคืนนั้น",
      romanized: "Rak Khrang Raek Nai Kuen Nan",
    },
    ship: "MindNuea",
    year: 2026,
    status: "airing", // "upcoming" | "airing" | "completed" | "hiatus"
    schedule: {
      airDay: "Friday", // Monday..Sunday, used to place the show in the weekly grid
      airTimeTH: "20:30", // 24h "HH:MM", local to `timezone`
      timezone: "Asia/Bangkok",
      premiereDate: "2026-04-03",
      finaleDate: "2026-06-19",
      totalEpisodes: 12,
      currentEpisode: 8,
    },
    watch: [
      {
        platform: "YouTube",
        region: "Global",
        url: "https://www.youtube.com/",
        free: true,
        languages: ["Thai", "English subs"],
      },
      {
        platform: "WeTV",
        region: "Southeast Asia",
        url: "https://wetv.vip/",
        free: false,
        languages: ["Thai", "English subs", "Chinese subs"],
      },
    ],
    poster: {
      url: "icons/icon-512.png",
      source: "placeholder",
      attribution: "Placeholder artwork — replace with the official poster",
    },
    cast: [
      {
        name: "Example Actress A",
        character: "Mind",
        socials: { instagram: "https://instagram.com/", x: "", tiktok: "" },
      },
      {
        name: "Example Actress B",
        character: "Nuea",
        socials: { instagram: "", x: "https://x.com/", tiktok: "" },
      },
    ],
    synopsis:
      "Placeholder synopsis: two university students keep crossing paths after a chance meeting one rainy night, and slowly realize the feeling between them isn't just friendship. Replace with the real show synopsis.",
    tags: ["romance", "slow-burn", "campus"],
    trailerUrl: "https://www.youtube.com/",
  },
];

export const META = {
  attribution: {
    tmdb:
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  },
  contactEmail: "hello@example.com",
};
