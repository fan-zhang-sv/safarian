"use strict";

const MAX_RECENT = 9;
const STORAGE_KEY = "recentClosedClearedAt";
const BACKGROUND_KEY = "landingBackground";
const APPEARANCE_KEY = "landingAppearance";
const THEME_KEY = "landingTheme";
const ICON_CACHE_KEY = "faviconCache";
const RECENT_ORGANIZATION_CACHE_KEY = "recentClosedOrganization";
const CONTINUE_JOURNEY_CACHE_KEY = "continueJourneys";
const AI_ATTEMPT_STATE_KEY = "browserAiAttemptState";
const AI_ORGANIZER_LOCK_NAME = "safarian-browser-ai-organizer";
const ICON_CACHE_TTL = 14 * 24 * 60 * 60 * 1000;
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
let recentDisplayMode = "smart";
let recentItemsState = [];
let recentRenderRequest = 0;
let browserOrganizerSession = null;
let browserOrganizerSessionPromise = null;
let browserOrganizerPromptQueue = Promise.resolve();

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
  const clearButton = document.querySelector("#clear-recent");
  const recentOrganizeButton = document.querySelector("#recent-organize");
  const searchForm = document.querySelector("#search-form");
  const searchInput = document.querySelector("#search-input");
  const recallButton = document.querySelector("#recall-button");
  const recallClose = document.querySelector("#recall-close");

  clearButton.addEventListener("click", async () => {
    await setStorageValue(STORAGE_KEY, Date.now());
    await renderRecentlyClosed();
  });

  recentOrganizeButton.addEventListener("click", async () => {
    if (recentDisplayMode === "smart") {
      recentDisplayMode = "recent";
      await renderRecentlyClosed();
      return;
    }

    recentDisplayMode = "smart";
    await renderRecentlyClosed({ forceOrganize: true, allowDownload: true });
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
  setupFavoriteEditor();
  setupFavoriteContextMenu();
  setupBookmarkMirrorListeners();
  void updateRecallAvailabilityHint();
  loadPage();
});

