"use strict";

const MAX_RECENT = 9;
const STORAGE_KEY = "recentClosedClearedAt";
const BACKGROUND_KEY = "landingBackground";
const APPEARANCE_KEY = "landingAppearance";
const THEME_KEY = "landingTheme";
const ICON_CACHE_KEY = "faviconCache";
const CONTINUE_CANDIDATE_CACHE_KEY = "continueCandidateData";
const RECENT_ORGANIZATION_CACHE_KEY = "recentClosedOrganization";
const CONTINUE_JOURNEY_CACHE_KEY = "continueJourneys";
const AI_ATTEMPT_STATE_KEY = "browserAiAttemptState";
const CLOUD_AI_CONFIG_KEY = "geminiCloudConfig";
const CLOUD_AI_SESSION_REFRESH_KEY = "geminiCloudSessionRefresh";
const AI_ORGANIZER_LOCK_NAME = "safarian-browser-ai-organizer";
const CLOUD_AI_REFRESH_LOCK_NAME = "safarian-cloud-ai-refresh-claim";
const RECENT_CLOUD_MODEL = "gemini-3.5-flash-lite";
const CONTINUE_CLOUD_MODEL = "gemini-3.7-flash";
const CLOUD_AI_READY_MESSAGE = "Smart routing active: one full Flash review per Chrome session, then private on-device updates.";
const INCREMENTAL_CACHE_VERSION = 2;
const GEMINI_INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_HOST_PERMISSION = "https://generativelanguage.googleapis.com/*";
const GEMINI_REQUEST_TIMEOUT = 10000;
const CLOUD_AI_REFRESH_CLAIM_TTL = 2 * 60 * 1000;
const CLOUD_FULL_REVIEW_MIN_INTERVAL = 30 * 60 * 1000;
const CLOUD_FALLBACK_CACHE_TTL = 60 * 60 * 1000;
const INCREMENTAL_BASELINE_TTL = 7 * 24 * 60 * 60 * 1000;
const ICON_CACHE_TTL = 14 * 24 * 60 * 60 * 1000;
const ICON_CACHE_WRITE_DELAY = 180;
const CONTINUE_CANDIDATE_CACHE_TTL = 5 * 60 * 1000;
const CONTINUE_CANDIDATE_STALE_TTL = 6 * 60 * 60 * 1000;
const CONTINUE_HISTORY_DETAIL_LIMIT = 36;
const CONTINUE_HISTORY_CONCURRENCY = 6;
const RECENT_ORGANIZATION_CACHE_TTL = 6 * 60 * 60 * 1000;
const CONTINUE_JOURNEY_CACHE_TTL = 12 * 60 * 60 * 1000;
const CONTINUE_RANGE_DAYS = 30;
const MAX_RECENT_ORGANIZER_CANDIDATES = 18;
const MAX_CONTINUE_CANDIDATES = 24;
const RECALL_RANGE_DAYS = 180;
const MAX_RECALL_CANDIDATES = 70;
const IS_EXTENSION_CONTEXT = hasExtensionApis();
const SHOW_AI_LOADING_PREVIEW = !IS_EXTENSION_CONTEXT && new URLSearchParams(window.location.search).has("preview-ai-loading");
const VALID_THEMES = ["classic", "sunset", "emerald", "twilight", "titanium", "rose", "solaris"];
const LANGUAGE_MODEL_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }]
};
const PREVIEW_TIMESTAMP = Date.now();
let favoritesState = [];
let favoritesEditMode = false;
let editingFavoriteIndex = null;
let favoriteMenuIndex = null;
let reorderSourceIndex = null;
let favoriteDrag = null;
let favoriteDropIndex = null;
let suppressFavoriteClick = false;
let bookmarksBarId = null;
let favoritesRenderRequest = 0;
let favoritesRefreshPending = false;
let favoritesRefreshTimeout = 0;
let iconCache = null;
let iconCachePromise = null;
let iconCacheWriteTimeout = 0;
let iconCacheWritePromise = Promise.resolve();
let iconCacheDirty = false;
let continueCandidateRefreshPromise = null;
let recentDisplayMode = "smart";
let recentItemsState = [];
let recentRenderRequest = 0;
let recentNanoDownloadIntent = null;
let continueRenderRequest = 0;
let browserOrganizerSession = null;
let browserOrganizerSessionPromise = null;
let browserOrganizerPromptQueue = Promise.resolve();
let trustedLocalStoragePromise = null;
let volatileCloudAiConfig = null;
let cloudAiConfigCacheLoaded = false;
let cloudAiConfigReadPromise = null;
let geminiHostPermissionState = null;
let geminiHostPermissionReadPromise = null;
const storageValueCache = new Map();
const storageReadPromises = new Map();
const volatileSessionStorage = new Map();

const themePalettes = {
  classic: [
    ["#367fe7", "#1a5fc2"],
    ["#17458e", "#102f64"],
    ["#48649b", "#24436f"],
    ["#10572f", "#082d18"],
    ["#4b5580", "#252f52"],
    ["#263e65", "#172842"],
    ["#267293", "#143f57"],
    ["#625391", "#382f69"]
  ],
  sunset: [
    ["#ea580c", "#9a3412"],
    ["#f97316", "#c2410c"],
    ["#d97706", "#92400e"],
    ["#e11d48", "#881337"],
    ["#c026d3", "#701a75"],
    ["#b45309", "#78350f"],
    ["#e65100", "#bf360c"],
    ["#be123c", "#4c0519"]
  ],
  emerald: [
    ["#059669", "#064e3b"],
    ["#0d9488", "#115e59"],
    ["#10b981", "#047857"],
    ["#0284c7", "#075985"],
    ["#14b8a6", "#134e4a"],
    ["#15803d", "#14532d"],
    ["#0e7490", "#164e63"],
    ["#047857", "#064e3b"]
  ],
  twilight: [
    ["#7c3aed", "#4c1d95"],
    ["#6366f1", "#3730a3"],
    ["#8b5cf6", "#5b21b6"],
    ["#a855f7", "#6b21a8"],
    ["#4f46e5", "#312e81"],
    ["#9333ea", "#581c87"],
    ["#3b82f6", "#1e3a8a"],
    ["#6d28d9", "#3b0764"]
  ],
  titanium: [
    ["#475569", "#1e293b"],
    ["#334155", "#0f172a"],
    ["#2563eb", "#1d4ed8"],
    ["#0284c7", "#0c4a6e"],
    ["#64748b", "#334155"],
    ["#52525b", "#27272a"],
    ["#3b82f6", "#1e40af"],
    ["#4b5563", "#1f2937"]
  ],
  rose: [
    ["#e11d48", "#881337"],
    ["#db2777", "#831843"],
    ["#f43f5e", "#9f1239"],
    ["#be123c", "#4c0519"],
    ["#ec4899", "#9d174d"],
    ["#9f1239", "#4c0519"],
    ["#d946ef", "#701a75"],
    ["#f43f5e", "#881337"]
  ],
  solaris: [
    ["#d97706", "#78350f"],
    ["#b45309", "#451a03"],
    ["#ca8a04", "#713f12"],
    ["#eab308", "#854d0e"],
    ["#ea580c", "#7c2d12"],
    ["#c2410c", "#431407"],
    ["#f59e0b", "#92400e"],
    ["#d97706", "#451a03"]
  ]
};
const palette = themePalettes.classic;

const fallbackRecent = [
  { sessionId: "preview-1", title: "apple developer - Google Search", url: "https://developer.apple.com", lastModified: Date.now() },
  { sessionId: "preview-2", title: "AmEx travel rewards dashboard", url: "https://www.americanexpress.com", lastModified: Date.now() },
  { sessionId: "preview-3", title: "Surfshark: my account", url: "https://surfshark.com", lastModified: Date.now() },
  { sessionId: "preview-4", title: "American Express - Overview", url: "https://www.americanexpress.com", lastModified: Date.now() },
  { sessionId: "preview-5", title: "Unsubscribe", url: "https://mail.google.com", lastModified: Date.now() },
  { sessionId: "preview-6", title: "Online check-in - STARLUX Airlines", url: "https://www.starlux-airlines.com", lastModified: Date.now() }
];

const fallbackFavorites = [
  ["Google", "https://www.google.com"],
  ["ChatGPT", "https://chatgpt.com"],
  ["Claude", "https://claude.ai"],
  ["9to5Mac", "https://9to5mac.com"],
  ["MacRumors", "https://www.macrumors.com"],
  ["Instagram", "https://www.instagram.com"],
  ["X", "https://x.com"],
  ["Reddit", "https://www.reddit.com"],
  ["Amazon", "https://www.amazon.com"],
  ["LinkedIn", "https://www.linkedin.com"],
  ["Netflix", "https://www.netflix.com"],
  ["YouTube", "https://www.youtube.com"],
  ["Prime Video", "https://www.primevideo.com"],
  ["HBO Max", "https://www.max.com"],
  ["Disney+", "https://www.disneyplus.com"],
  ["Peacock", "https://www.peacocktv.com"],
  ["LeetCode", "https://leetcode.com"],
  ["Chase", "https://www.chase.com"],
  ["Bank of America", "https://www.bankofamerica.com"],
  ["American Express", "https://www.americanexpress.com"],
  ["Capital One", "https://www.capitalone.com"],
  ["Citi", "https://www.citi.com"],
  ["Coinbase", "https://www.coinbase.com"],
  ["Robinhood", "https://robinhood.com"],
  ["Fidelity", "https://www.fidelity.com"],
  ["CoinMarketCap", "https://coinmarketcap.com"],
  ["Hulu", "https://www.hulu.com"],
  ["Apple Pay", "https://www.apple.com/apple-pay/"],
  ["Iconify", "https://iconify.design"],
  ["Levels.fyi", "https://www.levels.fyi"],
  ["12ft Ladder", "https://12ft.io"],
  ["Nameflix", "https://nameflix.com"]
].map(([title, url]) => ({ title, url }));

const fallbackSuggestions = [
  ["seats.aero - Home", "https://seats.aero", Date.now() - 7 * 24 * 60 * 60 * 1000],
  ["American Express - Overview", "https://global.americanexpress.com", Date.now() - 31 * 24 * 60 * 60 * 1000],
  ["US Credit Card Guide", "https://www.uscreditcardguide.com", Date.now() - 34 * 24 * 60 * 60 * 1000],
  ["Welcome to Netflix!", "https://www.netflix.com", Date.now() - 92 * 24 * 60 * 60 * 1000],
  ["Flight Award Finder", "https://www.point.me", Date.now() - 186 * 24 * 60 * 60 * 1000],
  ["Travel Planning Guide", "https://www.lonelyplanet.com", Date.now() - 300 * 24 * 60 * 60 * 1000]
].map(([title, url, lastVisitTime]) => ({ title, url, lastVisitTime }));

const iconColors = [
  "#f7f8f7", "#16191f", "#df7458", "#58a814", "#0c5d8f", "#0b2743",
  "#111111", "#ff5700", "#f6a000", "#0879ae", "#a51f2b", "#c7001a",
  "#ff0033", "#f5a000", "#0e0e0e", "#0d6b79", "#121212", "#214a9a",
  "#ffffff", "#2e9cd2", "#d8232a", "#ffffff", "#15515f", "#1751ff",
  "#c8ff00", "#4c9f00", "#296dff", "#aa1738", "#1ee27f", "#1584ff",
  "#9aa0ad", "#82949f", "#7b6147", "#536cbf"
];

document.addEventListener("DOMContentLoaded", () => {
  setupStorageCacheInvalidation();
  setupCloudAiPermissionInvalidation();
  const clearButton = document.querySelector("#clear-recent");
  const recentOrganizeButton = document.querySelector("#recent-organize");
  const recentAiRefreshButton = document.querySelector("#recent-ai-refresh");
  const continueAiRefreshButton = document.querySelector("#continue-ai-refresh");
  const searchForm = document.querySelector("#search-form");
  const searchInput = document.querySelector("#search-input");
  const recallButton = document.querySelector("#recall-button");
  const recallClose = document.querySelector("#recall-close");

  clearButton.addEventListener("click", async () => {
    await setStorageValue(STORAGE_KEY, Date.now());
    await renderRecentlyClosed();
  });

  recentOrganizeButton.addEventListener("click", async () => {
    if (recentOrganizeButton.disabled) return;
    if (recentDisplayMode === "smart") {
      recentNanoDownloadIntent = null;
      recentDisplayMode = "recent";
      await renderRecentlyClosed();
      return;
    }

    recentDisplayMode = "smart";
    await renderRecentlyClosed();
  });

  recentAiRefreshButton.addEventListener("click", async () => {
    if (recentAiRefreshButton.disabled) return;
    recentDisplayMode = "smart";
    const downloadIntent = {};
    recentNanoDownloadIntent = downloadIntent;
    setRecentOrganizationBusy(true, "Starting a fresh AI review…");
    try {
      await renderRecentlyClosed({ forceOrganize: true, downloadIntent });
    } finally {
      if (recentNanoDownloadIntent === downloadIntent) recentNanoDownloadIntent = null;
      if (document.querySelector(".section-recent").classList.contains("is-ai-working")) {
        setRecentOrganizationBusy(false);
      } else {
        setRecentRefreshBusy(false);
      }
    }
  });

  continueAiRefreshButton.addEventListener("click", async () => {
    if (continueAiRefreshButton.disabled) return;
    setContinueRefreshBusy(true);
    try {
      await renderContinueJourneys({ force: true });
    } finally {
      setContinueRefreshBusy(false);
    }
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    window.location.href = destinationForQuery(query);
  });

  recallButton.addEventListener("click", () => {
    void recallFromHistory();
  });

  recallClose.addEventListener("click", hideRecallPanel);

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      void recallFromHistory();
      return;
    }

    if (event.key === "Escape") {
      hideRecallPanel();
    }
  });

  setHeaderText();
  setupCustomizeControls();
  setupFavoritesListInteractions();
  setupFavoriteEditor();
  setupFavoriteContextMenu();
  setupBookmarkMirrorListeners();
  void updateRecallAvailabilityHint();
  loadPage();
});

window.addEventListener("pagehide", () => {
  void flushIconCacheWrites();
  resetBrowserOrganizerSession();
});

async function updateRecallAvailabilityHint() {
  const button = document.querySelector("#recall-button");
  if (!button) return;

  if (!globalThis.LanguageModel || typeof LanguageModel.availability !== "function") {
    button.dataset.availability = "unavailable";
    button.title = "Gemini is unavailable here; Recall will use local title matching instead";
    return;
  }

  try {
    const availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
    button.dataset.availability = availability;
    button.title = availability === "available"
      ? "Describe a page you remember, then let on-device Gemini find it in your history"
      : availability === "downloadable" || availability === "downloading"
        ? "Recall a page; Chrome may first download its on-device Gemini model"
        : "Gemini is unavailable on this device; Recall will use local title matching";
  } catch (error) {
    console.warn("Unable to check Chrome built-in AI availability", error);
  }
}

async function recallFromHistory() {
  const input = document.querySelector("#search-input");
  const query = input.value.trim();

  showRecallPanel();

  if (!query) {
    renderRecallStatus({
      icon: "?",
      title: "What do you remember?",
      detail: "Try something like “the design article about calm interfaces I read last month.”"
    });
    input.focus();
    return;
  }

  setRecallBusy(true);
  renderRecallStatus({
    icon: "✦",
    title: "Checking your history",
    detail: "Preparing real pages for a private, on-device match.",
    loading: true
  });

  const candidatesPromise = loadRecallCandidates(query);

  try {
    if (!globalThis.LanguageModel || typeof LanguageModel.availability !== "function") {
      const candidates = await candidatesPromise;
      renderLocalRecallFallback(query, candidates, "Gemini is not available on this device, so these are direct title matches.");
      return;
    }

    const availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
    if (availability === "unavailable") {
      const candidates = await candidatesPromise;
      renderLocalRecallFallback(query, candidates, "Gemini is not supported by this Chrome or device, so these are direct title matches.");
      return;
    }

    if (availability === "downloadable" || availability === "downloading") {
      renderRecallStatus({
        icon: "↓",
        title: availability === "downloadable" ? "Getting Gemini ready" : "Gemini is downloading",
        detail: "Chrome downloads the model once. Your history stays on this device.",
        loading: true
      });
    }

    const session = await LanguageModel.create({
      ...LANGUAGE_MODEL_OPTIONS,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          const progress = Math.max(0, Math.min(100, Math.round(event.loaded * 100)));
          renderRecallStatus({
            icon: `${progress}%`,
            title: progress < 100 ? "Downloading Gemini" : "Loading Gemini",
            detail: progress < 100
              ? "A one-time Chrome download. Your history remains private."
              : "The on-device model is almost ready.",
            loading: true
          });
        });
      }
    });

    try {
      const candidates = await candidatesPromise;
      if (!candidates.length) {
        renderRecallStatus({
          icon: "0",
          title: "No history to search",
          detail: "Browse normally for a while, then Recall can help recover pages you have seen."
        });
        return;
      }

      renderRecallStatus({
        icon: "✦",
        title: "Remembering with Gemini",
        detail: `Comparing your description with ${candidates.length} real history entries on this device.`,
        loading: true
      });

      const matches = await rankRecallCandidatesWithGemini(session, query, candidates);
      if (!matches.length) {
        renderLocalRecallFallback(query, candidates, "Gemini found no confident semantic match. Here are the closest direct title matches.");
        return;
      }

      renderRecallResults(matches);
    } finally {
      session.destroy();
    }
  } catch (error) {
    console.warn("Chrome built-in Gemini recall failed", error);
    const candidates = await candidatesPromise.catch(() => []);
    renderLocalRecallFallback(query, candidates, "Gemini could not finish this match. Here are the closest direct title matches.");
  } finally {
    setRecallBusy(false);
  }
}

async function loadRecallCandidates(query) {
  if (!IS_EXTENSION_CONTEXT) {
    return dedupeByUrl([
      ...fallbackSuggestions,
      ...fallbackRecent,
      ...fallbackFavorites.map((favorite) => ({ ...favorite, lastVisitTime: 0 }))
    ]).slice(0, MAX_RECALL_CANDIDATES);
  }

  const startTime = Date.now() - RECALL_RANGE_DAYS * 24 * 60 * 60 * 1000;
  const [literalMatches, recentHistory] = await Promise.all([
    callChrome(chrome.history.search, {
      text: query,
      startTime,
      maxResults: MAX_RECALL_CANDIDATES
    }),
    callChrome(chrome.history.search, {
      text: "",
      startTime,
      maxResults: 140
    })
  ]);

  return dedupeByUrl([...literalMatches, ...recentHistory])
    .filter((item) => item.url && isHttpUrl(item.url))
    .filter((item) => !isSearchOrInternalPage(item.url))
    .map((item) => ({
      title: readableTitle(item.title, item.url),
      url: item.url,
      lastVisitTime: item.lastVisitTime || 0
    }))
    .slice(0, MAX_RECALL_CANDIDATES);
}

