// shows.js
// Single source of truth for all show data in Faen.
// Exports:
//   shows  -> Array<Show>  (see TEMPLATE below for field shapes)
//   META   -> { attribution, contactEmail, lastUpdated }
//
// Field contract — do not change shapes without updating app.js:
//   id            string     URL-safe slug
//   title         { en, native, romanized }
//                 native = native/original-language title (e.g. Thai, Korean, Chinese); may be empty
//   ship          string     ship name (e.g. "MindNuea")
//   year          number
//   country       string     ISO country code (e.g. "TH", "KR")
//   status        "upcoming" | "airing" | "completed" | "hiatus"
//   schedule      { airDay, airTimeTH, timezone, premiereDate, finaleDate, totalEpisodes, currentEpisode }
//                 airDay is full English weekday ("Monday"…"Sunday")
//                 airTimeTH is 24h "HH:MM" in Asia/Bangkok (UTC+7, no DST)
//   watch         Array<{ platform, region, url, free, languages[] }>
//   poster        { url, source, attribution }
//   cast          Array<{ name, character, bio?, socials: { instagram?, x?, tiktok? } }>
//                 bio is an optional plain-text biography string
//   synopsis      string
//   tags          string[]
//   trailerUrl    string | undefined
//
// TEMPLATE (copy-paste to add a new show):
// {
//   id: "",
//   title: { en: "", native: "", romanized: "" },
//   ship: "",
//   year: 2026,
//   country: "TH",
//   status: "upcoming",
//   schedule: {
//     airDay: "Friday",
//     airTimeTH: "21:00",
//     timezone: "Asia/Bangkok",
//     premiereDate: "2026-01-01",
//     finaleDate: "2026-03-01",
//     totalEpisodes: 8,
//     currentEpisode: 0,
//   },
//   watch: [{ platform: "", region: "", url: "", free: true, languages: ["Thai", "English subs"] }],
//   poster: { url: "", source: "", attribution: "" },
//   cast: [{ name: "", character: "", bio: "", socials: { instagram: "", x: "", tiktok: "" } }],
//   synopsis: "",
//   tags: [],
//   trailerUrl: "",
// },

export const shows = [
  {
    id: "love-at-first-night",
    title: {
      en: "Love at First Night",
      native: "รักครั้งแรกในคืนนั้น",
      romanized: "Rak Khrang Raek Nai Kuen Nan",
    },
    ship: "MindNuea",
    year: 2026,
    country: "TH",
    status: "airing",
    schedule: {
      airDay: "Friday",
      airTimeTH: "20:30",
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
        bio: "Placeholder bio — replace with the actress's real biography.",
        socials: { instagram: "https://instagram.com/", x: "", tiktok: "" },
      },
      {
        name: "Example Actress B",
        character: "Nuea",
        bio: "",
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
  lastUpdated: "2026-07-20",
};