window.addEventListener("pagehide", () => {
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
  await Promise.all([
    renderRecentlyClosed(),
    renderFavorites()
  ]);
  await renderContinueJourneys();
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

  await applyStoredTheme();
  await applyStoredAppearance();
  await applyStoredBackground();

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

async function renderRecentlyClosed({ forceOrganize = false, allowDownload = false } = {}) {
  const request = ++recentRenderRequest;
  const recentList = document.querySelector("#recent-list");
  clearChildren(recentList);

  const clearedAt = await getStorageValue(STORAGE_KEY, 0);
  const items = await loadRecentlyClosed()
    .then((sessions) => sessions.map(normalizeSession).filter(Boolean))
    .then((sessions) => sessions.length ? sessions : (IS_EXTENSION_CONTEXT ? [] : fallbackRecent))
    .then((sessions) => sessions
    .filter((item) => item.lastModified > clearedAt)
    .slice(0, 25));

  if (request !== recentRenderRequest) return;

  recentItemsState = items;
  updateRecentControls(items);

  if (items.length === 0) {
    renderEmptyPills(recentList);
    return;
  }

  renderRecentChronological(recentList, items.slice(0, MAX_RECENT));

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

  const fingerprint = recentOrganizationFingerprint(organizableItems);
  const cached = await getStorageValue(RECENT_ORGANIZATION_CACHE_KEY, null);
  const cachedGroups = hydrateRecentOrganization(cached, fingerprint, organizableItems);

  if (cachedGroups.length && !forceOrganize) {
    renderOrganizedRecent(recentList, cachedGroups, items.length);
    return;
  }

  setRecentOrganizationBusy(true, "AI is reviewing your closed tabs…");
  let result;
  try {
    result = await runRateLimitedAiTask({
      feature: "recent",
      fingerprint,
      force: forceOrganize,
      loadCached: async () => {
        const latestCache = await getStorageValue(RECENT_ORGANIZATION_CACHE_KEY, null);
        const groups = hydrateRecentOrganization(latestCache, fingerprint, organizableItems);
        return groups.length ? { status: "success", groups } : null;
      },
      saveSuccess: (success) => setStorageValue(
        RECENT_ORGANIZATION_CACHE_KEY,
        serializeRecentOrganization(fingerprint, success.groups)
      ),
      task: () => generateRecentOrganization(organizableItems, {
        allowDownload,
        onStatus: (message) => setRecentOrganizationNote(message, "loading")
      })
    });
  } catch (error) {
    console.warn("Chrome built-in Gemini recent-tab orchestration failed", describeGeminiError(error));
    resetBrowserOrganizerSession();
    result = { status: "error", groups: [] };
  }
  if (request !== recentRenderRequest) return;

  setRecentOrganizationBusy(false);

  if (result.status === "success" && result.groups.length) {
    renderOrganizedRecent(recentList, result.groups, items.length);
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
  items.forEach((item) => container.append(createRecentButton(item)));
}

function renderOrganizedRecent(container, groups, totalItemCount) {
  container.className = "recent-grid recent-grid-organized";
  clearChildren(container);

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
    container.append(section);
  });

  updateRecentControls(recentItemsState);
  setRecentOrganizationNote(`Organized privately by AI · ${groups.reduce((sum, group) => sum + group.items.length, 0)} picks from ${totalItemCount}`, "ready");
}

function createRecentButton(item, { reason = "", topPick = false } = {}) {
  const button = document.createElement("button");
  button.className = `recent-pill${topPick ? " is-top-pick" : ""}`;
  button.type = "button";
  button.title = reason ? `${item.title}\n${reason}` : item.title;

  if (item.url && !item.url.startsWith("chrome://newtab")) {
    const img = document.createElement("img");
    img.className = "recent-pill-icon";
    img.alt = "";
    img.loading = "lazy";
    loadIconSources(img, item.url, 64, () => {
      img.hidden = true;
    });
    button.append(img);
  } else {
    const emptyIcon = document.createElement("div");
    emptyIcon.className = "recent-pill-icon";
    button.append(emptyIcon);
  }

  const text = document.createElement("span");
  text.className = "recent-pill-text";
  text.textContent = item.title;
  button.append(text);

  if (topPick) {
    const badge = document.createElement("span");
    badge.className = "recent-top-pick";
    badge.textContent = "Top pick";
    button.append(badge);
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
  const organizeLabel = organizeButton.querySelector("span");
  const hasItems = items.length > 0;

  clearButton.hidden = !hasItems;
  organizeButton.hidden = items.length < 3;
  organizeButton.setAttribute("aria-busy", "false");
  organizeButton.setAttribute("aria-pressed", String(recentDisplayMode === "smart"));
  organizeLabel.textContent = recentDisplayMode === "smart" ? "Recent order" : "Organize";
  organizeButton.title = recentDisplayMode === "smart"
    ? "Return to Chrome's chronological order"
    : "Group and rank recently closed tabs with on-device Gemini";

  if (!hasItems || recentDisplayMode === "recent") {
    setRecentOrganizationNote("");
  }
}

function setRecentOrganizationBusy(busy, note = "") {
  const button = document.querySelector("#recent-organize");
  const section = document.querySelector(".section-recent");
  const list = document.querySelector("#recent-list");
  button.setAttribute("aria-busy", String(busy));
  section.classList.toggle("is-ai-working", busy);
  list.setAttribute("aria-busy", String(busy));
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

function recentOrganizationFingerprint(items) {
  return items.map((item) => `${item.sessionId}:${item.lastModified}`).join("|");
}

function hydrateRecentOrganization(cache, fingerprint, items) {
  if (!cache || cache.fingerprint !== fingerprint || !Array.isArray(cache.groups)) return [];
  if (Date.now() - Number(cache.createdAt || 0) > RECENT_ORGANIZATION_CACHE_TTL) return [];

  const bySessionId = new Map(items.map((item) => [item.sessionId, item]));
  return cache.groups
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

function serializeRecentOrganization(fingerprint, groups) {
  return {
    fingerprint,
    createdAt: Date.now(),
    groups: groups.map((group) => ({
      label: group.label,
      items: group.items.map((entry) => ({
        sessionId: entry.item.sessionId,
        reason: entry.reason
      }))
    }))
  };
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
    if (!force && previous?.fingerprint === fingerprint && Number(previous.retryAt || 0) > now) {
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

    const session = await LanguageModel.create({
      ...LANGUAGE_MODEL_OPTIONS,
      initialPrompts: [{
        role: "system",
        content: "You organize real browser activity into useful task groups. You never invent pages or sessions."
      }],
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          const progress = Math.max(0, Math.min(100, Math.round(event.loaded * 100)));
          onStatus(progress < 100
            ? `Downloading on-device Gemini · ${progress}%`
            : "Loading Gemini on this device…");
        });
      }
    });
    return { status: "success", session };
  } catch (error) {
    console.warn("Chrome built-in Gemini organizer session failed", error);
    return { status: "error", session: null };
  }
}

async function generateRecentOrganization(items, { allowDownload, onStatus }) {
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
    return { status: groups.length ? "success" : "empty", groups };
  } catch (error) {
    console.warn("Chrome built-in Gemini tab organization failed", describeGeminiError(error));
    resetBrowserOrganizerSession();
    return { status: "error", groups: [] };
  }
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

  favorites.forEach((bookmark, index) => {
    const item = document.createElement("div");
    item.className = "favorite-item";
    item.role = "button";
    item.tabIndex = 0;
    item.draggable = false;
    item.dataset.index = String(index);
    item.title = `${bookmark.title || hostnameFor(bookmark.url)}\n${bookmark.url}`;
    item.addEventListener("dragstart", (event) => {
      event.preventDefault();
    });
    item.addEventListener("contextmenu", (event) => {
      showFavoriteMenu(event, index);
    });
    item.addEventListener("pointerdown", (event) => {
      startFavoritePointerReorder(event, index);
    });

    item.addEventListener("click", (event) => {
      if (suppressFavoriteClick) {
        event.preventDefault();
        suppressFavoriteClick = false;
        return;
      }

      if (favoritesEditMode) {
        event.preventDefault();
        return;
      }

      window.location.href = bookmark.url;
    });

    item.addEventListener("keydown", (event) => {
      if (favoritesEditMode || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      window.location.href = bookmark.url;
    });

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
    favoritesList.append(item);
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

function startFavoritePointerReorder(event, index) {
  if (event.button !== 0 || favoriteDrag) return;

  event.preventDefault();
  hideFavoriteMenu();

  const item = event.currentTarget;
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

async function renderContinueJourneys() {
  const section = document.querySelector("#continue-section");
  const badgeLabel = document.querySelector("#continue-badge-label");

  hideContinueSection();
  if (SHOW_AI_LOADING_PREVIEW) {
    renderContinueLoading("AI is connecting related pages into useful journeys…");
    return;
  }

  if (IS_EXTENSION_CONTEXT) {
    renderContinueLoading("AI is checking your recent activity for work worth resuming…");
  }

  const candidates = await loadContinueCandidates();
  if (candidates.length < 2) {
    hideContinueSection();
    return;
  }

  if (!IS_EXTENSION_CONTEXT) {
    renderContinueJourneyCards(previewContinueJourneys(candidates));
    badgeLabel.textContent = "Preview data";
    return;
  }

  const fingerprint = continueJourneyFingerprint(candidates);
  const cached = await getStorageValue(CONTINUE_JOURNEY_CACHE_KEY, null);
  const cachedJourneys = hydrateContinueJourneys(cached, fingerprint, candidates);
  if (cachedJourneys.length) {
    renderContinueJourneyCards(cachedJourneys);
    return;
  }

  try {
    const result = await runRateLimitedAiTask({
      feature: "continue",
      fingerprint,
      loadCached: async () => {
        const latestCache = await getStorageValue(CONTINUE_JOURNEY_CACHE_KEY, null);
        const journeys = hydrateContinueJourneys(latestCache, fingerprint, candidates);
        return journeys.length ? { status: "success", journeys } : null;
      },
      saveSuccess: (success) => setStorageValue(
        CONTINUE_JOURNEY_CACHE_KEY,
        serializeContinueJourneys(fingerprint, success.journeys)
      ),
      task: async () => {
        const sessionResult = await getBrowserOrganizerSession({ allowDownload: false });
        if (sessionResult.status !== "success") {
          return { status: sessionResult.status, journeys: [] };
        }

        setContinueLoadingMessage("AI is connecting related pages into useful journeys…");
        const journeys = await runBrowserOrganizerPrompt(
          sessionResult.session,
          (promptSession) => rankContinueJourneysWithGemini(promptSession, candidates)
        );
        return { status: journeys.length ? "success" : "empty", journeys };
      }
    });
    if (result.status !== "success" || !result.journeys.length) {
      hideContinueSection();
      return;
    }
    renderContinueJourneyCards(result.journeys);
  } catch (error) {
    console.warn("Chrome built-in Gemini Continue grouping failed", describeGeminiError(error));
    resetBrowserOrganizerSession();
    hideContinueSection();
  }
}

function renderContinueLoading(message) {
  const section = document.querySelector("#continue-section");
  const list = document.querySelector("#continue-list");
  const badgeLabel = document.querySelector("#continue-badge-label");
  const currentTheme = normalizeThemeName(document.documentElement.dataset.themeName || "classic");
  const activePalette = themePalettes[currentTheme] || themePalettes.classic;

  section.hidden = false;
  section.classList.add("is-ai-working");
  section.setAttribute("aria-busy", "true");
  badgeLabel.textContent = "AI working on-device";
  setContinueLoadingMessage(message);
  clearChildren(list);

  for (let index = 0; index < 3; index += 1) {
    const colors = activePalette[index % activePalette.length];
    const card = document.createElement("article");
    card.className = "journey-card journey-card-loading";
    card.style.setProperty("--card-start", colors[0]);
    card.style.setProperty("--card-end", colors[1]);
    card.setAttribute("aria-hidden", "true");

    const header = document.createElement("div");
    header.className = "journey-loading-header";
    const icons = document.createElement("span");
    icons.className = "journey-loading-icons";
    icons.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    const signal = document.createElement("span");
    signal.className = "journey-loading-shape journey-loading-signal";
    header.append(icons, signal);

    const title = document.createElement("span");
    title.className = "journey-loading-shape journey-loading-title";
    const sites = document.createElement("span");
    sites.className = "journey-loading-shape journey-loading-sites";
    const evidence = document.createElement("span");
    evidence.className = "journey-loading-shape journey-loading-evidence";
    const actions = document.createElement("div");
    actions.className = "journey-loading-actions";
    actions.append(document.createElement("span"), document.createElement("span"));

    card.append(header, title, sites, evidence, actions);
    list.append(card);
  }
}

function setContinueLoadingMessage(message) {
  const subtitle = document.querySelector("#continue-subtitle");
  subtitle.textContent = message;
}

function hideContinueSection() {
  const section = document.querySelector("#continue-section");
  const list = document.querySelector("#continue-list");
  section.hidden = true;
  section.classList.remove("is-ai-working");
  section.setAttribute("aria-busy", "false");
  document.querySelector("#continue-subtitle").textContent = "Ongoing journeys from your recent activity";
  document.querySelector("#continue-badge-label").textContent = "Grouped on-device";
  clearChildren(list);
}

async function loadContinueCandidates() {
  if (!IS_EXTENSION_CONTEXT) return previewContinueCandidates();

  const startTime = Date.now() - CONTINUE_RANGE_DAYS * 24 * 60 * 60 * 1000;
  const excludedUrls = new Set([
    ...favoritesState.map((item) => journeyUrlKey(item.url)),
    ...recentItemsState.map((item) => journeyUrlKey(item.url))
  ].filter(Boolean));
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
      if (!key || excludedUrls.has(key) || byUrl.has(key)) return;
      byUrl.set(key, item);
    });

  const detailed = await Promise.all([...byUrl.values()].slice(0, 36).map(async (item) => {
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
  }));

  return detailed
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

function continueJourneyFingerprint(candidates) {
  return candidates.map((item) => (
    `${journeyUrlKey(item.url)}:${item.visitCount}:${item.visitDays.length}:${item.lastVisitTime}`
  )).join("|");
}

function hydrateContinueJourneys(cache, fingerprint, candidates) {
  if (!cache || cache.fingerprint !== fingerprint || !Array.isArray(cache.journeys)) return [];
  if (Date.now() - Number(cache.createdAt || 0) > CONTINUE_JOURNEY_CACHE_TTL) return [];

  const byUrl = new Map(candidates.map((item) => [journeyUrlKey(item.url), item]));
  return cache.journeys
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

function serializeContinueJourneys(fingerprint, journeys) {
  return {
    fingerprint,
    createdAt: Date.now(),
    journeys: journeys.map((journey) => ({
      label: journey.label,
      urls: journey.items.map((item) => item.url)
    }))
  };
}

function renderContinueJourneyCards(journeys) {
  const section = document.querySelector("#continue-section");
  const list = document.querySelector("#continue-list");
  const subtitle = document.querySelector("#continue-subtitle");
  const badgeLabel = document.querySelector("#continue-badge-label");
  const currentTheme = normalizeThemeName(document.documentElement.dataset.themeName || "classic");
  const activePalette = themePalettes[currentTheme] || themePalettes.classic;
  section.classList.remove("is-ai-working");
  section.setAttribute("aria-busy", "false");
  subtitle.textContent = "Ongoing journeys from your recent activity";
  badgeLabel.textContent = "Grouped on-device";
  clearChildren(list);

  journeys.forEach((journey, index) => {
    const colors = activePalette[index % activePalette.length];
    const card = document.createElement("article");
    card.className = "journey-card";
    card.style.setProperty("--card-start", colors[0]);
    card.style.setProperty("--card-end", colors[1]);

    const header = document.createElement("div");
    header.className = "journey-card-header";
    const icons = createJourneyIconStack(journey.items);
    const signal = document.createElement("span");
    signal.className = "journey-signal";
    signal.textContent = "Ongoing";
    header.append(icons, signal);

    const title = document.createElement("h3");
    title.textContent = journey.label;
    const sites = document.createElement("p");
    sites.className = "journey-sites";
    sites.textContent = [...new Set(journey.items.map((item) => hostnameFor(item.url)))].slice(0, 3).join(" · ");

    const activeDays = new Set(journey.items.flatMap((item) => item.visitDays)).size;
    const visits = journey.items.reduce((sum, item) => sum + item.visitCount, 0);
    const evidence = document.createElement("p");
    evidence.className = "journey-evidence";
    evidence.textContent = `${visits} visits across ${activeDays} active days`;

    const actions = document.createElement("div");
    actions.className = "journey-actions";
    const continueButton = document.createElement("button");
    continueButton.className = "journey-continue";
    continueButton.type = "button";
    continueButton.textContent = "Continue";
    continueButton.addEventListener("click", () => {
      window.location.href = journey.items[0].url;
    });

    const arrow = document.createElement("span");
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");
    continueButton.append(arrow);
    actions.append(continueButton);

    if (journey.items.length > 1) {
      const openAll = document.createElement("button");
      openAll.className = "journey-open-all";
      openAll.type = "button";
      openAll.textContent = `Open ${journey.items.length}`;
      openAll.setAttribute("aria-label", `Open all ${journey.items.length} pages in ${journey.label}`);
      openAll.addEventListener("click", () => openJourneyPages(journey.items));
      actions.append(openAll);
    }

    card.append(header, title, sites, evidence, actions);
    list.append(card);
  });

  section.hidden = false;
}

function createJourneyIconStack(items) {
  const stack = document.createElement("div");
  stack.className = "journey-icon-stack";
  items.slice(0, 3).forEach((item) => {
    const icon = document.createElement("span");
    icon.className = "journey-icon";
    icon.textContent = initialFor(item.title, item.url);
    icon.style.setProperty("--fallback-bg", iconColorFor(item.title, item.url));
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    loadIconSources(img, item.url, 64, () => img.remove());
    icon.append(img);
    stack.append(icon);
  });
  return stack;
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
  for (let index = 0; index < 3; index += 1) {
    const pill = document.createElement("span");
    pill.className = "recent-pill recent-pill-empty";
    container.append(pill);
  }
}

function renderEmptyTiles(container) {
  for (let index = 0; index < 8; index += 1) {
    const tile = document.createElement("span");
    tile.className = "favorite-item favorite-item-empty";
    tile.append(document.createElement("span"), document.createElement("span"));
    container.append(tile);
  }
}

function renderMessage(container, message) {
  clearChildren(container);
  const state = document.createElement("p");
  state.className = "message-state";
  state.textContent = message;
  container.append(state);
}

function clearChildren(element) {
  while (element.firstChild) {
    element.firstChild.remove();
  }
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
  const cached = await getCachedIcon(host);

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
    void setCachedIconForUrl(pageUrl, source, lowResolution);
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

async function getCachedIcon(host) {
  if (!host) return null;

  const cache = await getIconCache();
  const entry = cache.entries[host];
  if (!entry || !entry.source) return null;

  if (Date.now() - Number(entry.updatedAt || 0) > ICON_CACHE_TTL) {
    delete cache.entries[host];
    await saveIconCache(cache);
    return null;
  }

  return {
    source: entry.source,
    lowResolution: Boolean(entry.lowResolution)
  };
}

async function setCachedIconForUrl(pageUrl, source, lowResolution) {
  const host = hostnameFor(pageUrl);
  if (!host || !source) return;

  const cache = await getIconCache();
  cache.entries[host] = {
    source,
    lowResolution: Boolean(lowResolution),
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
  await saveIconCache(cache);
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
      updatedAt: Number(entry.updatedAt || now)
    };
  });

  return {
    version: 1,
    entries: freshEntries
  };
}

async function saveIconCache(cache) {
  iconCache = normalizeIconCache(cache);
  await setStorageValue(ICON_CACHE_KEY, iconCache);
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

function getStorageValue(key, fallback) {
  if (!IS_EXTENSION_CONTEXT) {
    const stored = localStorage.getItem(key);
    if (stored === null) return Promise.resolve(fallback);

    try {
      return Promise.resolve(JSON.parse(stored));
    } catch {
      return Promise.resolve(stored || fallback);
    }
  }

  return new Promise((resolve) => {
    chrome.storage.local.get({ [key]: fallback }, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn(error);
        resolve(fallback);
        return;
      }
      resolve(items[key]);
    });
  });
}

function setStorageValue(key, value) {
  if (!IS_EXTENSION_CONTEXT) {
    if (value === null || typeof value === "undefined") {
      localStorage.removeItem(key);
      return Promise.resolve();
    }

    localStorage.setItem(key, JSON.stringify(value));
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn(error);
      }
      resolve();
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