async function rankRecallCandidatesWithGemini(session, query, candidates) {
  const candidateLines = candidates.map((candidate, id) => {
    const path = recallSafePath(candidate.url);
    const visited = candidate.lastVisitTime ? relativeTime(candidate.lastVisitTime) : "visit time unknown";
    return `${id} | ${candidate.title} | ${hostnameFor(candidate.url)}${path} | ${visited}`;
  }).join("\n");

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["matches"],
    properties: {
      matches: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "reason"],
          properties: {
            id: { type: "integer", minimum: 0, maximum: candidates.length - 1 },
            reason: { type: "string" }
          }
        }
      }
    }
  };

  const prompt = [
    "You rank browser history entries for a page the user vaguely remembers.",
    "Select only entries that plausibly match. Prefer semantic clues, topic, site, and time hints in the request.",
    "Never invent a page or ID. If there is no plausible match, return an empty matches array.",
    "Keep each reason concrete and under 12 words. Return JSON only.",
    `User remembers: ${JSON.stringify(query)}`,
    "History entries:",
    candidateLines
  ].join("\n\n");

  let response;
  try {
    response = await session.prompt(prompt, { responseConstraint: schema });
  } catch (error) {
    if (error && error.name !== "NotSupportedError" && error.name !== "TypeError") throw error;
    response = await session.prompt(`${prompt}\n\nReturn exactly {"matches":[{"id":0,"reason":"short reason"}]}.`);
  }

  const parsed = parseGeminiJson(response);
  const seen = new Set();
  return (Array.isArray(parsed.matches) ? parsed.matches : [])
    .filter((match) => Number.isInteger(match.id) && candidates[match.id] && !seen.has(match.id))
    .map((match) => {
      seen.add(match.id);
      return {
        ...candidates[match.id],
        reason: String(match.reason || "Matches what you remember").slice(0, 90)
      };
    })
    .slice(0, 5);
}

function parseGeminiJson(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function recallSafePath(url) {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).replace(/\s+/g, " ");
    return path === "/" ? "" : shortTitle(path, 70);
  } catch {
    return "";
  }
}

function renderLocalRecallFallback(query, candidates, detail) {
  const matches = rankRecallCandidatesLocally(query, candidates);
  if (matches.length) {
    renderRecallResults(matches, detail);
    return;
  }

  renderRecallStatus({
    icon: "0",
    title: "No close match found",
    detail: `${detail} Try a site name, topic, or rough time you visited it.`
  });
}

function rankRecallCandidatesLocally(query, candidates) {
  const normalizedQuery = normalizeRecallText(query);
  const tokens = [...new Set(normalizedQuery.split(" ").filter((token) => token.length > 1))];
  if (!tokens.length) return [];

  return candidates
    .map((candidate) => {
      const title = normalizeRecallText(candidate.title);
      const location = normalizeRecallText(`${hostnameFor(candidate.url)} ${recallSafePath(candidate.url)}`);
      const haystack = `${title} ${location}`;
      const matchingTokens = tokens.filter((token) => haystack.includes(token));
      const phraseBonus = haystack.includes(normalizedQuery) ? 16 : 0;
      const titleBonus = matchingTokens.filter((token) => title.includes(token)).length * 3;
      const score = phraseBonus + matchingTokens.length * 4 + titleBonus;
      return { candidate, score, matchingTokens };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.candidate.lastVisitTime || 0) - (a.candidate.lastVisitTime || 0))
    .slice(0, 5)
    .map(({ candidate, matchingTokens }) => ({
      ...candidate,
      reason: matchingTokens.length
        ? `Title or address contains ${matchingTokens.slice(0, 3).join(", ")}`
        : "Closest direct match"
    }));
}

function normalizeRecallText(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function renderRecallResults(matches, notice = "") {
  const content = document.querySelector("#recall-content");
  clearChildren(content);

  if (notice) {
    const status = createRecallStatus({
      icon: "↳",
      title: "Local matches",
      detail: notice
    });
    status.classList.add("recall-fallback-note");
    content.append(status);
  }

  const list = document.createElement("div");
  list.className = "recall-results";

  matches.forEach((match) => {
    const button = document.createElement("button");
    button.className = "recall-result";
    button.type = "button";
    button.title = `${match.title}\n${match.url}`;
    button.addEventListener("click", () => {
      window.location.href = match.url;
    });

    const icon = document.createElement("span");
    icon.className = "recall-result-icon";
    icon.textContent = initialFor(match.title, match.url);

    const img = document.createElement("img");
    img.alt = "";
    loadIconSources(img, match.url, 64, () => {
      img.remove();
    });
    icon.append(img);

    const copy = document.createElement("span");
    copy.className = "recall-result-copy";

    const title = document.createElement("span");
    title.className = "recall-result-title";
    title.textContent = match.title;

    const meta = document.createElement("span");
    meta.className = "recall-result-meta";
    meta.textContent = `${hostnameFor(match.url)} · ${match.lastVisitTime ? relativeTime(match.lastVisitTime) : "In your history"}`;

    const reason = document.createElement("span");
    reason.className = "recall-result-reason";
    reason.textContent = match.reason;

    const arrow = document.createElement("span");
    arrow.className = "recall-result-arrow";
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");

    copy.append(title, meta, reason);
    button.append(icon, copy, arrow);
    list.append(button);
  });

  content.append(list);
}

function renderRecallStatus(options) {
  const content = document.querySelector("#recall-content");
  clearChildren(content);
  content.append(createRecallStatus(options));
}

function createRecallStatus({ icon, title, detail, loading = false }) {
  const status = document.createElement("div");
  status.className = `recall-status${loading ? " is-loading" : ""}`;

  const statusIcon = document.createElement("span");
  statusIcon.className = "recall-status-icon";
  statusIcon.textContent = icon;

  const copy = document.createElement("span");
  copy.className = "recall-status-copy";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const body = document.createElement("span");
  body.textContent = detail;
  copy.append(heading, body);
  status.append(statusIcon, copy);
  return status;
}

function showRecallPanel() {
  const panel = document.querySelector("#recall-panel");
  panel.hidden = false;
}

function hideRecallPanel() {
  const panel = document.querySelector("#recall-panel");
  panel.hidden = true;
  document.querySelector("#search-input").focus();
}

function setRecallBusy(busy) {
  const button = document.querySelector("#recall-button");
  button.setAttribute("aria-busy", String(busy));
}

async function loadPage() {
  if (IS_EXTENSION_CONTEXT) {
    renderContinueLoading("Preparing useful journeys from your recent activity…", "pending");
  }
  const recentItemsPromise = prepareRecentlyClosedItems().then((items) => {
    recentItemsState = items;
    return items;
  });
  const favoritesPromise = renderFavorites();
  const recentRenderPromise = renderRecentlyClosed({ itemsPromise: recentItemsPromise });
  const continueRenderPromise = Promise.all([recentItemsPromise, favoritesPromise])
    .then(() => renderContinueJourneys());

  await Promise.all([recentRenderPromise, continueRenderPromise]);
}

function hasExtensionApis() {
  return Boolean(
    globalThis.chrome &&
      chrome.runtime &&
      typeof chrome.runtime.getURL === "function" &&
      chrome.bookmarks &&
      chrome.history &&
      chrome.sessions &&
      chrome.storage
  );
}

function setHeaderText() {
  const dateLine = document.querySelector("#date-line");
  const greetingLine = document.querySelector("#greeting-line");
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  dateLine.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(now);
  greetingLine.textContent = greeting;
}

async function setupCustomizeControls() {
  const panel = document.querySelector("#customize-panel");
  const toggle = document.querySelector("#customize-toggle");
  const closeButton = document.querySelector("#customize-close");
  const themeButtons = document.querySelectorAll("[data-theme-option]");
  const appearanceButtons = document.querySelectorAll("[data-appearance]");
  const urlInput = document.querySelector("#background-url");
  const saveButton = document.querySelector("#background-save");
  const randomButton = document.querySelector("#background-random");
  const clearButton = document.querySelector("#background-clear");
  const fileInput = document.querySelector("#background-file");

  const [theme, appearance, background] = await Promise.all([
    getStorageValue(THEME_KEY, "classic"),
    getStorageValue(APPEARANCE_KEY, "system"),
    getStorageValue(BACKGROUND_KEY, null),
    getCloudAiConfig({ includeDisabled: true })
  ]);
  applyTheme(theme);
  applyAppearance(appearance);
  applyBackground(background);
  await setupCloudAiControls();

  themeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const theme = normalizeThemeName(button.dataset.themeOption);
      await saveTheme(theme);
      updateSuggestionPalettes(theme);
    });
  });

  appearanceButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const mode = normalizeAppearanceMode(button.dataset.appearance);
      await saveAppearance(mode);
    });
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
    const mode = await getStorageValue(APPEARANCE_KEY, "system");
    if (mode === "system") {
      applyAppearance(mode);
    }
  });

  toggle.addEventListener("click", () => {
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    toggle.setAttribute("aria-expanded", String(nextOpen));
  });

  closeButton.addEventListener("click", () => {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  });

  saveButton.addEventListener("click", async () => {
    const value = urlInput.value.trim();
    if (!isHttpsUrl(value) && !value.startsWith("data:image/")) {
      urlInput.focus();
      return;
    }

    await saveBackground({ type: "url", value });
  });

  randomButton.addEventListener("click", async () => {
    const value = `https://picsum.photos/seed/safarian-${Date.now()}/2400/1600`;
    urlInput.value = value;
    await saveBackground({ type: "service", value });
  });

  clearButton.addEventListener("click", async () => {
    urlInput.value = "";
    await saveBackground(null);
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    const value = await imageFileToDataUrl(file);
    await saveBackground({ type: "upload", value });
    fileInput.value = "";
  });
}

async function setupCloudAiControls() {
  const providerButtons = document.querySelectorAll("[data-ai-provider]");
  const keyInput = document.querySelector("#cloud-ai-key");
  const consentInput = document.querySelector("#cloud-ai-consent");
  const connectButton = document.querySelector("#cloud-ai-connect");
  const replaceButton = document.querySelector("#cloud-ai-replace");
  const forgetButton = document.querySelector("#cloud-ai-forget");
  let isReplacing = false;
  let config = await getCloudAiConfig({ includeDisabled: true });
  const hasCloudAccess = await hasGeminiCloudPermission();

  renderCloudAiControls(config?.enabled && hasCloudAccess ? "cloud" : "local", config);

  providerButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.dataset.aiProvider;

      if (provider === "local") {
        isReplacing = false;
        if (config) {
          config = { ...config, enabled: false };
          try {
            await setCloudAiConfigValue(config);
          } catch (error) {
            setCloudAiStatus(cloudAiSetupErrorMessage(error), "error");
            return;
          }
        }
        renderCloudAiControls("local", config);
        setCloudAiStatus("Using private on-device Gemini Nano.", "ready");
        await refreshAiSectionsForProviderChange();
        return;
      }

      if (config?.apiKey) {
        isReplacing = false;
        renderCloudAiControls("cloud", config);
        try {
          setCloudAiStatus("Waiting for Chrome to allow a direct connection to Google Gemini…", "loading");
          await requestGeminiCloudPermission();
          config = { ...config, enabled: true };
          await setCloudAiConfigValue(config);
        } catch (error) {
          setCloudAiStatus(cloudAiSetupErrorMessage(error), "error");
          return;
        }
        renderCloudAiControls("cloud", config);
        setCloudAiStatus(CLOUD_AI_READY_MESSAGE, "ready");
        await refreshAiSectionsForProviderChange();
        return;
      }

      renderCloudAiControls("cloud", null);
      keyInput.focus();
    });
  });

  replaceButton.addEventListener("click", () => {
    isReplacing = true;
    const keyField = keyInput.closest("label");
    keyField.hidden = false;
    connectButton.hidden = false;
    connectButton.textContent = "Test & replace key";
    replaceButton.hidden = true;
    consentInput.checked = true;
    setCloudAiStatus("Your current key stays active until the replacement passes its test.", "loading");
    keyInput.focus();
  });

  connectButton.addEventListener("click", async () => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      setCloudAiStatus("Paste a Gemini API key to continue.", "error");
      keyInput.focus();
      return;
    }
    if (!consentInput.checked) {
      setCloudAiStatus("Confirm the data disclosure before enabling cloud AI.", "error");
      consentInput.focus();
      return;
    }

    connectButton.disabled = true;
    connectButton.setAttribute("aria-busy", "true");
    connectButton.textContent = "Connecting securely…";
    setCloudAiStatus("Waiting for Chrome to allow a direct connection to Google Gemini…", "loading");

    try {
      await requestGeminiCloudPermission();
      connectButton.textContent = "Testing securely…";
      setCloudAiStatus("Checking the key with Flash-Lite without sending browsing data…", "loading");
      await testGeminiFlashKey(apiKey);
      const nextConfig = {
        enabled: true,
        apiKey,
        keyId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        routingVersion: 2,
        connectedAt: Date.now()
      };
      await setCloudAiConfigValue(nextConfig);
      const savedConfig = await getCloudAiConfig({ includeDisabled: true });
      if (!savedConfig || savedConfig.keyId !== nextConfig.keyId) {
        const storageError = new Error("Chrome did not retain the device-local Gemini key");
        storageError.name = "PersistentStorageError";
        throw storageError;
      }
      config = savedConfig;
      isReplacing = false;
      keyInput.value = "";
      renderCloudAiControls("cloud", config);
      setCloudAiStatus(`Connected and remembered on this device. ${CLOUD_AI_READY_MESSAGE}`, "ready");
      await refreshAiSectionsForProviderChange();
    } catch (error) {
      setCloudAiStatus(cloudAiSetupErrorMessage(error), "error");
    } finally {
      connectButton.disabled = false;
      connectButton.setAttribute("aria-busy", "false");
      connectButton.textContent = isReplacing ? "Test & replace key" : "Test & remember key";
    }
  });

  forgetButton.addEventListener("click", async () => {
    try {
      await setCloudAiConfigValue(null);
    } catch (error) {
      setCloudAiStatus(cloudAiSetupErrorMessage(error), "error");
      return;
    }
    try {
      await removeGeminiCloudPermission();
    } catch (error) {
      console.warn("Unable to remove Gemini host permission", error.message);
    }
    isReplacing = false;
    config = null;
    keyInput.value = "";
    consentInput.checked = false;
    renderCloudAiControls("local", null);
    setCloudAiStatus("Key forgotten. Using on-device Gemini Nano.", "ready");
    await refreshAiSectionsForProviderChange();
  });
}

function renderCloudAiControls(provider, config) {
  const setup = document.querySelector("#cloud-ai-setup");
  const consent = document.querySelector("#cloud-ai-consent");
  const keyField = document.querySelector("#cloud-ai-key").closest("label");
  const consentField = consent.closest("label");
  const connectButton = document.querySelector("#cloud-ai-connect");
  const replaceButton = document.querySelector("#cloud-ai-replace");
  const forgetButton = document.querySelector("#cloud-ai-forget");
  const hasKey = Boolean(config?.apiKey);

  document.querySelectorAll("[data-ai-provider]").forEach((button) => {
    const selected = button.dataset.aiProvider === provider;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  setup.hidden = provider !== "cloud";
  keyField.hidden = hasKey;
  consentField.hidden = hasKey;
  connectButton.hidden = hasKey;
  replaceButton.hidden = !hasKey;
  forgetButton.hidden = !hasKey;
  consent.checked = hasKey;
  consent.disabled = hasKey;
  if (provider === "cloud" && hasKey) {
    setCloudAiStatus(CLOUD_AI_READY_MESSAGE, "ready");
  } else if (provider === "cloud") {
    setCloudAiStatus("Add your key to activate cloud AI.");
  }
}

function setCloudAiStatus(message, state = "") {
  const status = document.querySelector("#cloud-ai-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function cloudAiSetupErrorMessage(error) {
  if (error?.name === "PermissionDeniedError") {
    return "Gemini Flash wasn’t enabled. Allow access to Google’s Gemini API when Chrome asks, or keep using on-device AI.";
  }
  if (error?.name === "PersistentStorageError") {
    return "Chrome couldn’t retain this key in device-local extension storage. Try again or use on-device AI.";
  }
  if (error?.name === "TimeoutError") return "Gemini took too long to respond. Check your connection and try again.";
  if (error?.reason === "API_KEY_INVALID" || error?.status === 401 || error?.status === 403) {
    return "Google rejected this key. Check that it is active and try again.";
  }
  if (error?.status === 429) return "This key has reached its Gemini quota. Try again later or use on-device AI.";
  return "Couldn’t connect to Gemini Flash. Your key was not saved.";
}

async function refreshAiSectionsForProviderChange() {
  recentDisplayMode = "smart";
  continueRenderRequest += 1;
  renderContinueLoading("Switching Continue to your selected AI engine…", "pending");
  await renderRecentlyClosed();
  await renderContinueJourneys();
}

function setupFavoriteContextMenu() {
  const menu = document.querySelector("#favorite-menu");
  const favoritesList = document.querySelector("#favorites-list");
  const favoriteModal = document.querySelector("#favorite-modal");

  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target)) {
      hideFavoriteMenu();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!favoritesEditMode || favoriteDrag) return;
    if (
      favoritesList.contains(event.target) ||
      menu.contains(event.target) ||
      favoriteModal.contains(event.target)
    ) {
      return;
    }

    exitReorderMode();
    void renderFavorites();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cancelFavoriteDrag();
      if (favoritesEditMode) {
        exitReorderMode();
      }
      hideFavoriteMenu();
    }
  });

  document.querySelector("#favorite-menu-open").addEventListener("click", () => {
    const favorite = favoritesState[favoriteMenuIndex];
    if (!favorite) return;
    window.location.href = favorite.url;
  });

  document.querySelector("#favorite-menu-edit").addEventListener("click", () => {
    const index = favoriteMenuIndex;
    hideFavoriteMenu();
    showFavoriteEditor(index);
  });

  document.querySelector("#favorite-menu-remove").addEventListener("click", async () => {
    if (!Number.isInteger(favoriteMenuIndex)) return;
    await removeFavorite(favoriteMenuIndex);
    hideFavoriteMenu();
    await renderFavorites();
  });

  document.querySelector("#favorite-menu-add").addEventListener("click", () => {
    hideFavoriteMenu();
    showFavoriteEditor(null);
  });

  document.querySelector("#favorite-menu-refresh").addEventListener("click", async () => {
    exitReorderMode();
    hideFavoriteMenu();
    await renderFavorites();
  });

  document.querySelector("#favorite-menu-refresh-icon").addEventListener("click", async () => {
    const favorite = favoritesState[favoriteMenuIndex];
    if (!favorite) return;
    hideFavoriteMenu();
    await clearCachedIconForUrl(favorite.url);
    await renderFavorites();
  });
}

function setupBookmarkMirrorListeners() {
  if (!IS_EXTENSION_CONTEXT || !chrome.bookmarks) return;

  const refresh = () => requestFavoritesRefresh();

  chrome.bookmarks.onCreated.addListener(refresh);
  chrome.bookmarks.onChanged.addListener(refresh);
  chrome.bookmarks.onMoved.addListener(refresh);
  chrome.bookmarks.onRemoved.addListener(refresh);
  chrome.bookmarks.onChildrenReordered?.addListener(refresh);
  chrome.bookmarks.onImportEnded?.addListener(refresh);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      requestFavoritesRefresh({ immediate: true });
    }
  });
  window.addEventListener("focus", () => {
    requestFavoritesRefresh({ immediate: true });
  });
}

function requestFavoritesRefresh({ immediate = false } = {}) {
  if (!IS_EXTENSION_CONTEXT) return;

  favoritesRefreshPending = true;
  window.clearTimeout(favoritesRefreshTimeout);
  favoritesRefreshTimeout = window.setTimeout(flushFavoritesRefresh, immediate ? 0 : 120);
}

function flushFavoritesRefresh() {
  favoritesRefreshTimeout = 0;

  if (!favoritesRefreshPending || favoriteDrag) return;

  favoritesRefreshPending = false;
  void renderFavorites();
}

function setupFavoriteEditor() {
  const modal = document.querySelector("#favorite-modal");
  const form = document.querySelector("#favorite-form");
  const titleInput = document.querySelector("#favorite-title-input");
  const urlInput = document.querySelector("#favorite-url-input");
  const cancelButton = document.querySelector("#favorite-cancel");
  const closeButton = document.querySelector("#favorite-cancel-x");

  const close = () => {
    modal.hidden = true;
    editingFavoriteIndex = null;
    form.reset();
  };

  cancelButton.addEventListener("click", close);
  closeButton.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const url = normalizeFavoriteUrl(urlInput.value.trim());

    if (!title || !isHttpUrl(url)) {
      urlInput.focus();
      return;
    }

    if (editingFavoriteIndex === null) {
      await createFavorite({ title, url });
    } else {
      await updateFavorite(editingFavoriteIndex, { title, url });
    }

    close();
    await renderFavorites();
  });
}

function showFavoriteEditor(index) {
  const modal = document.querySelector("#favorite-modal");
  const title = document.querySelector("#favorite-modal-title");
  const titleInput = document.querySelector("#favorite-title-input");
  const urlInput = document.querySelector("#favorite-url-input");
  const favorite = index === null ? null : favoritesState[index];

  editingFavoriteIndex = index;
  title.textContent = favorite ? "Edit Favorite" : "Add Favorite";
  titleInput.value = favorite ? favorite.title : "";
  urlInput.value = favorite ? favorite.url : "";
  modal.hidden = false;
  titleInput.focus();
}

function showFavoriteMenu(event, index) {
  event.preventDefault();
  const menu = document.querySelector("#favorite-menu");

  favoriteMenuIndex = index;
  menu.hidden = false;

  const padding = 10;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(event.clientX, window.innerWidth - rect.width - padding);
  const top = Math.min(event.clientY, window.innerHeight - rect.height - padding);
  menu.style.left = `${Math.max(padding, left)}px`;
  menu.style.top = `${Math.max(padding, top)}px`;
}

function hideFavoriteMenu() {
  const menu = document.querySelector("#favorite-menu");
  menu.hidden = true;
  favoriteMenuIndex = null;
}

async function applyStoredTheme() {
  const theme = await getStorageValue(THEME_KEY, "classic");
  applyTheme(theme);
}

async function saveTheme(theme) {
  const normalized = normalizeThemeName(theme);
  await setStorageValue(THEME_KEY, normalized);
  applyTheme(normalized);
}

function applyTheme(theme) {
  const normalized = normalizeThemeName(theme);
  document.documentElement.dataset.themeName = normalized;
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    const selected = button.dataset.themeOption === normalized;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function normalizeThemeName(theme) {
  return VALID_THEMES.includes(theme) ? theme : "classic";
}

function updateSuggestionPalettes(themeName) {
  const normalized = normalizeThemeName(themeName);
  const activePalette = themePalettes[normalized] || themePalettes.classic;
  const cards = document.querySelectorAll(".journey-card");
  cards.forEach((card, index) => {
    const colors = activePalette[index % activePalette.length];
    if (colors) {
      card.style.setProperty("--card-start", colors[0]);
      card.style.setProperty("--card-end", colors[1]);
    }
  });
}

async function applyStoredAppearance() {
  const mode = await getStorageValue(APPEARANCE_KEY, "system");
  applyAppearance(mode);
}

async function saveAppearance(mode) {
  const normalized = normalizeAppearanceMode(mode);
  await setStorageValue(APPEARANCE_KEY, normalized);
  applyAppearance(normalized);
}

function applyAppearance(mode) {
  const normalized = normalizeAppearanceMode(mode);
  const resolved = normalized === "system" && prefersDarkMode() ? "dark" : normalized === "dark" ? "dark" : "light";

  document.documentElement.dataset.appearanceMode = normalized;
  document.documentElement.dataset.theme = resolved;
  document.querySelectorAll("[data-appearance]").forEach((button) => {
    const selected = button.dataset.appearance === normalized;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function normalizeAppearanceMode(mode) {
  return ["system", "light", "dark"].includes(mode) ? mode : "system";
}

function prefersDarkMode() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

async function applyStoredBackground() {
  const background = await getStorageValue(BACKGROUND_KEY, null);
  applyBackground(background);
}

async function saveBackground(background) {
  await setStorageValue(BACKGROUND_KEY, background);
  applyBackground(background);
}

function applyBackground(background) {
  const layer = document.querySelector("#background-layer");
  const urlInput = document.querySelector("#background-url");

  if (!background || !background.value) {
    document.body.classList.remove("has-background");
    layer.style.backgroundImage = "";
    return;
  }

  document.body.classList.add("has-background");
  layer.style.backgroundImage = `url("${cssEscapeUrl(background.value)}")`;

  if (urlInput && background.type !== "upload") {
    urlInput.value = background.value;
  }
}

function cssEscapeUrl(value) {
  return String(value).replace(/["\\\n\r]/g, "");
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", reject);
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("error", reject);
      image.addEventListener("load", () => {
        const maxWidth = 1920;
        const maxHeight = 1280;
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      });
      image.src = reader.result;
    });
    reader.readAsDataURL(file);
  });
}

async function renderRecentlyClosed({ forceOrganize = false, downloadIntent = null, itemsPromise = null } = {}) {
  const request = ++recentRenderRequest;
  const allowDownload = Boolean(
    forceOrganize &&
    downloadIntent &&
    downloadIntent === recentNanoDownloadIntent
  );
  const recentList = document.querySelector("#recent-list");
  const preserveExistingGroups = Boolean(
    !forceOrganize &&
    recentDisplayMode === "smart" &&
    recentList.classList.contains("recent-grid-organized") &&
    recentList.childElementCount
  );
  if (!preserveExistingGroups) clearChildren(recentList);

  const items = await (itemsPromise || prepareRecentlyClosedItems());

  if (request !== recentRenderRequest) return;

  recentItemsState = items;
  updateRecentControls(items);

  if (items.length === 0) {
    clearChildren(recentList);
    renderEmptyPills(recentList);
    return;
  }

  if (!preserveExistingGroups) renderRecentChronological(recentList, items.slice(0, MAX_RECENT));

  if (SHOW_AI_LOADING_PREVIEW) {
    setRecentOrganizationBusy(true, "AI is reviewing your closed tabs…");
    return;
  }

  if (!IS_EXTENSION_CONTEXT) {
    recentDisplayMode = "recent";
    updateRecentControls(items);
    setRecentOrganizationNote("Preview data");
    return;
  }

  const organizableItems = items.filter((item) => isHttpUrl(item.url)).slice(0, MAX_RECENT_ORGANIZER_CANDIDATES);
  if (recentDisplayMode !== "smart" || organizableItems.length < 3) return;

  const [cloudConfig, cached] = await Promise.all([
    getCloudAiConfig(),
    getStorageValue(RECENT_ORGANIZATION_CACHE_KEY, null)
  ]);
  const fingerprint = recentOrganizationFingerprint(
    organizableItems,
    aiProviderCacheKey(cloudConfig, RECENT_CLOUD_MODEL)
  );
  const fullRefreshClaim = forceOrganize || !cloudFullReviewDue(cached)
    ? null
    : await claimCloudFullRefresh("recent", cloudConfig);
  if (request !== recentRenderRequest) {
    await completeCloudFullRefresh(fullRefreshClaim, "superseded");
    return;
  }
  const cachedGroups = hydrateRecentOrganization(cached, fingerprint, organizableItems);

  if (cachedGroups.length && !forceOrganize && !fullRefreshClaim) {
    renderOrganizedRecent(recentList, cachedGroups, items.length, cached.provider || "local", cached.fullReviewAt);
    return;
  }

  if (cloudConfig && !forceOrganize && !fullRefreshClaim) {
    const existingGroups = hydrateRecentIncrementalGroups(cached, organizableItems);
    if (existingGroups.length) {
      renderOrganizedRecent(
        recentList,
        existingGroups,
        items.length,
        cached.provider || "cloud",
        cached.fullReviewAt || cached.createdAt
      );
      setRecentOrganizationBusy(true, "Updating with new tabs · existing groups stay available.");
    }
    let incremental;
    let incrementalFailed = false;
    try {
      incremental = await updateRecentOrganizationIncrementally(cached, organizableItems, fingerprint);
    } catch (error) {
      incrementalFailed = true;
      console.warn("Gemini recent-tab incremental update failed", describeGeminiError(error));
      incremental = existingGroups.length
        ? {
          groups: existingGroups,
          provider: cached.provider || "cloud",
          fullReviewAt: cached.fullReviewAt || cached.createdAt
        }
        : null;
    } finally {
      if (request === recentRenderRequest && existingGroups.length) setRecentOrganizationBusy(false);
    }
    if (request !== recentRenderRequest) return;
    if (incremental?.groups?.length) {
      renderOrganizedRecent(
        recentList,
        incremental.groups,
        items.length,
        incremental.provider,
        incremental.fullReviewAt
      );
      if (incrementalFailed) {
        setRecentOrganizationNote("Showing the last review · local update will retry.", "ready");
      }
      return;
    }
    recentDisplayMode = "recent";
    updateRecentControls(items);
    setRecentOrganizationNote("Recent order · waiting for the next full Flash review.");
    return;
  }

  setRecentOrganizationBusy(true, cloudConfig
    ? "Gemini Flash-Lite is reviewing your closed tabs…"
    : "On-device AI is reviewing your closed tabs…");
  let result;
  try {
    result = await runRateLimitedAiTask({
      feature: "recent",
      fingerprint,
      force: forceOrganize || Boolean(fullRefreshClaim),
      loadCached: async () => {
        const latestCache = await getStorageValue(RECENT_ORGANIZATION_CACHE_KEY, null);
        const groups = hydrateRecentOrganization(latestCache, fingerprint, organizableItems);
        return groups.length
          ? {
            status: "success",
            groups,
            provider: latestCache.provider || "local",
            fullReviewAt: latestCache.fullReviewAt
          }
          : null;
      },
      saveSuccess: (success) => setStorageValue(
        RECENT_ORGANIZATION_CACHE_KEY,
        serializeRecentOrganization(
          fingerprint,
          success.groups,
          success.provider,
          success.fallbackFromCloud,
          organizableItems,
          success.fullReviewAt || (success.provider === "cloud" ? Date.now() : null)
        )
      ),
      task: () => generateRecentOrganization(organizableItems, {
        allowDownload,
        cloudConfig,
        onStatus: (message) => setRecentOrganizationNote(message, "loading")
      })
    });
  } catch (error) {
    console.warn("Gemini recent-tab orchestration failed", describeGeminiError(error));
    resetBrowserOrganizerSession();
    result = { status: "error", groups: [] };
  } finally {
    await completeCloudFullRefresh(fullRefreshClaim, result?.provider || result?.status || "error");
  }
  if (request !== recentRenderRequest) return;

  setRecentOrganizationBusy(false);

  if (result.status === "success" && result.groups.length) {
    renderOrganizedRecent(
      recentList,
      result.groups,
      items.length,
      result.provider || "local",
      result.fullReviewAt || (fullRefreshClaim ? Date.now() : null)
    );
    return;
  }

  if (result.status === "needs-user") {
    recentDisplayMode = "recent";
    updateRecentControls(items);
    setRecentOrganizationNote("Select Organize to finish setting up on-device Gemini.");
  } else if (result.status === "unavailable") {
    recentDisplayMode = "recent";
    updateRecentControls(items);
    setRecentOrganizationNote("Gemini is unavailable here; showing recent order.");
  } else if (result.status === "throttled") {
    recentDisplayMode = "recent";
    updateRecentControls(items);
    setRecentOrganizationNote("Recent order · AI will retry when this activity changes.");
  } else {
    recentDisplayMode = "recent";
    updateRecentControls(items);
    setRecentOrganizationNote("Couldn’t organize this set; showing recent order.");
  }
}

function renderRecentChronological(container, items) {
  container.className = "recent-grid";
  clearChildren(container);
  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.append(createRecentButton(item)));
  container.append(fragment);
}

function renderOrganizedRecent(container, groups, totalItemCount, provider = "local", fullReviewAt = null) {
  container.className = "recent-grid recent-grid-organized";
  clearChildren(container);
  const fragment = document.createDocumentFragment();

  groups.forEach((group, groupIndex) => {
    const section = document.createElement("section");
    section.className = "recent-group";

    const header = document.createElement("div");
    header.className = "recent-group-header";

    const label = document.createElement("h3");
    label.textContent = group.label;

    const count = document.createElement("span");
    count.textContent = String(group.items.length);
    count.setAttribute("aria-label", `${group.items.length} tabs`);

    header.append(label, count);
    section.append(header);

    group.items.forEach((entry, itemIndex) => {
      section.append(createRecentButton(entry.item, {
        reason: entry.reason,
        topPick: groupIndex === 0 && itemIndex === 0
      }));
    });
    fragment.append(section);
  });
  container.append(fragment);

  updateRecentControls(recentItemsState);
  const source = provider === "cloud"
    ? "Full review by Gemini Flash"
    : provider === "hybrid"
      ? "Updated locally after Flash review"
      : "Organized privately on-device";
  const reviewAge = fullReviewAt ? ` · full review ${relativeTime(fullReviewAt).toLocaleLowerCase()}` : "";
  setRecentOrganizationNote(
    `${source}${reviewAge} · ${groups.reduce((sum, group) => sum + group.items.length, 0)} picks from ${totalItemCount}`,
    "ready"
  );
}

function createRecentButton(item, { reason = "", topPick = false } = {}) {
  const button = document.createElement("button");
  button.className = `recent-pill${topPick ? " is-top-pick" : ""}`;
  button.type = "button";
  button.title = reason ? `${item.title}\n${reason}` : item.title;

  const iconWrap = document.createElement("div");
  iconWrap.className = "recent-pill-icon-wrap";

  if (item.url && !item.url.startsWith("chrome://newtab")) {
    const img = document.createElement("img");
    img.className = "recent-pill-icon";
    img.alt = "";
    img.loading = "lazy";
    loadIconSources(img, item.url, 64, () => {
      img.remove();
      iconWrap.textContent = initialFor(item.title, item.url);
      iconWrap.style.setProperty("--fallback-bg", iconColorFor(item.title, item.url));
      iconWrap.classList.add("icon-fallback");
    });
    iconWrap.append(img);
  } else {
    iconWrap.textContent = initialFor(item.title, item.url);
    iconWrap.style.setProperty("--fallback-bg", iconColorFor(item.title, item.url));
    iconWrap.classList.add("icon-fallback");
  }
  button.append(iconWrap);

  const content = document.createElement("div");
  content.className = "recent-pill-content";

  const title = document.createElement("span");
  title.className = "recent-pill-title";
  title.textContent = readableTitle(item.title, item.url) || hostnameFor(item.url) || "Closed Tab";

  const meta = document.createElement("span");
  meta.className = "recent-pill-meta";
  const host = hostnameFor(item.url);
  const time = item.lastModified ? relativeTime(item.lastModified) : "";
  meta.textContent = reason ? reason : (host ? (time ? `${host} · ${time}` : host) : time);

  content.append(title, meta);
  button.append(content);

  if (topPick) {
    const badge = document.createElement("span");
    badge.className = "recent-top-pick";
    badge.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 3c.7 5 4 8.3 9 9-5 .7-8.3 4-9 9-.7-5-4-8.3-9-9 5-.7 8.3-4 9-9Z"></path></svg><span>Top pick</span>`;
    button.append(badge);
  } else {
    const arrow = document.createElement("span");
    arrow.className = "recent-pill-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = `<svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    button.append(arrow);
  }

  button.addEventListener("click", () => {
    if (IS_EXTENSION_CONTEXT && !item.sessionId.startsWith("preview-")) {
      chrome.sessions.restore(item.sessionId);
      return;
    }
    window.location.href = item.url;
  });
  return button;
}

function updateRecentControls(items) {
  const clearButton = document.querySelector("#clear-recent");
  const organizeButton = document.querySelector("#recent-organize");
  const refreshButton = document.querySelector("#recent-ai-refresh");
  const busy = document.querySelector(".section-recent").classList.contains("is-ai-working");
  const organizeLabel = organizeButton.querySelector("span");
  const hasItems = items.length > 0;

  clearButton.hidden = !hasItems;
  organizeButton.hidden = items.length < 3;
  refreshButton.hidden = items.length < 3;
  clearButton.disabled = busy;
  organizeButton.disabled = busy;
  refreshButton.disabled = busy;
  organizeButton.setAttribute("aria-busy", String(busy));
  organizeButton.setAttribute("aria-pressed", String(recentDisplayMode === "smart"));
  organizeButton.setAttribute("aria-label", busy
    ? "AI is organizing recently closed tabs"
    : recentDisplayMode === "smart"
      ? "Show recently closed tabs in chronological order"
      : "Organize recently closed tabs with AI");
  organizeLabel.textContent = busy
    ? "AI working"
    : recentDisplayMode === "smart" ? "Recent order" : "Organize";
  organizeButton.title = recentDisplayMode === "smart"
    ? "Return to Chrome's chronological order"
    : "Group and rank recently closed tabs with AI";

  if (!hasItems || recentDisplayMode === "recent") {
    setRecentOrganizationNote("");
  }
}

function setRecentRefreshBusy(busy) {
  const button = document.querySelector("#recent-ai-refresh");
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.setAttribute("aria-label", busy ? "Refreshing AI for recently closed tabs" : "Refresh AI for recently closed tabs");
  button.querySelector("span").textContent = busy ? "Refreshing…" : "Refresh AI";
}

function setRecentOrganizationBusy(busy, note = "") {
  const button = document.querySelector("#recent-organize");
  const clearButton = document.querySelector("#clear-recent");
  const section = document.querySelector(".section-recent");
  const list = document.querySelector("#recent-list");
  button.setAttribute("aria-busy", String(busy));
  button.disabled = busy;
  clearButton.disabled = busy;
  section.classList.toggle("is-ai-working", busy);
  list.setAttribute("aria-busy", String(busy));
  setRecentRefreshBusy(busy);
  if (busy) button.querySelector("span").textContent = "AI working";
  if (!busy) updateRecentControls(recentItemsState);
  if (note) setRecentOrganizationNote(note, busy ? "loading" : "");
}

function setRecentOrganizationNote(message, state = "") {
  const note = document.querySelector("#recent-mode-note");
  note.textContent = message;
  note.dataset.state = state;
  note.hidden = !message;
}

function recentOrganizationFingerprint(items, providerKey = "nano") {
  return `${providerKey}|${items.map((item) => `${item.sessionId}:${item.lastModified}`).join("|")}`;
}

function hydrateRecentOrganization(cache, fingerprint, items) {
  if (
    !cache ||
    cache.incrementalCacheVersion !== INCREMENTAL_CACHE_VERSION ||
    cache.fingerprint !== fingerprint ||
    !Array.isArray(cache.groups)
  ) return [];
  const ttl = cache.fallbackFromCloud ? CLOUD_FALLBACK_CACHE_TTL : RECENT_ORGANIZATION_CACHE_TTL;
  if (Date.now() - Number(cache.createdAt || 0) > ttl) return [];

  return hydrateRecentGroupsData(cache.groups, items);
}

function hydrateRecentGroupsData(groups, items) {
  const bySessionId = new Map(items.map((item) => [item.sessionId, item]));
  return (Array.isArray(groups) ? groups : [])
    .map((group) => ({
      label: shortTitle(String(group.label || "Related tabs"), 28),
      items: (Array.isArray(group.items) ? group.items : [])
        .map((entry) => ({
          item: bySessionId.get(entry.sessionId),
          reason: shortTitle(String(entry.reason || "Related work"), 100)
        }))
        .filter((entry) => entry.item)
        .slice(0, 3)
    }))
    .filter((group) => group.items.length)
    .slice(0, 3);
}

function serializeRecentOrganization(
  fingerprint,
  groups,
  provider = "local",
  fallbackFromCloud = false,
  candidates = [],
  fullReviewAt = null,
  fullReviewGroups = null
) {
  const serializedGroups = serializeRecentGroupsData(groups);
  const serializedFullReviewGroups = Array.isArray(fullReviewGroups)
    ? serializeRecentGroupsData(fullReviewGroups)
    : provider === "cloud"
      ? serializedGroups
      : null;
  return {
    incrementalCacheVersion: INCREMENTAL_CACHE_VERSION,
    fingerprint,
    provider,
    fallbackFromCloud,
    fullReviewAt: Number(fullReviewAt || 0) || null,
    candidateIds: candidates.map((item) => item.sessionId),
    createdAt: Date.now(),
    groups: serializedGroups,
    fullReviewGroups: serializedFullReviewGroups
  };
}

function serializeRecentGroupsData(groups) {
  return groups.map((group) => ({
      label: group.label,
      items: group.items.map((entry) => ({
        sessionId: entry.item.sessionId,
        reason: entry.reason
      }))
    }));
}

function hydrateRecentOrganizationLoose(cache, items) {
  if (
    !cache ||
    cache.incrementalCacheVersion !== INCREMENTAL_CACHE_VERSION ||
    !Array.isArray(cache.groups)
  ) return [];
  const ttl = cache.fallbackFromCloud ? CLOUD_FALLBACK_CACHE_TTL : INCREMENTAL_BASELINE_TTL;
  if (Date.now() - Number(cache.createdAt || 0) > ttl) return [];
  const compatibleCache = {
    ...cache,
    fingerprint: "incremental",
    createdAt: Date.now(),
    fallbackFromCloud: false
  };
  return hydrateRecentOrganization(compatibleCache, "incremental", items);
}

function hydrateRecentIncrementalGroups(cache, items) {
  const currentGroups = hydrateRecentOrganizationLoose(cache, items);
  const fullReviewGroups = hydrateRecentGroupsData(cache?.fullReviewGroups, items);
  return mergeRecentGroupPatch(fullReviewGroups, currentGroups);
}

async function updateRecentOrganizationIncrementally(cache, items, fingerprint) {
  const fullReviewGroups = hydrateRecentGroupsData(cache?.fullReviewGroups, items);
  const existingGroups = hydrateRecentIncrementalGroups(cache, items);
  if (!existingGroups.length) return null;

  const baselineIds = new Set(Array.isArray(cache.candidateIds) ? cache.candidateIds : []);
  const newItems = items.filter((item) => !baselineIds.has(item.sessionId));
  if (!newItems.length) {
    return {
      groups: existingGroups,
      provider: cache.provider || "cloud",
      fullReviewAt: cache.fullReviewAt || cache.createdAt
    };
  }

  const result = await runRateLimitedAiTask({
    feature: "recent-incremental",
    fingerprint,
    loadCached: async () => {
      const latest = await getStorageValue(RECENT_ORGANIZATION_CACHE_KEY, null);
      const groups = hydrateRecentOrganization(latest, fingerprint, items);
      return groups.length
        ? { status: "success", groups, provider: latest.provider || "hybrid", fullReviewAt: latest.fullReviewAt }
        : null;
    },
    saveSuccess: (success) => setStorageValue(
      RECENT_ORGANIZATION_CACHE_KEY,
      serializeRecentOrganization(
        fingerprint,
        success.groups,
        "hybrid",
        false,
        items,
        cache.fullReviewAt || cache.createdAt,
        fullReviewGroups.length ? fullReviewGroups : existingGroups
      )
    ),
    task: async () => {
      const sessionResult = await getBrowserOrganizerSession({ allowDownload: false });
      if (sessionResult.status !== "success") return { status: sessionResult.status, groups: [] };
      setRecentOrganizationNote(`On-device AI is reviewing ${newItems.length} new tab${newItems.length === 1 ? "" : "s"}…`, "loading");
      const patchGroups = await runBrowserOrganizerPrompt(
        sessionResult.session,
        (session) => patchRecentSessionsWithGemini(session, existingGroups, newItems, items)
      );
      const groups = mergeRecentGroupPatch(existingGroups, patchGroups);
      return {
        status: groups.length ? "success" : "empty",
        groups,
        provider: "hybrid",
        fullReviewAt: cache.fullReviewAt || cache.createdAt
      };
    }
  });

  if (result.status === "success" && result.groups.length) return result;
  const newGroup = {
    label: "New since review",
    items: newItems.slice(0, 3).map((item) => ({ item, reason: "Closed since the last full review" }))
  };
  return {
    groups: [newGroup, ...existingGroups].filter((group) => group.items.length).slice(0, 3),
    provider: cache.provider || "cloud",
    fullReviewAt: cache.fullReviewAt || cache.createdAt
  };
}

function mergeRecentGroupPatch(existingGroups, patchGroups) {
  const existing = Array.isArray(existingGroups) ? existingGroups : [];
  const patches = Array.isArray(patchGroups) ? patchGroups.filter((group) => group.items?.length) : [];
  if (!existing.length) return patches.slice(0, 3);
  if (!patches.length) return existing.slice(0, 3);

  const usedPatches = new Set();
  const merged = existing.map((group) => {
    const existingIds = new Set(group.items.map((entry) => entry.item.sessionId));
    const patchIndex = patches.findIndex((patch, index) => {
      if (usedPatches.has(index)) return false;
      if (normalizeRecallText(patch.label) === normalizeRecallText(group.label)) return true;
      return patch.items.some((entry) => existingIds.has(entry.item.sessionId));
    });
    if (patchIndex < 0) return group;
    usedPatches.add(patchIndex);
    return patches[patchIndex];
  });

  patches.forEach((patch, index) => {
    if (usedPatches.has(index)) return;
    if (merged.length < 3) merged.push(patch);
    else merged[merged.length - 1] = patch;
  });

  const seen = new Set();
  return merged
    .map((group) => ({
      ...group,
      items: group.items.filter((entry) => {
        const id = entry.item.sessionId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 3)
    }))
    .filter((group) => group.items.length)
    .slice(0, 3);
}

async function runRateLimitedAiTask({
  feature,
  fingerprint,
  force = false,
  loadCached,
  saveSuccess,
  task
}) {
  return withBrowserAiLock(async () => {
    if (!force && loadCached) {
      const cachedResult = await loadCached();
      if (cachedResult) return { ...cachedResult, source: "cache" };
    }

    const attemptState = await getStorageValue(AI_ATTEMPT_STATE_KEY, {});
    const previous = attemptState?.[feature];
    const now = Date.now();
    if (
      !force &&
      previous?.status !== "running" &&
      previous?.fingerprint === fingerprint &&
      Number(previous.retryAt || 0) > now
    ) {
      return {
        status: "throttled",
        retryAt: Number(previous.retryAt),
        previousStatus: previous.status || "recent-attempt"
      };
    }

    const previousFailureCount = previous?.fingerprint === fingerprint
      ? Number(previous.failureCount || 0)
      : 0;
    await writeAiAttemptState(attemptState, feature, {
      fingerprint,
      status: "running",
      attemptedAt: now,
      retryAt: now + 2 * 60 * 1000,
      failureCount: previousFailureCount
    });

    let result;
    try {
      result = await task();
    } catch (error) {
      const failureCount = previousFailureCount + 1;
      await writeAiAttemptState(await getStorageValue(AI_ATTEMPT_STATE_KEY, {}), feature, {
        fingerprint,
        status: "error",
        attemptedAt: Date.now(),
        retryAt: Date.now() + aiRetryDelay("error", feature, failureCount),
        failureCount
      });
      throw error;
    }

    if (result.status === "success") {
      try {
        if (saveSuccess) await saveSuccess(result);
        await clearAiAttemptState(feature);
        return result;
      } catch (error) {
        const failureCount = previousFailureCount + 1;
        await writeAiAttemptState(await getStorageValue(AI_ATTEMPT_STATE_KEY, {}), feature, {
          fingerprint,
          status: "error",
          attemptedAt: Date.now(),
          retryAt: Date.now() + aiRetryDelay("error", feature, failureCount),
          failureCount
        });
        throw error;
      }
    }

    const failureCount = result.status === "error" ? previousFailureCount + 1 : 0;
    await writeAiAttemptState(await getStorageValue(AI_ATTEMPT_STATE_KEY, {}), feature, {
      fingerprint,
      status: result.status,
      attemptedAt: Date.now(),
      retryAt: Date.now() + aiRetryDelay(result.status, feature, failureCount),
      failureCount
    });
    return result;
  });
}

function withBrowserAiLock(task) {
  if (!IS_EXTENSION_CONTEXT || !navigator.locks?.request) return task();
  return navigator.locks.request(AI_ORGANIZER_LOCK_NAME, { mode: "exclusive" }, task);
}

function aiRetryDelay(status, feature, failureCount = 0) {
  if (status === "empty") {
    return feature === "continue" ? 6 * 60 * 60 * 1000 : 60 * 60 * 1000;
  }
  if (status === "needs-user") return 15 * 60 * 1000;
  if (status === "unavailable") return 60 * 60 * 1000;
  if (status === "error") {
    const exponent = Math.max(0, Math.min(4, failureCount - 1));
    return Math.min(2 * 60 * 60 * 1000, 5 * 60 * 1000 * (3 ** exponent));
  }
  return 15 * 60 * 1000;
}

async function writeAiAttemptState(currentState, feature, attempt) {
  const nextState = currentState && typeof currentState === "object" ? { ...currentState } : {};
  nextState[feature] = attempt;
  await setStorageValue(AI_ATTEMPT_STATE_KEY, nextState);
}

async function clearAiAttemptState(feature) {
  const currentState = await getStorageValue(AI_ATTEMPT_STATE_KEY, {});
  if (!currentState || typeof currentState !== "object" || !currentState[feature]) return;
  const nextState = { ...currentState };
  delete nextState[feature];
  await setStorageValue(AI_ATTEMPT_STATE_KEY, nextState);
}

function getBrowserOrganizerSession({ allowDownload, onStatus = () => {} }) {
  if (browserOrganizerSession) {
    return Promise.resolve({ status: "success", session: browserOrganizerSession });
  }

  if (!browserOrganizerSessionPromise) {
    browserOrganizerSessionPromise = createBrowserOrganizerSession({ allowDownload, onStatus })
      .then((result) => {
        if (result.status === "success") {
          browserOrganizerSession = result.session;
        } else {
          browserOrganizerSessionPromise = null;
        }
        return result;
      });
  }

  return browserOrganizerSessionPromise.then((result) => {
    if (allowDownload && result.status === "needs-user") {
      browserOrganizerSessionPromise = null;
      return getBrowserOrganizerSession({ allowDownload: true, onStatus });
    }
    return result;
  });
}

async function createBrowserOrganizerSession({ allowDownload, onStatus }) {
  if (!globalThis.LanguageModel || typeof LanguageModel.availability !== "function") {
    return { status: "unavailable", session: null };
  }

  try {
    const availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
    if (availability === "unavailable") return { status: "unavailable", session: null };
    if ((availability === "downloadable" || availability === "downloading") && !allowDownload) {
      return { status: "needs-user", session: null };
    }
    const isModelDownload = availability === "downloadable" || availability === "downloading";

    const session = await LanguageModel.create({
      ...LANGUAGE_MODEL_OPTIONS,
      initialPrompts: [{
        role: "system",
        content: "You organize real browser activity into useful task groups. You never invent pages or sessions."
      }],
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          const progress = Math.max(0, Math.min(100, Math.round(event.loaded * 100)));
          onStatus(isModelDownload
            ? (progress < 100
              ? `Downloading on-device Gemini · ${progress}%`
              : "Finishing the on-device Gemini download…")
            : "Loading the available on-device Gemini model…");
        });
      }
    });
    return { status: "success", session };
  } catch (error) {
    console.warn("Chrome built-in Gemini organizer session failed", error);
    return { status: "error", session: null };
  }
}

async function generateRecentOrganization(items, { allowDownload, cloudConfig, onStatus }) {
  let fallbackFromCloud = false;
  if (cloudConfig) {
    try {
      onStatus("Gemini Flash-Lite is ranking the best tabs to resume…");
      const groups = await rankRecentSessionsWithGemini(
        createGeminiFlashPromptSession(cloudConfig, RECENT_CLOUD_MODEL),
        items
      );
      setCloudAiStatus(CLOUD_AI_READY_MESSAGE, "ready");
      return {
        status: groups.length ? "success" : "empty",
        groups,
        provider: "cloud",
        fullReviewAt: Date.now()
      };
    } catch (error) {
      fallbackFromCloud = true;
      console.warn("Gemini Flash tab organization failed", describeGeminiError(error));
      setCloudAiStatus("Flash was unavailable, so Safarian used on-device AI for this request.", "warning");
      onStatus("Flash is unavailable · finishing privately on-device…");
    }
  }

  const sessionResult = await getBrowserOrganizerSession({ allowDownload, onStatus });
  if (sessionResult.status !== "success") {
    return { status: sessionResult.status, groups: [] };
  }

  try {
    onStatus("AI is ranking and grouping the best tabs to resume…");
    const groups = await runBrowserOrganizerPrompt(
      sessionResult.session,
      (promptSession) => rankRecentSessionsWithGemini(promptSession, items)
    );
    return { status: groups.length ? "success" : "empty", groups, provider: "local", fallbackFromCloud };
  } catch (error) {
    console.warn("Chrome built-in Gemini tab organization failed", describeGeminiError(error));
    resetBrowserOrganizerSession();
    return { status: "error", groups: [] };
  }
}

function createGeminiFlashPromptSession(config, model) {
  return {
    prompt(prompt, options = {}) {
      return promptGeminiFlash(config.apiKey, model, prompt, options.responseConstraint);
    }
  };
}

function setupCloudAiPermissionInvalidation() {
  if (!IS_EXTENSION_CONTEXT || !chrome.permissions) return;
  const invalidate = () => {
    geminiHostPermissionState = null;
    geminiHostPermissionReadPromise = null;
  };
  chrome.permissions.onAdded?.addListener(invalidate);
  chrome.permissions.onRemoved?.addListener(invalidate);
}

function hasGeminiCloudPermission() {
  if (!IS_EXTENSION_CONTEXT || !chrome.permissions?.contains) return Promise.resolve(true);
  if (geminiHostPermissionState !== null) return Promise.resolve(geminiHostPermissionState);
  if (geminiHostPermissionReadPromise) return geminiHostPermissionReadPromise;

  geminiHostPermissionReadPromise = new Promise((resolve) => {
    chrome.permissions.contains({ origins: [GEMINI_HOST_PERMISSION] }, (granted) => {
      const error = chrome.runtime.lastError;
      if (error) console.warn("Unable to read Gemini host permission", error.message);
      geminiHostPermissionState = !error && Boolean(granted);
      resolve(geminiHostPermissionState);
    });
  }).finally(() => {
    geminiHostPermissionReadPromise = null;
  });
  return geminiHostPermissionReadPromise;
}

function requestGeminiCloudPermission() {
  if (!IS_EXTENSION_CONTEXT || !chrome.permissions?.request) return Promise.resolve(true);

  return new Promise((resolve, reject) => {
    chrome.permissions.request({ origins: [GEMINI_HOST_PERMISSION] }, (granted) => {
      const error = chrome.runtime.lastError;
      if (error) {
        const permissionError = new Error(error.message);
        permissionError.name = "PermissionDeniedError";
        reject(permissionError);
        return;
      }
      geminiHostPermissionState = Boolean(granted);
      if (!granted) {
        const permissionError = new Error("Gemini host access was not granted");
        permissionError.name = "PermissionDeniedError";
        reject(permissionError);
        return;
      }
      resolve(true);
    });
  });
}

function removeGeminiCloudPermission() {
  if (!IS_EXTENSION_CONTEXT || !chrome.permissions?.remove) return Promise.resolve(true);

  return new Promise((resolve, reject) => {
    chrome.permissions.remove({ origins: [GEMINI_HOST_PERMISSION] }, (removed) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      geminiHostPermissionState = false;
      resolve(Boolean(removed));
    });
  });
}

async function testGeminiFlashKey(apiKey) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["ok"],
    properties: { ok: { type: "boolean" } }
  };
  const response = await promptGeminiFlash(
    apiKey,
    RECENT_CLOUD_MODEL,
    'Return {"ok":true}. This is a connection test; no user data is included.',
    schema,
    32
  );
  const parsed = parseGeminiJson(response);
  if (parsed.ok !== true) throw new Error("Gemini connection test returned an invalid response");
}

async function promptGeminiFlash(apiKey, model, prompt, schema, maxOutputTokens = 512) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT);

  try {
    const response = await fetch(GEMINI_INTERACTIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model,
        input: prompt,
        system_instruction: "Organize only the real browser items supplied by the user. Never invent pages, URLs, or IDs.",
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema
        },
        generation_config: {
          max_output_tokens: maxOutputTokens,
          thinking_level: model === CONTINUE_CLOUD_MODEL ? "low" : "minimal",
          thinking_summaries: "none"
        },
        store: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      let reason = "";
      try {
        const failure = await response.json();
        const details = Array.isArray(failure) ? failure[0]?.error?.details : failure?.error?.details;
        reason = Array.isArray(details)
          ? String(details.find((detail) => detail?.reason)?.reason || "")
          : "";
      } catch {
        // Status alone is enough to choose a safe fallback.
      }
      const error = new Error(`Gemini Flash request failed with status ${response.status}`);
      error.name = "GeminiCloudError";
      error.status = response.status;
      error.reason = reason;
      throw error;
    }

    const data = await response.json();
    const text = (Array.isArray(data.steps) ? data.steps : [])
      .filter((step) => step?.type === "model_output")
      .flatMap((step) => Array.isArray(step.content) ? step.content : [])
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    if (!text) throw new Error("Gemini Flash returned no text output");
    return text;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Gemini Flash request timed out");
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getCloudAiConfig({ includeDisabled = false } = {}) {
  const config = await getCloudAiConfigValue();
  if (!config || typeof config.apiKey !== "string" || !config.apiKey.trim() || !config.keyId) return null;
  if (!includeDisabled && config.enabled !== true) return null;
  if (!includeDisabled && !(await hasGeminiCloudPermission())) return null;
  return config;
}

function cloudFullReviewDue(cache) {
  if (cache?.incrementalCacheVersion !== INCREMENTAL_CACHE_VERSION) return true;
  const lastFullReview = Number(cache?.fullReviewAt || 0);
  return !lastFullReview || Date.now() - lastFullReview >= CLOUD_FULL_REVIEW_MIN_INTERVAL;
}

async function claimCloudFullRefresh(feature, cloudConfig) {
  if (!cloudConfig) return null;
  const claimKey = `${feature}:${cloudConfig.keyId}:${cloudConfig.routingVersion || 1}`;
  const claim = async () => {
    const state = await getSessionStorageValue(CLOUD_AI_SESSION_REFRESH_KEY, {});
    const previous = state?.[claimKey];
    const now = Date.now();
    if (
      previous?.status === "complete" ||
      (previous?.status === "running" && now - Number(previous.claimedAt || 0) < CLOUD_AI_REFRESH_CLAIM_TTL)
    ) {
      return null;
    }

    const token = globalThis.crypto?.randomUUID?.() || `${now}-${Math.random()}`;
    const stored = await setSessionStorageValue(CLOUD_AI_SESSION_REFRESH_KEY, {
      ...(state && typeof state === "object" ? state : {}),
      [claimKey]: { status: "running", claimedAt: now, token }
    });
    if (!stored) return null;
    const verified = await getSessionStorageValue(CLOUD_AI_SESSION_REFRESH_KEY, {});
    if (verified?.[claimKey]?.token !== token) return null;
    return { claimKey, token };
  };

  if (!IS_EXTENSION_CONTEXT || !navigator.locks?.request) return claim();
  return navigator.locks.request(CLOUD_AI_REFRESH_LOCK_NAME, { mode: "exclusive" }, claim);
}

async function completeCloudFullRefresh(claim, outcome = "complete") {
  if (!claim) return;
  const state = await getSessionStorageValue(CLOUD_AI_SESSION_REFRESH_KEY, {});
  if (state?.[claim.claimKey]?.token !== claim.token) return;
  if (outcome === "superseded") {
    const nextState = { ...state };
    delete nextState[claim.claimKey];
    await setSessionStorageValue(CLOUD_AI_SESSION_REFRESH_KEY, nextState);
    return;
  }
  await setSessionStorageValue(CLOUD_AI_SESSION_REFRESH_KEY, {
    ...state,
    [claim.claimKey]: {
      status: "complete",
      claimedAt: state[claim.claimKey].claimedAt,
      completedAt: Date.now(),
      outcome
    }
  });
}

function aiProviderCacheKey(cloudConfig, model) {
  return cloudConfig ? `flash:${model}:${cloudConfig.keyId}` : "nano";
}

function runBrowserOrganizerPrompt(baseSession, task) {
  const run = async () => {
    const promptSession = typeof baseSession.clone === "function"
      ? await baseSession.clone()
      : baseSession;

    try {
      return await task(promptSession);
    } finally {
      if (promptSession !== baseSession) promptSession.destroy();
    }
  };
  const result = browserOrganizerPromptQueue.then(run, run);
  browserOrganizerPromptQueue = result.catch(() => {});
  return result;
}

function resetBrowserOrganizerSession() {
  try {
    browserOrganizerSession?.destroy();
  } catch {
    // The session may already have been invalidated by Chrome.
  }
  browserOrganizerSession = null;
  browserOrganizerSessionPromise = null;
}

function describeGeminiError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
    requested: Number.isFinite(error?.requested) ? error.requested : undefined,
    contextWindow: Number.isFinite(error?.contextWindow) ? error.contextWindow : undefined
  };
}

async function rankRecentSessionsWithGemini(session, items) {
  const candidateLines = items.map((item, id) => {
    const context = Array.isArray(item.contextTitles) && item.contextTitles.length > 1
      ? ` | window: ${item.contextTitles.map((title) => shortTitle(title, 48)).join(" / ")}`
      : "";
    return `${id} | ${shortTitle(item.title, 68)} | ${hostnameFor(item.url)} | ${relativeTime(item.lastModified)}${context}`;
  }).join("\n");

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["groups"],
    properties: {
      groups: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "items"],
          properties: {
            label: { type: "string" },
            items: {
              type: "array",
              maxItems: 3,
              items: { type: "integer", minimum: 0, maximum: items.length - 1 }
            }
          }
        }
      }
    }
  };

  const prompt = [
    "Choose up to nine sessions the user is most likely to need again and group them into at most three active tasks.",
    "Prioritize interrupted work such as forms, checkout, planning, documents, dashboards, and clusters of related pages, while still considering recency.",
    "Use a short, specific 2-3 word label for each task. Order groups and items by recovery value.",
    "Return only short task labels and IDs from the list. Do not explain the ranking. Return JSON only.",
    'Output shape: {"groups":[{"label":"Task name","items":[0,1]}]}',
    "Recently closed sessions:",
    candidateLines
  ].join("\n\n");

  const response = await session.prompt(prompt, {
    responseConstraint: schema,
    omitResponseConstraintInput: true
  });
  return parseRecentGroups(response, items);
}

async function patchRecentSessionsWithGemini(session, existingGroups, newItems, currentItems) {
  const relevantIds = new Set([
    ...existingGroups.flatMap((group) => group.items.map((entry) => entry.item.sessionId)),
    ...newItems.map((item) => item.sessionId)
  ]);
  const relevantItems = currentItems.filter((item) => relevantIds.has(item.sessionId));
  const indexBySessionId = new Map(relevantItems.map((item, index) => [item.sessionId, index]));
  const existingLines = existingGroups.map((group) => {
    const ids = group.items
      .map((entry) => indexBySessionId.get(entry.item.sessionId))
      .filter(Number.isInteger);
    return `${group.label}: [${ids.join(",")}]`;
  }).join("\n");
  const newLines = newItems.map((item) => {
    const id = indexBySessionId.get(item.sessionId);
    return `${id} | ${shortTitle(item.title, 68)} | ${hostnameFor(item.url)} | ${relativeTime(item.lastModified)}`;
  }).join("\n");
  const schema = recentGroupsSchema(relevantItems.length);
  const prompt = [
    "Incrementally update the user's existing recently closed task groups using only the newly closed tabs.",
    "Keep the existing groups unchanged unless a new tab is genuinely useful enough to add, replace, or reorder.",
    "Return only groups that need changes. Omitted existing groups are preserved automatically by Safarian.",
    "Return at most three groups and three items per group. Use only the numeric IDs provided. Do not invent tabs.",
    'Output shape: {"groups":[{"label":"Task name","items":[0,1]}]}',
    "Existing groups:",
    existingLines || "None",
    "Newly closed tabs:",
    newLines
  ].join("\n\n");
  const response = await session.prompt(prompt, {
    responseConstraint: schema,
    omitResponseConstraintInput: true
  });
  return parseRecentGroups(response, relevantItems);
}

function recentGroupsSchema(itemCount) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["groups"],
    properties: {
      groups: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "items"],
          properties: {
            label: { type: "string" },
            items: {
              type: "array",
              maxItems: 3,
              items: { type: "integer", minimum: 0, maximum: Math.max(0, itemCount - 1) }
            }
          }
        }
      }
    }
  };
}

function parseRecentGroups(response, items) {
  const parsed = parseGeminiJson(response);
  const seen = new Set();

  return (Array.isArray(parsed.groups) ? parsed.groups : [])
    .map((group) => ({
      label: shortTitle(String(group.label || "Related tabs"), 28),
      items: (Array.isArray(group.items) ? group.items : [])
        .filter((id) => {
          if (!Number.isInteger(id) || !items[id] || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((id) => {
          return {
            item: items[id],
            reason: `Grouped by Gemini as ${shortTitle(String(group.label || "related tabs"), 28)}`
          };
        })
        .slice(0, 3)
    }))
    .filter((group) => group.items.length)
    .slice(0, 3);
}

async function loadRecentlyClosed() {
  if (!IS_EXTENSION_CONTEXT) return fallbackRecent;
  return callChrome(chrome.sessions.getRecentlyClosed, { maxResults: 25 });
}

async function prepareRecentlyClosedItems() {
  const [clearedAt, sessions] = await Promise.all([
    getStorageValue(STORAGE_KEY, 0),
    loadRecentlyClosed()
  ]);
  const normalized = sessions.map(normalizeSession).filter(Boolean);
  const available = normalized.length ? normalized : (IS_EXTENSION_CONTEXT ? [] : fallbackRecent);
  return available
    .filter((item) => item.lastModified > clearedAt)
    .slice(0, 25);
}

function normalizeSession(session) {
  if (session.tab && session.tab.sessionId) {
    const url = session.tab.url || session.tab.pendingUrl || "";
    const title = readableTitle(session.tab.title, url);
    if (!title) return null;

    return {
      sessionId: session.tab.sessionId,
      title,
      url,
      lastModified: secondsToMillis(session.lastModified),
      contextTitles: [title]
    };
  }

  if (session.window && session.window.sessionId) {
    const tabs = Array.isArray(session.window.tabs) ? session.window.tabs : [];
    const firstTab = tabs.find((tab) => tab.title || tab.url || tab.pendingUrl) || {};
    const count = tabs.length || 1;
    const url = firstTab.url || firstTab.pendingUrl || "";
    const title = count === 1 ? readableTitle(firstTab.title, url) : `Window with ${count} tabs`;
    if (!title) return null;

    return {
      sessionId: session.window.sessionId,
      title,
      url,
      lastModified: secondsToMillis(session.lastModified),
      contextTitles: tabs
        .map((tab) => readableTitle(tab.title, tab.url || tab.pendingUrl || ""))
        .filter(Boolean)
        .slice(0, 5)
    };
  }

  return null;
}

async function renderFavorites() {
  const request = ++favoritesRenderRequest;
  const favorites = await loadFavorites();
  if (request !== favoritesRenderRequest) return;

  const favoritesList = document.querySelector("#favorites-list");
  clearChildren(favoritesList);
  favoritesState = favorites;

  if (favorites.length === 0) {
    renderEmptyTiles(favoritesList);
    return;
  }

  const fragment = document.createDocumentFragment();
  favorites.forEach((bookmark, index) => {
    const item = document.createElement("div");
    item.className = "favorite-item";
    item.role = "button";
    item.tabIndex = 0;
    item.draggable = false;
    item.dataset.index = String(index);
    item.title = `${bookmark.title || hostnameFor(bookmark.url)}\n${bookmark.url}`;

    const iconWrap = document.createElement("span");
    iconWrap.className = "favorite-icon";
    iconWrap.dataset.initial = initialFor(bookmark.title, bookmark.url);
    iconWrap.style.setProperty("--fallback-bg", iconColorFor(bookmark.title, bookmark.url));

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    loadIconSources(img, bookmark.url, 144, () => {
      img.hidden = true;
      iconWrap.classList.add("icon-fallback");
    });

    const label = document.createElement("span");
    label.className = "favorite-label";
    label.textContent = shortTitle(bookmark.title || hostnameFor(bookmark.url), 18);

    item.append(iconWrap, label);

    if (favoritesEditMode) {
      const orderBadge = document.createElement("span");
      orderBadge.className = "favorite-order-badge";
      orderBadge.textContent = String(index + 1);
      item.append(orderBadge);

      if (index === reorderSourceIndex) {
        item.classList.add("is-reorder-source");
      }

      if (index === favoriteDropIndex) {
        item.classList.add("is-drop-target");
      }
    }

    img.draggable = false;
    iconWrap.append(img);
    fragment.append(item);
  });
  favoritesList.append(fragment);
}

function setupFavoritesListInteractions() {
  const favoritesList = document.querySelector("#favorites-list");
  const favoriteFromEvent = (event) => event.target.closest(".favorite-item[data-index]");

  favoritesList.addEventListener("dragstart", (event) => {
    if (favoriteFromEvent(event)) event.preventDefault();
  });
  favoritesList.addEventListener("contextmenu", (event) => {
    const item = favoriteFromEvent(event);
    if (!item) return;
    showFavoriteMenu(event, Number(item.dataset.index));
  });
  favoritesList.addEventListener("pointerdown", (event) => {
    const item = favoriteFromEvent(event);
    if (!item) return;
    startFavoritePointerReorder(event, Number(item.dataset.index), item);
  });
  favoritesList.addEventListener("click", (event) => {
    const item = favoriteFromEvent(event);
    if (!item) return;
    if (suppressFavoriteClick) {
      event.preventDefault();
      suppressFavoriteClick = false;
      return;
    }
    if (favoritesEditMode) {
      event.preventDefault();
      return;
    }
    const favorite = favoritesState[Number(item.dataset.index)];
    if (favorite?.url) window.location.href = favorite.url;
  });
  favoritesList.addEventListener("keydown", (event) => {
    const item = favoriteFromEvent(event);
    if (!item || favoritesEditMode || (event.key !== "Enter" && event.key !== " ")) return;
    const favorite = favoritesState[Number(item.dataset.index)];
    if (!favorite?.url) return;
    event.preventDefault();
    window.location.href = favorite.url;
  });
}

async function loadFavorites() {
  if (!IS_EXTENSION_CONTEXT) {
    if (favoritesState.length) return favoritesState;
    favoritesState = fallbackFavorites.map((favorite, index) => ({
      ...favorite,
      id: `preview-${index}`,
      parentId: "preview-bookmarks-bar",
      index
    }));
    return favoritesState;
  }

  const roots = await callChrome(chrome.bookmarks.getTree);
  const bookmarksBar = findBookmarksBar(roots);
  bookmarksBarId = bookmarksBar ? bookmarksBar.id : "1";

  return directBookmarkChildren(bookmarksBar)
    .map((bookmark, index) => ({
      id: bookmark.id,
      parentId: bookmark.parentId || bookmarksBarId,
      index: Number.isInteger(bookmark.index) ? bookmark.index : index,
      title: readableTitle(bookmark.title, bookmark.url) || hostnameFor(bookmark.url),
      url: bookmark.url
    }));
}

function normalizeFavoriteUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (isHttpUrl(trimmed)) return trimmed;
  if (looksLikeUrl(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function startFavoritePointerReorder(event, index, item = event.currentTarget) {
  if (event.button !== 0 || favoriteDrag) return;

  event.preventDefault();
  hideFavoriteMenu();

  const rect = item.getBoundingClientRect();

  favoriteDrag = {
    pointerId: event.pointerId,
    fromIndex: index,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    item,
    ghost: null,
    dragging: false
  };

  try {
    item.setPointerCapture?.(event.pointerId);
  } catch (error) {
    console.warn("Unable to capture favorite drag pointer", error);
  }
  window.addEventListener("pointermove", handleFavoritePointerMove, true);
  window.addEventListener("pointerup", finishFavoritePointerReorder, true);
  window.addEventListener("pointercancel", cancelFavoriteDrag, true);
}

function handleFavoritePointerMove(event) {
  if (!favoriteDrag || event.pointerId !== favoriteDrag.pointerId) return;

  const distance = Math.hypot(event.clientX - favoriteDrag.startX, event.clientY - favoriteDrag.startY);
  if (!favoriteDrag.dragging && distance < 6) return;

  event.preventDefault();

  if (!favoriteDrag.dragging) {
    beginFavoriteDrag();
  }

  moveFavoriteDragGhost(event.clientX, event.clientY);
  setFavoriteDropTarget(indexFromPoint(event.clientX, event.clientY));
}

async function finishFavoritePointerReorder(event) {
  if (!favoriteDrag || event.pointerId !== favoriteDrag.pointerId) return;

  const wasDragging = favoriteDrag.dragging;
  const fromIndex = favoriteDrag.fromIndex;
  const toIndex = favoriteDropIndex;

  cleanupFavoriteDrag();

  if (!wasDragging) return;

  event.preventDefault();
  suppressFavoriteClick = true;

  if (Number.isInteger(toIndex) && toIndex !== fromIndex) {
    await moveFavorite(fromIndex, toIndex);
  }

  reorderSourceIndex = null;
  favoriteDropIndex = null;
  await renderFavorites();

  if (favoritesRefreshPending) {
    requestFavoritesRefresh({ immediate: true });
  }
}

function beginFavoriteDrag() {
  if (!favoriteDrag) return;

  favoritesEditMode = true;
  suppressFavoriteClick = true;
  reorderSourceIndex = favoriteDrag.fromIndex;
  favoriteDropIndex = favoriteDrag.fromIndex;
  document.body.classList.add("favorites-editing");
  document.body.classList.add("favorite-dragging");
  favoriteDrag.item.classList.add("is-dragging", "is-reorder-source");

  const ghost = favoriteDrag.item.cloneNode(true);
  const rect = favoriteDrag.item.getBoundingClientRect();
  ghost.className = "favorite-drag-ghost";
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.setAttribute("aria-hidden", "true");
  document.body.append(ghost);

  favoriteDrag.ghost = ghost;
  favoriteDrag.dragging = true;
  setFavoriteDropTarget(favoriteDrag.fromIndex);
}

function moveFavoriteDragGhost(clientX, clientY) {
  if (!favoriteDrag || !favoriteDrag.ghost) return;

  favoriteDrag.ghost.style.transform = `translate3d(${clientX - favoriteDrag.offsetX}px, ${clientY - favoriteDrag.offsetY}px, 0)`;
}

function indexFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const item = element && element.closest(".favorite-item[data-index]");
  if (!item || !document.querySelector("#favorites-list").contains(item)) {
    return closestFavoriteIndexToPoint(clientX, clientY);
  }

  const index = Number(item.dataset.index);
  return Number.isInteger(index) ? index : null;
}

function closestFavoriteIndexToPoint(clientX, clientY) {
  let closestIndex = null;
  let closestDistance = Infinity;

  document.querySelectorAll(".favorite-item[data-index]").forEach((item) => {
    const rect = item.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = Number(item.dataset.index);
    }
  });

  return Number.isInteger(closestIndex) ? closestIndex : null;
}

function setFavoriteDropTarget(index) {
  if (favoriteDropIndex === index) return;

  document.querySelectorAll(".favorite-item.is-drop-target").forEach((item) => {
    item.classList.remove("is-drop-target");
  });

  favoriteDropIndex = index;

  if (!Number.isInteger(index)) return;

  const target = document.querySelector(`.favorite-item[data-index="${index}"]`);
  target?.classList.add("is-drop-target");
}

function cancelFavoriteDrag() {
  cleanupFavoriteDrag();
  favoriteDropIndex = null;

  if (favoritesRefreshPending) {
    requestFavoritesRefresh({ immediate: true });
  }
}

function cleanupFavoriteDrag() {
  if (!favoriteDrag) return;

  try {
    favoriteDrag.item.releasePointerCapture?.(favoriteDrag.pointerId);
  } catch (error) {
    console.warn("Unable to release favorite drag pointer", error);
  }
  favoriteDrag.item.classList.remove("is-dragging", "is-reorder-source");
  favoriteDrag.ghost?.remove();
  favoriteDrag = null;

  document.body.classList.remove("favorite-dragging");
  document.querySelectorAll(".favorite-item.is-drop-target").forEach((item) => {
    item.classList.remove("is-drop-target");
  });

  window.removeEventListener("pointermove", handleFavoritePointerMove, true);
  window.removeEventListener("pointerup", finishFavoritePointerReorder, true);
  window.removeEventListener("pointercancel", cancelFavoriteDrag, true);
}

function exitReorderMode() {
  cancelFavoriteDrag();
  favoritesEditMode = false;
  reorderSourceIndex = null;
  favoriteDropIndex = null;
  document.body.classList.remove("favorites-editing");
}

function findBookmarksBar(nodes) {
  const queue = Array.isArray(nodes) ? [...nodes] : [];
  const bookmarkBars = [];
  let legacyMatch = null;

  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;

    if (node.folderType === "bookmarks-bar") {
      bookmarkBars.push(node);
    } else if (!legacyMatch && (node.id === "1" || /bookmarks bar|favorites/i.test(node.title || ""))) {
      legacyMatch = node;
    }

    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }

  return bookmarkBars.find((node) => node.syncing) || bookmarkBars[0] || legacyMatch;
}

function directBookmarkChildren(bookmarksBar) {
  if (!bookmarksBar || !Array.isArray(bookmarksBar.children)) return [];

  return bookmarksBar.children
    .filter((node) => node.url && isHttpUrl(node.url))
    .sort((a, b) => (a.index || 0) - (b.index || 0));
}

async function createFavorite(favorite) {
  if (!IS_EXTENSION_CONTEXT) {
    favoritesState.push({
      ...favorite,
      id: `preview-${Date.now()}`,
      parentId: "preview-bookmarks-bar",
      index: favoritesState.length
    });
    return;
  }

  await callChrome(chrome.bookmarks.create, {
    parentId: bookmarksBarId || "1",
    title: favorite.title,
    url: favorite.url
  });
}

async function updateFavorite(index, favorite) {
  const existing = favoritesState[index];
  if (!existing) return;

  if (!IS_EXTENSION_CONTEXT) {
    favoritesState[index] = { ...existing, ...favorite };
    return;
  }

  await callChrome(chrome.bookmarks.update, existing.id, {
    title: favorite.title,
    url: favorite.url
  });
}

async function removeFavorite(index) {
  const existing = favoritesState[index];
  if (!existing) return;

  if (!IS_EXTENSION_CONTEXT) {
    favoritesState.splice(index, 1);
    return;
  }

  await callChrome(chrome.bookmarks.remove, existing.id);
}

async function moveFavorite(fromIndex, toIndex) {
  const existing = favoritesState[fromIndex];
  if (!existing) return;

  if (!IS_EXTENSION_CONTEXT) {
    const [moved] = favoritesState.splice(fromIndex, 1);
    favoritesState.splice(toIndex, 0, moved);
    favoritesState.forEach((favorite, index) => {
      favorite.index = index;
    });
    return;
  }

  await callChrome(chrome.bookmarks.move, existing.id, {
    parentId: existing.parentId || bookmarksBarId || "1",
    index: Number.isInteger(favoritesState[toIndex]?.index)
      ? favoritesState[toIndex].index
      : toIndex
  });
}

async function renderContinueJourneys({ force = false } = {}) {
  const request = ++continueRenderRequest;
  const badgeLabel = document.querySelector("#continue-badge-label");
  const hasExistingCards = Boolean(document.querySelector("#continue-list .journey-card:not(.journey-card-loading)"));
  if (force || !hasExistingCards) {
    renderContinueLoading("Preparing useful journeys from your recent activity…", "pending");
  } else {
    setContinueContentRefreshBusy(true, "Checking for new activity · existing journeys stay available.");
  }

  if (SHOW_AI_LOADING_PREVIEW) {
    setContinueLoadingMessage("AI is connecting related pages into useful journeys…");
    return;
  }

  const cloudConfigPromise = IS_EXTENSION_CONTEXT ? getCloudAiConfig() : Promise.resolve(null);
  const candidatesPromise = loadContinueCandidates({ forceRefresh: force });
  const journeyCachePromise = IS_EXTENSION_CONTEXT
    ? getStorageValue(CONTINUE_JOURNEY_CACHE_KEY, null)
    : Promise.resolve(null);
  const cloudConfig = await cloudConfigPromise;
  if (request !== continueRenderRequest) return;

  if (IS_EXTENSION_CONTEXT && (force || !hasExistingCards)) {
    renderContinueLoading(
      cloudConfig
        ? "Gemini 3.7 Flash is checking your recent activity for work worth resuming…"
        : "On-device AI is checking your recent activity for work worth resuming…",
      cloudConfig ? "cloud" : "local"
    );
  }

  const candidates = await candidatesPromise;
  if (request !== continueRenderRequest) return;
  if (candidates.length < 2) {
    renderContinueEmpty(
      "No strong journey yet. Revisit related pages across a few days and Safarian will surface them here.",
      "Waiting for activity"
    );
    return;
  }

  if (!IS_EXTENSION_CONTEXT) {
    renderContinueJourneyCards(previewContinueJourneys(candidates));
    badgeLabel.textContent = "Preview data";
    return;
  }

  const fingerprint = continueJourneyFingerprint(
    candidates,
    aiProviderCacheKey(cloudConfig, CONTINUE_CLOUD_MODEL)
  );
  const cached = await journeyCachePromise;
  if (request !== continueRenderRequest) return;
  const fullRefreshClaim = force || !cloudFullReviewDue(cached)
    ? null
    : await claimCloudFullRefresh("continue", cloudConfig);
  if (request !== continueRenderRequest) {
    await completeCloudFullRefresh(fullRefreshClaim, "superseded");
    return;
  }
  const cachedJourneys = hydrateContinueJourneys(cached, fingerprint, candidates);
  if (cachedJourneys.length && !force && !fullRefreshClaim) {
    renderContinueJourneyCards(
      cachedJourneys,
      cached.provider || "local",
      cached.fullReviewAt
    );
    return;
  }

  if (cloudConfig && !force && !fullRefreshClaim) {
    const existingJourneys = hydrateContinueIncrementalJourneys(cached, candidates);
    if (existingJourneys.length) {
      renderContinueJourneyCards(
        existingJourneys,
        cached.provider || "cloud",
        cached.fullReviewAt || cached.createdAt
      );
      setContinueContentRefreshBusy(true, "Updating with new activity · existing journeys stay available.");
    }
    let incremental;
    let incrementalFailed = false;
    try {
      incremental = await updateContinueJourneysIncrementally(cached, candidates, fingerprint);
    } catch (error) {
      incrementalFailed = true;
      console.warn("Gemini Continue incremental update failed", describeGeminiError(error));
      incremental = existingJourneys.length
        ? {
          journeys: existingJourneys,
          provider: cached.provider || "cloud",
          fullReviewAt: cached.fullReviewAt || cached.createdAt
        }
        : null;
    } finally {
      if (request === continueRenderRequest && existingJourneys.length) setContinueContentRefreshBusy(false);
    }
    if (request !== continueRenderRequest) return;
    if (incremental?.journeys?.length) {
      renderContinueJourneyCards(
        incremental.journeys,
        incremental.provider,
        incremental.fullReviewAt
      );
      if (incrementalFailed) {
        document.querySelector("#continue-subtitle").textContent = "Showing the last review · local update will retry";
        document.querySelector("#continue-badge-label").textContent = "Last review";
      }
      return;
    }
    renderContinueEmpty(
      "The last full Flash review has no active journey left. Safarian will refresh it at the next Chrome start.",
      "Waiting for refresh"
    );
    return;
  }

  try {
    const result = await runRateLimitedAiTask({
      feature: "continue",
      fingerprint,
      force: force || Boolean(fullRefreshClaim),
      loadCached: async () => {
        const latestCache = await getStorageValue(CONTINUE_JOURNEY_CACHE_KEY, null);
        const journeys = hydrateContinueJourneys(latestCache, fingerprint, candidates);
        return journeys.length
          ? {
            status: "success",
            journeys,
            provider: latestCache.provider || "local",
            fullReviewAt: latestCache.fullReviewAt
          }
          : null;
      },
      saveSuccess: (success) => setStorageValue(
        CONTINUE_JOURNEY_CACHE_KEY,
        serializeContinueJourneys(
          fingerprint,
          success.journeys,
          success.provider,
          success.fallbackFromCloud,
          candidates,
          success.fullReviewAt || (success.provider === "cloud" ? Date.now() : null)
        )
      ),
      task: () => generateContinueJourneys(candidates, {
        allowDownload: force,
        cloudConfig,
        onStatus: setContinueLoadingMessage
      })
    });
    if (request !== continueRenderRequest) return;
    if (result.status !== "success" || !result.journeys.length) {
      renderContinueEmpty(continueEmptyMessage(result), continueEmptyBadge(result));
      return;
    }
    renderContinueJourneyCards(
      result.journeys,
      result.provider || "local",
      result.fullReviewAt || (fullRefreshClaim ? Date.now() : null)
    );
  } catch (error) {
    console.warn("Gemini Continue grouping failed", describeGeminiError(error));
    resetBrowserOrganizerSession();
    if (request !== continueRenderRequest) return;
    renderContinueEmpty(
      "Continue couldn’t refresh this time. Safarian will try again automatically.",
      "Retrying later"
    );
  } finally {
    await completeCloudFullRefresh(fullRefreshClaim, "complete");
  }
}

function continueEmptyMessage(result) {
  if (result?.status === "needs-user") {
    return "On-device Gemini isn’t ready. Enable Gemini Flash in Customize or keep browsing and Safarian will retry later.";
  }
  if (result?.status === "unavailable") {
    return "AI grouping isn’t available right now. Safarian will keep your activity private and try again when it becomes available.";
  }
  if (result?.status === "throttled") {
    return result.previousStatus === "empty"
      ? "No strong journey was found in this activity yet. Safarian will check again when it changes."
      : "Continue is cooling down after a temporary AI issue and will retry automatically.";
  }
  if (result?.status === "empty") {
    return "No strong multi-page journey was found yet. Safarian will check again as your activity develops.";
  }
  return "Continue couldn’t refresh this time. Safarian will try again automatically.";
}

function continueEmptyBadge(result) {
  if (result?.status === "empty" || result?.previousStatus === "empty") return "Waiting for signal";
  if (result?.status === "needs-user") return "AI not ready";
  return "Retrying later";
}

function renderContinueLoading(message, provider = "local") {
  const section = document.querySelector("#continue-section");
  const list = document.querySelector("#continue-list");
  const badgeLabel = document.querySelector("#continue-badge-label");
  const currentTheme = normalizeThemeName(document.documentElement.dataset.themeName || "classic");
  const activePalette = themePalettes[currentTheme] || themePalettes.classic;

  section.hidden = false;
  section.classList.remove("is-ai-updating");
  section.classList.add("is-ai-working");
  section.setAttribute("aria-busy", "true");
  setContinueRefreshBusy(true);
  badgeLabel.textContent = provider === "cloud"
    ? "Gemini Flash working"
    : provider === "local"
      ? "AI working on-device"
      : "AI preparing";
  setContinueLoadingMessage(message);
  clearChildren(list);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 3; index += 1) {
    const colors = activePalette[index % activePalette.length];
    const card = document.createElement("article");
    card.className = "journey-card journey-card-loading";
    card.style.setProperty("--card-start", colors[0]);
    card.style.setProperty("--card-end", colors[1]);
    card.setAttribute("aria-hidden", "true");

    const header = document.createElement("div");
    header.className = "journey-card-header";
    const badge = document.createElement("span");
    badge.className = "journey-loading-shape journey-loading-badge";
    const count = document.createElement("span");
    count.className = "journey-loading-shape journey-loading-count";
    header.append(badge, count);

    const heading = document.createElement("div");
    heading.className = "journey-card-heading";
    const title = document.createElement("span");
    title.className = "journey-loading-shape journey-loading-title";
    const stats = document.createElement("span");
    stats.className = "journey-loading-shape journey-loading-stats";
    heading.append(title, stats);

    const pagesList = document.createElement("div");
    pagesList.className = "journey-pages-list";
    for (let r = 0; r < 3; r += 1) {
      const row = document.createElement("div");
      row.className = "journey-tab-item journey-loading-row";
      const icon = document.createElement("span");
      icon.className = "journey-tab-icon-wrap";
      const info = document.createElement("div");
      info.className = "journey-tab-info";
      const line1 = document.createElement("span");
      line1.className = "journey-loading-shape journey-loading-row-title";
      const line2 = document.createElement("span");
      line2.className = "journey-loading-shape journey-loading-row-host";
      info.append(line1, line2);
      row.append(icon, info);
      pagesList.append(row);
    }

    const footer = document.createElement("div");
    footer.className = "journey-card-footer";
    const btn = document.createElement("span");
    btn.className = "journey-loading-shape journey-loading-btn";
    footer.append(btn);

    card.append(header, heading, pagesList, footer);
    fragment.append(card);
  }
  list.append(fragment);
}

function setContinueRefreshBusy(busy) {
  const button = document.querySelector("#continue-ai-refresh");
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.setAttribute("aria-label", busy ? "Refreshing AI for Continue" : "Refresh AI for Continue");
  button.querySelector("span").textContent = busy ? "Refreshing…" : "Refresh AI";
}

function setContinueContentRefreshBusy(busy, message = "") {
  const section = document.querySelector("#continue-section");
  section.classList.toggle("is-ai-working", busy);
  section.classList.toggle("is-ai-updating", busy);
  section.setAttribute("aria-busy", String(busy));
  setContinueRefreshBusy(busy);
  if (busy) {
    document.querySelector("#continue-badge-label").textContent = "Updating locally";
    if (message) setContinueLoadingMessage(message);
  }
}

function setContinueLoadingMessage(message) {
  const subtitle = document.querySelector("#continue-subtitle");
  subtitle.textContent = message;
}

function renderContinueEmpty(message, badge = "Waiting for signal") {
  const section = document.querySelector("#continue-section");
  const list = document.querySelector("#continue-list");
  section.hidden = false;
  section.classList.remove("is-ai-working");
  section.classList.remove("is-ai-updating");
  section.setAttribute("aria-busy", "false");
  setContinueRefreshBusy(false);
  document.querySelector("#continue-subtitle").textContent = "Useful journeys appear only when there’s a strong signal";
  document.querySelector("#continue-badge-label").textContent = badge;
  clearChildren(list);

  const state = document.createElement("div");
  state.className = "continue-empty-state";
  const icon = document.createElement("span");
  icon.className = "continue-empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false"><path d="M4 7h10M4 12h16M4 17h8"/></svg>`;
  const copy = document.createElement("span");
  copy.textContent = message;
  state.append(icon, copy);
  list.append(state);
}

async function loadContinueCandidates({ forceRefresh = false } = {}) {
  if (!IS_EXTENSION_CONTEXT) return previewContinueCandidates();

  const cached = normalizeContinueCandidateCache(
    await getStorageValue(CONTINUE_CANDIDATE_CACHE_KEY, null)
  );
  const cacheAge = cached ? Date.now() - cached.createdAt : Infinity;
  if (!forceRefresh && cached && cacheAge <= CONTINUE_CANDIDATE_STALE_TTL) {
    if (cacheAge > CONTINUE_CANDIDATE_CACHE_TTL) scheduleContinueCandidateRefresh();
    return selectContinueCandidates(cached.items);
  }

  const items = continueCandidateRefreshPromise
    ? await continueCandidateRefreshPromise
    : await refreshContinueCandidateData();
  return selectContinueCandidates(items);
}

function scheduleContinueCandidateRefresh() {
  if (continueCandidateRefreshPromise) return continueCandidateRefreshPromise;
  continueCandidateRefreshPromise = new Promise((resolve) => {
    const run = () => resolve(refreshContinueCandidateData());
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 1200 });
    } else {
      window.setTimeout(run, 180);
    }
  }).finally(() => {
    continueCandidateRefreshPromise = null;
  });
  return continueCandidateRefreshPromise;
}

async function refreshContinueCandidateData() {
  const startTime = Date.now() - CONTINUE_RANGE_DAYS * 24 * 60 * 60 * 1000;
  const history = await callChrome(chrome.history.search, {
    text: "",
    startTime,
    maxResults: 250
  });

  const byUrl = new Map();
  history
    .filter((item) => item.url && isHttpUrl(item.url))
    .filter((item) => !isSearchOrInternalPage(item.url) && !isSearchResultsUrl(item.url))
    .sort((a, b) => {
      const scoreA = (a.visitCount || 0) + (a.typedCount || 0) * 2;
      const scoreB = (b.visitCount || 0) + (b.typedCount || 0) * 2;
      return scoreB - scoreA || (b.lastVisitTime || 0) - (a.lastVisitTime || 0);
    })
    .forEach((item) => {
      const key = journeyUrlKey(item.url);
      if (!key || byUrl.has(key)) return;
      byUrl.set(key, item);
    });

  const detailed = await mapWithConcurrency(
    [...byUrl.values()].slice(0, CONTINUE_HISTORY_DETAIL_LIMIT),
    CONTINUE_HISTORY_CONCURRENCY,
    async (item) => {
      const visits = await callChrome(chrome.history.getVisits, { url: item.url });
      const recentVisits = visits
        .map((visit) => Number(visit.visitTime || 0))
        .filter((visitTime) => visitTime >= startTime);
      const visitDays = [...new Set(recentVisits.map(dayKeyForTimestamp))];
      const lastVisitTime = Math.max(item.lastVisitTime || 0, ...recentVisits, 0);

      return {
        title: readableTitle(item.title, item.url),
        url: item.url,
        lastVisitTime,
        visitCount: recentVisits.length,
        typedCount: item.typedCount || 0,
        visitDays
      };
    }
  );

  void setStorageValue(CONTINUE_CANDIDATE_CACHE_KEY, {
    version: 1,
    createdAt: Date.now(),
    items: detailed
  });
  return detailed;
}

function normalizeContinueCandidateCache(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.items)) return null;
  const items = value.items
    .filter((item) => item && isHttpUrl(item.url))
    .map((item) => ({
      title: String(item.title || ""),
      url: item.url,
      lastVisitTime: Number(item.lastVisitTime || 0),
      visitCount: Number(item.visitCount || 0),
      typedCount: Number(item.typedCount || 0),
      visitDays: Array.isArray(item.visitDays) ? item.visitDays.filter(Boolean).slice(0, CONTINUE_RANGE_DAYS) : []
    }))
    .slice(0, CONTINUE_HISTORY_DETAIL_LIMIT);
  return {
    createdAt: Number(value.createdAt || 0),
    items
  };
}

function selectContinueCandidates(detailed) {
  const excludedUrls = new Set([
    ...favoritesState.map((item) => journeyUrlKey(item.url)),
    ...recentItemsState.map((item) => journeyUrlKey(item.url))
  ].filter(Boolean));

  return detailed
    .filter((item) => !excludedUrls.has(journeyUrlKey(item.url)))
    .filter((item) => item.visitCount >= 2 && item.visitDays.length >= 2)
    .map((item) => ({
      ...item,
      score: item.visitDays.length * 5
        + Math.min(item.visitCount, 12)
        + Math.min(item.typedCount, 5) * 2
        + Math.max(0, 5 - Math.floor((Date.now() - item.lastVisitTime) / (7 * 24 * 60 * 60 * 1000)))
    }))
    .sort((a, b) => b.score - a.score || b.lastVisitTime - a.lastVisitTime)
    .slice(0, MAX_CONTINUE_CANDIDATES);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function previewContinueCandidates() {
  const now = PREVIEW_TIMESTAMP;
  const excludedUrls = new Set([
    ...favoritesState.map((item) => journeyUrlKey(item.url)),
    ...recentItemsState.map((item) => journeyUrlKey(item.url))
  ].filter(Boolean));
  return fallbackSuggestions.filter((item) => !excludedUrls.has(journeyUrlKey(item.url))).map((item, index) => {
    const visitCount = Math.max(2, 7 - index);
    const activeDays = Math.max(2, Math.min(5, visitCount - 1));
    return {
      ...item,
      lastVisitTime: now - (index + 1) * 24 * 60 * 60 * 1000,
      visitCount,
      typedCount: index % 2,
      visitDays: Array.from({ length: activeDays }, (_, day) => dayKeyForTimestamp(now - (day + index + 1) * 24 * 60 * 60 * 1000)),
      score: activeDays * 5 + visitCount
    };
  });
}

function previewContinueJourneys(candidates) {
  const previewGroups = [
    {
      label: "Plan reward travel",
      hosts: new Set(["seats.aero", "point.me", "lonelyplanet.com"])
    },
    {
      label: "Compare card rewards",
      hosts: new Set(["global.americanexpress.com", "uscreditcardguide.com"])
    }
  ].map((group) => ({
    label: group.label,
    items: candidates.filter((item) => group.hosts.has(hostnameFor(item.url))).slice(0, 4)
  })).filter((group) => group.items.length >= 2);

  return previewGroups.length
    ? previewGroups
    : [{ label: "Ongoing research", items: candidates.slice(0, 4) }];
}

async function rankContinueJourneysWithGemini(session, candidates) {
  const candidateLines = candidates.map((item, id) => (
    `${id} | ${shortTitle(item.title, 68)} | ${hostnameFor(item.url)}${recallSafePath(item.url)} | ${item.visitCount} visits | ${item.visitDays.length} days | ${relativeTime(item.lastVisitTime)}`
  )).join("\n");
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["journeys"],
    properties: {
      journeys: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "items"],
          properties: {
            label: { type: "string" },
            items: {
              type: "array",
              maxItems: 4,
              items: { type: "integer", minimum: 0, maximum: candidates.length - 1 }
            }
          }
        }
      }
    }
  };
  const prompt = [
    "Find up to three concrete ongoing user journeys from repeated browser activity across recent days.",
    "A journey must contain at least two pages that support the same specific real-world goal or project.",
    "Do not group pages merely because they are popular, recent, or in a broad category. Omit weak or unrelated activity.",
    "Use specific 2-3 word labels. Rank journeys by strength of repeat activity and usefulness to continue now.",
    "Return only labels and IDs from the list. Return JSON only.",
    'Output shape: {"journeys":[{"label":"Project name","items":[0,1]}]}',
    "Eligible repeat activity:",
    candidateLines
  ].join("\n\n");
  const response = await session.prompt(prompt, {
    responseConstraint: schema,
    omitResponseConstraintInput: true
  });
  return parseContinueJourneys(response, candidates);
}

async function patchContinueJourneysWithGemini(session, existingJourneys, changedCandidates, candidates) {
  const relevantUrls = new Set([
    ...existingJourneys.flatMap((journey) => journey.items.map((item) => journeyUrlKey(item.url))),
    ...changedCandidates.map((item) => journeyUrlKey(item.url))
  ]);
  const relevantCandidates = candidates.filter((item) => relevantUrls.has(journeyUrlKey(item.url)));
  const indexByUrl = new Map(relevantCandidates.map((item, index) => [journeyUrlKey(item.url), index]));
  const existingLines = existingJourneys.map((journey) => {
    const ids = journey.items
      .map((item) => indexByUrl.get(journeyUrlKey(item.url)))
      .filter(Number.isInteger);
    return `${journey.label}: [${ids.join(",")}]`;
  }).join("\n");
  const changedLines = changedCandidates.map((item) => {
    const id = indexByUrl.get(journeyUrlKey(item.url));
    return `${id} | ${shortTitle(item.title, 68)} | ${hostnameFor(item.url)}${recallSafePath(item.url)} | ${item.visitCount} visits | ${item.visitDays.length} days`;
  }).join("\n");
  const schema = continueJourneysSchema(relevantCandidates.length);
  const prompt = [
    "Incrementally update the user's existing ongoing journeys using only new or changed browsing activity.",
    "Keep an existing journey unchanged unless the changed pages strengthen, weaken, or clearly belong to it.",
    "Return only journeys that need changes. Omitted existing journeys are preserved automatically by Safarian.",
    "A journey must still contain at least two pages supporting the same concrete goal. Omit weak groupings.",
    "Return at most three journeys and use only the numeric IDs provided. Return JSON only.",
    'Output shape: {"journeys":[{"label":"Project name","items":[0,1]}]}',
    "Existing journeys:",
    existingLines || "None",
    "New or changed activity:",
    changedLines
  ].join("\n\n");
  const response = await session.prompt(prompt, {
    responseConstraint: schema,
    omitResponseConstraintInput: true
  });
  return parseContinueJourneys(response, relevantCandidates);
}

function continueJourneysSchema(candidateCount) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["journeys"],
    properties: {
      journeys: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "items"],
          properties: {
            label: { type: "string" },
            items: {
              type: "array",
              maxItems: 4,
              items: { type: "integer", minimum: 0, maximum: Math.max(0, candidateCount - 1) }
            }
          }
        }
      }
    }
  };
}

function parseContinueJourneys(response, candidates) {
  const parsed = parseGeminiJson(response);
  const seen = new Set();

  return (Array.isArray(parsed.journeys) ? parsed.journeys : [])
    .reduce((result, journey) => {
      if (result.length >= 3) return result;
      const ids = [...new Set(Array.isArray(journey.items) ? journey.items : [])]
        .filter((id) => Number.isInteger(id) && candidates[id] && !seen.has(id))
        .slice(0, 4);
      if (ids.length < 2) return result;
      ids.forEach((id) => seen.add(id));
      result.push({
        label: shortTitle(String(journey.label || "Ongoing project"), 30),
        items: ids.map((id) => candidates[id])
      });
      return result;
    }, []);
}

async function generateContinueJourneys(candidates, { allowDownload = false, cloudConfig, onStatus }) {
  let fallbackFromCloud = false;
  if (cloudConfig) {
    try {
      onStatus("Gemini 3.7 Flash is connecting related pages into useful journeys…");
      const journeys = await rankContinueJourneysWithGemini(
        createGeminiFlashPromptSession(cloudConfig, CONTINUE_CLOUD_MODEL),
        candidates
      );
      setCloudAiStatus(CLOUD_AI_READY_MESSAGE, "ready");
      return {
        status: journeys.length ? "success" : "empty",
        journeys,
        provider: "cloud",
        fullReviewAt: Date.now()
      };
    } catch (error) {
      fallbackFromCloud = true;
      console.warn("Gemini Flash Continue grouping failed", describeGeminiError(error));
      setCloudAiStatus("Flash was unavailable, so Safarian used on-device AI for this request.", "warning");
      onStatus("Flash is unavailable · finishing privately on-device…");
    }
  }

  const sessionResult = await getBrowserOrganizerSession({ allowDownload });
  if (sessionResult.status !== "success") {
    return { status: sessionResult.status, journeys: [] };
  }

  onStatus("On-device AI is connecting related pages into useful journeys…");
  try {
    const journeys = await runBrowserOrganizerPrompt(
      sessionResult.session,
      (promptSession) => rankContinueJourneysWithGemini(promptSession, candidates)
    );
    return { status: journeys.length ? "success" : "empty", journeys, provider: "local", fallbackFromCloud };
  } catch (error) {
    console.warn("Chrome built-in Gemini Continue grouping failed", describeGeminiError(error));
    resetBrowserOrganizerSession();
    return { status: "error", journeys: [] };
  }
}

function continueJourneyFingerprint(candidates, providerKey = "nano") {
  return `${providerKey}|${candidates.map((item) => (
    `${journeyUrlKey(item.url)}:${item.visitCount}:${item.visitDays.length}:${item.lastVisitTime}`
  )).join("|")}`;
}

function hydrateContinueJourneys(cache, fingerprint, candidates) {
  if (
    !cache ||
    cache.incrementalCacheVersion !== INCREMENTAL_CACHE_VERSION ||
    cache.fingerprint !== fingerprint ||
    !Array.isArray(cache.journeys)
  ) return [];
  const ttl = cache.fallbackFromCloud ? CLOUD_FALLBACK_CACHE_TTL : CONTINUE_JOURNEY_CACHE_TTL;
  if (Date.now() - Number(cache.createdAt || 0) > ttl) return [];

  return hydrateContinueJourneysData(cache.journeys, candidates);
}

function hydrateContinueJourneysData(journeys, candidates) {
  const byUrl = new Map(candidates.map((item) => [journeyUrlKey(item.url), item]));
  return (Array.isArray(journeys) ? journeys : [])
    .map((journey) => ({
      label: shortTitle(String(journey.label || "Ongoing project"), 30),
      items: (Array.isArray(journey.urls) ? journey.urls : [])
        .map((url) => byUrl.get(journeyUrlKey(url)))
        .filter(Boolean)
        .slice(0, 4)
    }))
    .filter((journey) => journey.items.length >= 2)
    .slice(0, 3);
}

function serializeContinueJourneys(
  fingerprint,
  journeys,
  provider = "local",
  fallbackFromCloud = false,
  candidates = [],
  fullReviewAt = null,
  fullReviewJourneys = null
) {
  const serializedJourneys = serializeContinueJourneysData(journeys);
  const serializedFullReviewJourneys = Array.isArray(fullReviewJourneys)
    ? serializeContinueJourneysData(fullReviewJourneys)
    : provider === "cloud"
      ? serializedJourneys
      : null;
  return {
    incrementalCacheVersion: INCREMENTAL_CACHE_VERSION,
    fingerprint,
    provider,
    fallbackFromCloud,
    fullReviewAt: Number(fullReviewAt || 0) || null,
    candidateSnapshot: candidates.map((item) => ({
      url: item.url,
      visitCount: item.visitCount,
      activeDays: item.visitDays.length,
      lastVisitTime: item.lastVisitTime
    })),
    createdAt: Date.now(),
    journeys: serializedJourneys,
    fullReviewJourneys: serializedFullReviewJourneys
  };
}

function serializeContinueJourneysData(journeys) {
  return journeys.map((journey) => ({
      label: journey.label,
      urls: journey.items.map((item) => item.url)
    }));
}

function hydrateContinueJourneysLoose(cache, candidates) {
  if (
    !cache ||
    cache.incrementalCacheVersion !== INCREMENTAL_CACHE_VERSION ||
    !Array.isArray(cache.journeys)
  ) return [];
  const ttl = cache.fallbackFromCloud ? CLOUD_FALLBACK_CACHE_TTL : INCREMENTAL_BASELINE_TTL;
  if (Date.now() - Number(cache.createdAt || 0) > ttl) return [];
  return hydrateContinueJourneys(
    { ...cache, fingerprint: "incremental", createdAt: Date.now(), fallbackFromCloud: false },
    "incremental",
    candidates
  );
}

function hydrateContinueIncrementalJourneys(cache, candidates) {
  const currentJourneys = hydrateContinueJourneysLoose(cache, candidates);
  const fullReviewJourneys = hydrateContinueJourneysData(cache?.fullReviewJourneys, candidates);
  return mergeContinueJourneyPatch(fullReviewJourneys, currentJourneys);
}

async function updateContinueJourneysIncrementally(cache, candidates, fingerprint) {
  const fullReviewJourneys = hydrateContinueJourneysData(cache?.fullReviewJourneys, candidates);
  const existingJourneys = hydrateContinueIncrementalJourneys(cache, candidates);
  if (!existingJourneys.length) return null;
  const baseline = new Map(
    (Array.isArray(cache.candidateSnapshot) ? cache.candidateSnapshot : [])
      .map((item) => [journeyUrlKey(item.url), item])
  );
  const changedCandidates = candidates.filter((item) => {
    const previous = baseline.get(journeyUrlKey(item.url));
    return !previous ||
      item.visitCount > Number(previous.visitCount || 0) ||
      item.visitDays.length > Number(previous.activeDays || 0) ||
      item.lastVisitTime > Number(previous.lastVisitTime || 0);
  });
  if (!changedCandidates.length) {
    return {
      journeys: existingJourneys,
      provider: cache.provider || "cloud",
      fullReviewAt: cache.fullReviewAt || cache.createdAt
    };
  }

  const result = await runRateLimitedAiTask({
    feature: "continue-incremental",
    fingerprint,
    loadCached: async () => {
      const latest = await getStorageValue(CONTINUE_JOURNEY_CACHE_KEY, null);
      const journeys = hydrateContinueJourneys(latest, fingerprint, candidates);
      return journeys.length
        ? { status: "success", journeys, provider: latest.provider || "hybrid", fullReviewAt: latest.fullReviewAt }
        : null;
    },
    saveSuccess: (success) => setStorageValue(
      CONTINUE_JOURNEY_CACHE_KEY,
      serializeContinueJourneys(
        fingerprint,
        success.journeys,
        "hybrid",
        false,
        candidates,
        cache.fullReviewAt || cache.createdAt,
        fullReviewJourneys.length ? fullReviewJourneys : existingJourneys
      )
    ),
    task: async () => {
      const sessionResult = await getBrowserOrganizerSession({ allowDownload: false });
      if (sessionResult.status !== "success") return { status: sessionResult.status, journeys: [] };
      setContinueLoadingMessage(
        `On-device AI is reviewing ${changedCandidates.length} new or changed page${changedCandidates.length === 1 ? "" : "s"}…`
      );
      const patchJourneys = await runBrowserOrganizerPrompt(
        sessionResult.session,
        (session) => patchContinueJourneysWithGemini(session, existingJourneys, changedCandidates, candidates)
      );
      const journeys = mergeContinueJourneyPatch(existingJourneys, patchJourneys);
      return {
        status: journeys.length ? "success" : "empty",
        journeys,
        provider: "hybrid",
        fullReviewAt: cache.fullReviewAt || cache.createdAt
      };
    }
  });

  if (result.status === "success" && result.journeys.length) return result;
  return {
    journeys: existingJourneys,
    provider: cache.provider || "cloud",
    fullReviewAt: cache.fullReviewAt || cache.createdAt
  };
}

function mergeContinueJourneyPatch(existingJourneys, patchJourneys) {
  const existing = Array.isArray(existingJourneys) ? existingJourneys : [];
  const patches = Array.isArray(patchJourneys) ? patchJourneys.filter((journey) => journey.items?.length >= 2) : [];
  if (!existing.length) return patches.slice(0, 3);
  if (!patches.length) return existing.slice(0, 3);

  const usedPatches = new Set();
  const merged = existing.map((journey) => {
    const existingUrls = new Set(journey.items.map((item) => journeyUrlKey(item.url)));
    const patchIndex = patches.findIndex((patch, index) => {
      if (usedPatches.has(index)) return false;
      if (normalizeRecallText(patch.label) === normalizeRecallText(journey.label)) return true;
      return patch.items.some((item) => existingUrls.has(journeyUrlKey(item.url)));
    });
    if (patchIndex < 0) return journey;
    usedPatches.add(patchIndex);
    return patches[patchIndex];
  });

  patches.forEach((patch, index) => {
    if (usedPatches.has(index)) return;
    if (merged.length < 3) merged.push(patch);
    else merged[merged.length - 1] = patch;
  });

  const seen = new Set();
  return merged
    .map((journey) => ({
      ...journey,
      items: journey.items.filter((item) => {
        const url = journeyUrlKey(item.url);
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      }).slice(0, 4)
    }))
    .filter((journey) => journey.items.length >= 2)
    .slice(0, 3);
}

function renderContinueJourneyCards(journeys, provider = "local", fullReviewAt = null) {
  const section = document.querySelector("#continue-section");
  const list = document.querySelector("#continue-list");
  const subtitle = document.querySelector("#continue-subtitle");
  const badgeLabel = document.querySelector("#continue-badge-label");
  const currentTheme = normalizeThemeName(document.documentElement.dataset.themeName || "classic");
  const activePalette = themePalettes[currentTheme] || themePalettes.classic;
  section.classList.remove("is-ai-working");
  section.classList.remove("is-ai-updating");
  section.setAttribute("aria-busy", "false");
  setContinueRefreshBusy(false);
  subtitle.textContent = fullReviewAt
    ? `Ongoing journeys · full Flash review ${relativeTime(fullReviewAt).toLocaleLowerCase()}`
    : "Ongoing journeys from your recent activity";
  badgeLabel.textContent = provider === "cloud"
    ? "Full review by Gemini Flash"
    : provider === "hybrid"
      ? "Updated locally"
      : "Grouped on-device";
  clearChildren(list);
  const fragment = document.createDocumentFragment();

  journeys.forEach((journey, index) => {
    const colors = activePalette[index % activePalette.length];
    const card = document.createElement("article");
    card.className = "journey-card";
    card.style.setProperty("--card-start", colors[0]);
    card.style.setProperty("--card-end", colors[1]);

    // Header
    const header = document.createElement("div");
    header.className = "journey-card-header";

    const topic = document.createElement("div");
    topic.className = "journey-card-topic";
    const topicIcon = document.createElement("span");
    topicIcon.className = "journey-topic-icon";
    topicIcon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><rect x="3" y="3" width="13" height="13" rx="2"/><path d="M8 21h11a2 2 0 0 0 2-2V8"/></svg>`;
    const topicLabel = document.createElement("span");
    topicLabel.className = "journey-topic-label";
    topicLabel.textContent = "Tab Group";
    topic.append(topicIcon, topicLabel);

    const count = document.createElement("span");
    count.className = "journey-card-count";
    count.textContent = `${journey.items.length} tabs`;
    header.append(topic, count);

    // Heading
    const heading = document.createElement("div");
    heading.className = "journey-card-heading";

    const title = document.createElement("h3");
    title.className = "journey-title";
    title.textContent = journey.label;

    const activeDays = new Set(journey.items.flatMap((item) => item.visitDays)).size;
    const visits = journey.items.reduce((sum, item) => sum + item.visitCount, 0);
    const stats = document.createElement("p");
    stats.className = "journey-stats";
    stats.textContent = `${visits} visits · ${activeDays} active day${activeDays > 1 ? "s" : ""}`;
    heading.append(title, stats);

    // Tab Pages Inset List
    const pagesList = document.createElement("div");
    pagesList.className = "journey-pages-list";

    journey.items.slice(0, 3).forEach((item) => {
      const row = document.createElement("a");
      row.className = "journey-tab-item";
      row.href = item.url;
      row.title = item.title;

      const iconWrap = document.createElement("span");
      iconWrap.className = "journey-tab-icon-wrap";

      if (item.url && !item.url.startsWith("chrome://newtab")) {
        const img = document.createElement("img");
        img.className = "journey-tab-icon";
        img.alt = "";
        img.loading = "lazy";
        loadIconSources(img, item.url, 64, () => {
          img.remove();
          iconWrap.textContent = initialFor(item.title, item.url);
          iconWrap.style.setProperty("--fallback-bg", iconColorFor(item.title, item.url));
          iconWrap.classList.add("icon-fallback");
        });
        iconWrap.append(img);
      } else {
        iconWrap.textContent = initialFor(item.title, item.url);
        iconWrap.style.setProperty("--fallback-bg", iconColorFor(item.title, item.url));
        iconWrap.classList.add("icon-fallback");
      }

      const info = document.createElement("div");
      info.className = "journey-tab-info";

      const itemTitle = document.createElement("span");
      itemTitle.className = "journey-tab-title";
      itemTitle.textContent = readableTitle(item.title, item.url) || hostnameFor(item.url);

      const host = document.createElement("span");
      host.className = "journey-tab-host";
      host.textContent = hostnameFor(item.url);

      info.append(itemTitle, host);

      const arrow = document.createElement("span");
      arrow.className = "journey-tab-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.innerHTML = `<svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;

      row.append(iconWrap, info, arrow);

      row.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.href = item.url;
      });

      pagesList.append(row);
    });

    // Footer
    const footer = document.createElement("div");
    footer.className = "journey-card-footer";

    const resumeBtn = document.createElement("button");
    resumeBtn.className = "journey-resume-btn";
    resumeBtn.type = "button";
    resumeBtn.innerHTML = `<span>Resume Group</span><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    resumeBtn.setAttribute("aria-label", `Resume all ${journey.items.length} pages in ${journey.label}`);
    resumeBtn.addEventListener("click", () => openJourneyPages(journey.items));

    footer.append(resumeBtn);

    card.append(header, heading, pagesList, footer);
    fragment.append(card);
  });
  list.append(fragment);

  section.hidden = false;
}

function openJourneyPages(items) {
  if (!IS_EXTENSION_CONTEXT) {
    window.location.href = items[0].url;
    return;
  }
  items.forEach((item, index) => {
    chrome.tabs.create({ url: item.url, active: index === 0 });
  });
}

function journeyUrlKey(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => {
      parsed.searchParams.delete(key);
    });
    return parsed.toString();
  } catch {
    return "";
  }
}

function isSearchResultsUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return (host.endsWith("google.com") && parsed.pathname === "/search")
      || (host === "bing.com" && parsed.pathname === "/search")
      || (host === "search.yahoo.com")
      || (host === "duckduckgo.com" && parsed.searchParams.has("q"));
  } catch {
    return true;
  }
}

function dayKeyForTimestamp(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function renderEmptyPills(container) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 3; index += 1) {
    const pill = document.createElement("div");
    pill.className = "recent-pill recent-pill-empty";
    const icon = document.createElement("span");
    icon.className = "recent-pill-icon-wrap";
    const content = document.createElement("div");
    content.className = "recent-pill-content";
    const line1 = document.createElement("span");
    line1.className = "recent-pill-skeleton-line";
    const line2 = document.createElement("span");
    line2.className = "recent-pill-skeleton-line short";
    content.append(line1, line2);
    pill.append(icon, content);
    fragment.append(pill);
  }
  container.append(fragment);
}

function renderEmptyTiles(container) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 8; index += 1) {
    const tile = document.createElement("span");
    tile.className = "favorite-item favorite-item-empty";
    tile.append(document.createElement("span"), document.createElement("span"));
    fragment.append(tile);
  }
  container.append(fragment);
}

function renderMessage(container, message) {
  clearChildren(container);
  const state = document.createElement("p");
  state.className = "message-state";
  state.textContent = message;
  container.append(state);
}

function clearChildren(element) {
  element.replaceChildren();
}

function debounce(fn, delay) {
  let timeout = 0;

  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

function dedupeByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeUrl(item.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpsUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function destinationForQuery(query) {
  if (isHttpUrl(query)) return query;

  if (looksLikeUrl(query)) {
    return `https://${query}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function looksLikeUrl(value) {
  return /^[^\s]+\.[^\s]{2,}/.test(value) || /^localhost(:\d+)?(\/.*)?$/.test(value);
}

function isSearchOrInternalPage(url) {
  const host = hostnameFor(url);
  return host === "newtab" || host.endsWith(".googleusercontent.com");
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function hostnameFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function readableTitle(title, url) {
  const cleanTitle = (title || "").trim();
  if (cleanTitle && !/^untitled$/i.test(cleanTitle)) return cleanTitle;
  return titleFromUrl(url);
}

function shortTitle(title, maxLength) {
  const cleanTitle = (title || "").replace(/\s+/g, " ").trim();
  if (cleanTitle.length <= maxLength) return cleanTitle;
  return `${cleanTitle.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function initialFor(title, url) {
  const source = readableTitle(title, url) || hostnameFor(url) || "Site";
  return source.slice(0, 1).toUpperCase();
}

function relativeTime(timestamp) {
  const delta = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;

  if (delta < hour) return "Last hour";
  if (delta < day) return `${Math.max(1, Math.round(delta / hour))} hours ago`;
  if (delta < month) return `${Math.max(1, Math.round(delta / day))} days ago`;
  return `${Math.max(1, Math.round(delta / month))} months ago`;
}

function secondsToMillis(value) {
  if (!value) return 0;
  return value < 10000000000 ? value * 1000 : value;
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname
      .split("/")
      .filter(Boolean)
      .slice(0, 2)
      .join(" / ")
      .replace(/[-_]/g, " ");

    return path ? `${host} - ${path}` : host;
  } catch {
    return "";
  }
}

function loadIconSources(img, pageUrl, size, onFailure) {
  void loadIconSourcesAsync(img, pageUrl, size, onFailure);
}

async function loadIconSourcesAsync(img, pageUrl, size, onFailure) {
  const host = hostnameFor(pageUrl);
  const cached = await getCachedIcon(host, size);

  img.referrerPolicy = "no-referrer";

  if (cached) {
    img.classList.toggle("is-low-res", cached.lowResolution);
    img.src = cached.source;
    img.addEventListener("error", async () => {
      await clearCachedIconForHost(host);
      await probeAndApplyIconSources(img, pageUrl, size, onFailure);
    }, { once: true });
    return;
  }

  if (IS_EXTENSION_CONTEXT) {
    const localSource = chromeFaviconUrl(pageUrl, size);
    img.addEventListener("load", () => {
      const lowResolution = !isVectorIconUrl(localSource) &&
        (img.naturalWidth < 64 || img.naturalHeight < 64);
      img.classList.toggle("is-low-res", lowResolution);
      void setCachedIconForUrl(pageUrl, localSource, lowResolution, size);
    }, { once: true });
    img.addEventListener("error", () => {
      void probeAndApplyIconSources(img, pageUrl, size, onFailure);
    }, { once: true });
    img.src = localSource;
    return;
  }

  await probeAndApplyIconSources(img, pageUrl, size, onFailure);
}

async function probeAndApplyIconSources(img, pageUrl, size, onFailure) {
  const sources = [...new Set(iconSources(pageUrl, size))];
  const minimumUsefulSize = 64;
  let index = -1;
  let fallbackSource = "";
  let settled = false;
  let activeAttempt = 0;

  if (sources.length === 0) {
    onFailure();
    return;
  }

  const useSource = (source, lowResolution) => {
    img.classList.toggle("is-low-res", lowResolution);
    img.src = source;
    void setCachedIconForUrl(pageUrl, source, lowResolution, size);
  };

  const tryNext = () => {
    index += 1;

    if (index >= sources.length) {
      if (fallbackSource) {
        useSource(fallbackSource, true);
        return;
      }

      onFailure();
      return;
    }

    const source = sources[index];
    const probe = new Image();
    const attempt = activeAttempt + 1;
    activeAttempt = attempt;
    const timeout = window.setTimeout(() => {
      if (!settled && attempt === activeAttempt) {
        tryNext();
      }
    }, 2500);

    probe.referrerPolicy = "no-referrer";
    probe.addEventListener("load", () => {
      window.clearTimeout(timeout);

      if (settled || attempt !== activeAttempt) return;

      const lowResolution = !isVectorIconUrl(source) &&
        (probe.naturalWidth < minimumUsefulSize || probe.naturalHeight < minimumUsefulSize);

      if (!lowResolution) {
        settled = true;
        useSource(source, false);
        return;
      }

      fallbackSource ||= source;
      tryNext();
    });

    probe.addEventListener("error", () => {
      window.clearTimeout(timeout);
      if (!settled && attempt === activeAttempt) tryNext();
    });

    probe.src = source;
  };

  tryNext();
}

function iconSources(pageUrl, size) {
  if (!isHttpUrl(pageUrl)) {
    return IS_EXTENSION_CONTEXT ? [chromeFaviconUrl(pageUrl, size)] : [];
  }

  const host = hostnameFor(pageUrl);
  const highResolutionCandidates = [
    siteIconUrl(pageUrl, "apple-touch-icon.png"),
    siteIconUrl(pageUrl, "apple-touch-icon-precomposed.png"),
    siteIconUrl(pageUrl, "apple-touch-icon-180x180.png"),
    siteIconUrl(pageUrl, "apple-touch-icon-167x167.png"),
    siteIconUrl(pageUrl, "apple-touch-icon-152x152.png"),
    siteIconUrl(pageUrl, "apple-touch-icon-144x144.png"),
    siteIconUrl(pageUrl, "apple-touch-icon-120x120.png"),
    siteIconUrl(pageUrl, "android-chrome-512x512.png"),
    siteIconUrl(pageUrl, "android-chrome-192x192.png"),
    siteIconUrl(pageUrl, "favicon-512x512.png"),
    siteIconUrl(pageUrl, "favicon-256x256.png"),
    siteIconUrl(pageUrl, "favicon-192x192.png"),
    siteIconUrl(pageUrl, "favicon.svg"),
    getIconDevUrl(host),
    googleFaviconUrl(host, size),
    duckDuckGoFaviconUrl(host),
    siteIconUrl(pageUrl, "favicon.ico")
  ];

  if (!IS_EXTENSION_CONTEXT) {
    return highResolutionCandidates.filter(Boolean);
  }

  return [
    ...highResolutionCandidates,
    chromeFaviconUrl(pageUrl, size)
  ].filter(Boolean);
}

function siteIconUrl(pageUrl, fileName) {
  try {
    const parsed = new URL(pageUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return `${parsed.origin}/${fileName}`;
  } catch {
    return "";
  }
}

function getIconDevUrl(host) {
  return host ? `https://geticon.dev/?url=${encodeURIComponent(host)}` : "";
}

function googleFaviconUrl(host, size) {
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size || 128}` : "";
}

function duckDuckGoFaviconUrl(host) {
  return host ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico` : "";
}

function isVectorIconUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith(".svg") || parsed.hostname === "geticon.dev";
  } catch {
    return false;
  }
}

function chromeFaviconUrl(pageUrl, size) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString();
}

async function getCachedIcon(host, requestedSize = 0) {
  if (!host) return null;

  const cache = await getIconCache();
  const entry = cache.entries[host];
  if (!entry || !entry.source) return null;

  if (Date.now() - Number(entry.updatedAt || 0) > ICON_CACHE_TTL) {
    delete cache.entries[host];
    await saveIconCache(cache);
    return null;
  }
  if (!isVectorIconUrl(entry.source) && Number(entry.size || 0) < Math.min(Number(requestedSize || 0), 128)) {
    return null;
  }

  return {
    source: entry.source,
    lowResolution: Boolean(entry.lowResolution)
  };
}

async function setCachedIconForUrl(pageUrl, source, lowResolution, size = 0) {
  const host = hostnameFor(pageUrl);
  if (!host || !source) return;

  const cache = await getIconCache();
  cache.entries[host] = {
    source,
    lowResolution: Boolean(lowResolution),
    size: Math.max(0, Number(size || 0)),
    updatedAt: Date.now()
  };
  await saveIconCache(cache);
}

async function clearCachedIconForUrl(pageUrl) {
  await clearCachedIconForHost(hostnameFor(pageUrl));
}

async function clearCachedIconForHost(host) {
  if (!host) return;

  const cache = await getIconCache();
  if (!cache.entries[host]) return;

  delete cache.entries[host];
  await saveIconCache(cache, { immediate: true });
}

async function getIconCache() {
  if (iconCache) return iconCache;
  if (iconCachePromise) return iconCachePromise;

  iconCachePromise = getStorageValue(ICON_CACHE_KEY, null).then((value) => {
    iconCache = normalizeIconCache(value);
    iconCachePromise = null;
    return iconCache;
  });

  return iconCachePromise;
}

function normalizeIconCache(value) {
  const entries = value && typeof value === "object" && value.entries && typeof value.entries === "object"
    ? value.entries
    : {};
  const freshEntries = {};
  const now = Date.now();

  Object.entries(entries).forEach(([host, entry]) => {
    if (!host || !entry || !entry.source) return;
    if (now - Number(entry.updatedAt || 0) > ICON_CACHE_TTL) return;

    freshEntries[host] = {
      source: entry.source,
      lowResolution: Boolean(entry.lowResolution),
      size: Math.max(0, Number(entry.size || 0)),
      updatedAt: Number(entry.updatedAt || now)
    };
  });

  return {
    version: 1,
    entries: freshEntries
  };
}

function saveIconCache(cache, { immediate = false } = {}) {
  iconCache = cache === iconCache ? cache : normalizeIconCache(cache);
  iconCacheDirty = true;
  window.clearTimeout(iconCacheWriteTimeout);
  iconCacheWriteTimeout = 0;
  if (immediate) return flushIconCacheWrites();
  iconCacheWriteTimeout = window.setTimeout(() => {
    iconCacheWriteTimeout = 0;
    void flushIconCacheWrites();
  }, ICON_CACHE_WRITE_DELAY);
  return Promise.resolve();
}

function flushIconCacheWrites() {
  window.clearTimeout(iconCacheWriteTimeout);
  iconCacheWriteTimeout = 0;
  if (!iconCache || !iconCacheDirty) return iconCacheWritePromise;
  const snapshot = normalizeIconCache(iconCache);
  iconCacheDirty = false;
  iconCacheWritePromise = iconCacheWritePromise
    .catch(() => {})
    .then(() => setStorageValue(ICON_CACHE_KEY, snapshot));
  return iconCacheWritePromise;
}

function callChrome(fn, ...args) {
  if (!IS_EXTENSION_CONTEXT || typeof fn !== "function") {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    fn(...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  }).catch((error) => {
    console.warn(error);
    return [];
  });
}

function setupStorageCacheInvalidation() {
  if (!IS_EXTENSION_CONTEXT || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    Object.entries(changes).forEach(([key, change]) => {
      storageReadPromises.delete(key);
      if (typeof change.newValue === "undefined") storageValueCache.delete(key);
      else storageValueCache.set(key, change.newValue);

      if (key === CLOUD_AI_CONFIG_KEY) {
        volatileCloudAiConfig = change.newValue ?? null;
        cloudAiConfigCacheLoaded = true;
        cloudAiConfigReadPromise = null;
      }
    });
  });
}

function getStorageValue(key, fallback) {
  if (storageValueCache.has(key)) return Promise.resolve(storageValueCache.get(key));
  if (storageReadPromises.has(key)) return storageReadPromises.get(key);

  if (!IS_EXTENSION_CONTEXT) {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      storageValueCache.set(key, fallback);
      return Promise.resolve(fallback);
    }

    try {
      const value = JSON.parse(stored);
      storageValueCache.set(key, value);
      return Promise.resolve(value);
    } catch {
      const value = stored || fallback;
      storageValueCache.set(key, value);
      return Promise.resolve(value);
    }
  }

  const read = new Promise((resolve) => {
    chrome.storage.local.get({ [key]: fallback }, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn(error);
        resolve(fallback);
        return;
      }
      storageValueCache.set(key, items[key]);
      resolve(items[key]);
    });
  }).finally(() => {
    storageReadPromises.delete(key);
  });
  storageReadPromises.set(key, read);
  return read;
}

function setStorageValue(key, value) {
  if (!IS_EXTENSION_CONTEXT) {
    if (value === null || typeof value === "undefined") {
      localStorage.removeItem(key);
      storageValueCache.delete(key);
      return Promise.resolve();
    }

    localStorage.setItem(key, JSON.stringify(value));
    storageValueCache.set(key, value);
    return Promise.resolve();
  }

  const hadCachedValue = storageValueCache.has(key);
  const previousCachedValue = storageValueCache.get(key);
  storageValueCache.set(key, value);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn(error);
        if (hadCachedValue) storageValueCache.set(key, previousCachedValue);
        else storageValueCache.delete(key);
      }
      resolve();
    });
  });
}

function ensureTrustedLocalStorageAccess() {
  if (!IS_EXTENSION_CONTEXT || typeof chrome.storage.local.setAccessLevel !== "function") {
    return Promise.resolve();
  }
  if (trustedLocalStoragePromise) return trustedLocalStoragePromise;

  trustedLocalStoragePromise = new Promise((resolve, reject) => {
    chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        const storageError = new Error(error.message);
        storageError.name = "PersistentStorageError";
        reject(storageError);
        return;
      }
      resolve();
    });
  }).catch((error) => {
    trustedLocalStoragePromise = null;
    throw error;
  });

  return trustedLocalStoragePromise;
}

async function getCloudAiConfigValue() {
  if (cloudAiConfigCacheLoaded) return volatileCloudAiConfig;
  if (cloudAiConfigReadPromise) return cloudAiConfigReadPromise;
  if (!IS_EXTENSION_CONTEXT) {
    cloudAiConfigCacheLoaded = true;
    return volatileCloudAiConfig;
  }

  cloudAiConfigReadPromise = (async () => {
    try {
      await ensureTrustedLocalStorageAccess();
    } catch (error) {
      console.warn("Unable to restrict Gemini key storage to trusted extension contexts", error.message);
      return null;
    }

    return new Promise((resolve) => {
      chrome.storage.local.get({ [CLOUD_AI_CONFIG_KEY]: null }, (items) => {
        const error = chrome.runtime.lastError;
        if (error) {
          console.warn("Unable to read device-local Gemini settings", error.message);
          resolve(null);
          return;
        }
        resolve(items[CLOUD_AI_CONFIG_KEY]);
      });
    });
  })().then((value) => {
    volatileCloudAiConfig = value;
    cloudAiConfigCacheLoaded = true;
    return value;
  }).finally(() => {
    cloudAiConfigReadPromise = null;
  });
  return cloudAiConfigReadPromise;
}

async function setCloudAiConfigValue(value) {
  if (!IS_EXTENSION_CONTEXT) {
    volatileCloudAiConfig = value;
    cloudAiConfigCacheLoaded = true;
    return;
  }

  await ensureTrustedLocalStorageAccess();
  return new Promise((resolve, reject) => {
    const operation = value === null || typeof value === "undefined"
      ? chrome.storage.local.remove.bind(chrome.storage.local)
      : chrome.storage.local.set.bind(chrome.storage.local);
    const payload = value === null || typeof value === "undefined"
      ? CLOUD_AI_CONFIG_KEY
      : { [CLOUD_AI_CONFIG_KEY]: value };
    operation(payload, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn("Unable to update device-local Gemini settings", error.message);
        const storageError = new Error(error.message);
        storageError.name = "PersistentStorageError";
        reject(storageError);
        return;
      }
      volatileCloudAiConfig = value;
      cloudAiConfigCacheLoaded = true;
      storageValueCache.delete(CLOUD_AI_CONFIG_KEY);
      resolve();
    });
  });
}

function getSessionStorageValue(key, fallback) {
  if (!IS_EXTENSION_CONTEXT || !chrome.storage.session) {
    return Promise.resolve(volatileSessionStorage.has(key) ? volatileSessionStorage.get(key) : fallback);
  }

  return new Promise((resolve) => {
    chrome.storage.session.get({ [key]: fallback }, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn("Unable to read session AI refresh state", error.message);
        resolve(fallback);
        return;
      }
      resolve(items[key]);
    });
  });
}

function setSessionStorageValue(key, value) {
  if (!IS_EXTENSION_CONTEXT || !chrome.storage.session) {
    if (value === null || typeof value === "undefined") volatileSessionStorage.delete(key);
    else volatileSessionStorage.set(key, value);
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    chrome.storage.session.set({ [key]: value }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn("Unable to update session AI refresh state", error.message);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function iconColorFor(title, url) {
  const source = `${title || ""}${url || ""}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash + source.charCodeAt(index) * (index + 1)) % iconColors.length;
  }

  return iconColors[hash];
}
