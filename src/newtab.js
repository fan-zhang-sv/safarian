"use strict";

const MAX_RECENT = 9;
const MAX_FAVORITES = 44;
const MAX_SUGGESTIONS = 6;
const HISTORY_RANGE_DAYS = 120;
const STORAGE_KEY = "recentClosedClearedAt";
const BACKGROUND_KEY = "landingBackground";
const APPEARANCE_KEY = "landingAppearance";
const ICON_CACHE_KEY = "faviconCache";
const ICON_CACHE_TTL = 14 * 24 * 60 * 60 * 1000;
const IS_EXTENSION_CONTEXT = hasExtensionApis();
let favoritesState = [];
let favoritesEditMode = false;
let editingFavoriteIndex = null;
let favoriteMenuIndex = null;
let reorderSourceIndex = null;
let favoriteDrag = null;
let favoriteDropIndex = null;
let suppressFavoriteClick = false;
let bookmarksBarId = null;
let iconCache = null;
let iconCachePromise = null;

const palette = [
  ["#367fe7", "#1a5fc2"],
  ["#17458e", "#102f64"],
  ["#48649b", "#24436f"],
  ["#10572f", "#082d18"],
  ["#4b5580", "#252f52"],
  ["#263e65", "#172842"],
  ["#267293", "#143f57"],
  ["#625391", "#382f69"]
];

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
  const searchForm = document.querySelector("#search-form");
  const searchInput = document.querySelector("#search-input");

  clearButton.addEventListener("click", async () => {
    await setStorageValue(STORAGE_KEY, Date.now());
    await renderRecentlyClosed();
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    window.location.href = destinationForQuery(query);
  });

  setHeaderText();
  setupCustomizeControls();
  setupFavoriteEditor();
  setupFavoriteContextMenu();
  setupBookmarkMirrorListeners();
  loadPage();
});

async function loadPage() {
  await Promise.all([
    renderRecentlyClosed(),
    renderFavorites(),
    renderSuggestions()
  ]);
}

function hasExtensionApis() {
  return Boolean(
    globalThis.chrome &&
      chrome.runtime &&
      typeof chrome.runtime.getURL === "function" &&
      chrome.bookmarks &&
      chrome.history &&
      chrome.sessions &&
      chrome.storage &&
      chrome.topSites
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
  const appearanceButtons = document.querySelectorAll("[data-appearance]");
  const urlInput = document.querySelector("#background-url");
  const saveButton = document.querySelector("#background-save");
  const randomButton = document.querySelector("#background-random");
  const clearButton = document.querySelector("#background-clear");
  const fileInput = document.querySelector("#background-file");

  await applyStoredAppearance();
  await applyStoredBackground();

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

  const refresh = debounce(async () => {
    if (!favoritesEditMode) {
      await renderFavorites();
    }
  }, 120);

  chrome.bookmarks.onCreated.addListener(refresh);
  chrome.bookmarks.onChanged.addListener(refresh);
  chrome.bookmarks.onMoved.addListener(refresh);
  chrome.bookmarks.onRemoved.addListener(refresh);
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

async function renderRecentlyClosed() {
  const recentList = document.querySelector("#recent-list");
  const clearButton = document.querySelector("#clear-recent");
  clearChildren(recentList);

  const clearedAt = await getStorageValue(STORAGE_KEY, 0);
  const items = await loadRecentlyClosed()
    .then((sessions) => sessions.map(normalizeSession).filter(Boolean))
    .then((sessions) => sessions.length ? sessions : (IS_EXTENSION_CONTEXT ? [] : fallbackRecent))
    .then((sessions) => sessions
    .filter((item) => item.lastModified > clearedAt)
    .slice(0, MAX_RECENT));

  clearButton.hidden = items.length === 0;

  if (items.length === 0) {
    renderEmptyPills(recentList);
    return;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "recent-pill";
    button.type = "button";
    button.title = item.title;
    button.textContent = item.title;
    button.addEventListener("click", () => {
      if (IS_EXTENSION_CONTEXT && !item.sessionId.startsWith("preview-")) {
        chrome.sessions.restore(item.sessionId);
        return;
      }
      window.location.href = item.url;
    });
    recentList.append(button);
  });
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
      lastModified: secondsToMillis(session.lastModified)
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
      lastModified: secondsToMillis(session.lastModified)
    };
  }

  return null;
}

async function renderFavorites() {
  const favoritesList = document.querySelector("#favorites-list");
  clearChildren(favoritesList);

  const favorites = await loadFavorites();
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
    .slice(0, MAX_FAVORITES)
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

  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;

    if (node.id === "1" || /bookmarks bar|favorites/i.test(node.title || "")) {
      return node;
    }

    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }

  return null;
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
    index: toIndex
  });
}

async function renderSuggestions() {
  const suggestionsList = document.querySelector("#suggestions-list");
  clearChildren(suggestionsList);

  const suggestions = await loadSuggestions();

  if (suggestions.length === 0) {
    renderEmptyCards(suggestionsList);
    return;
  }

  suggestions.slice(0, MAX_SUGGESTIONS).forEach((suggestion, index) => {
    const colors = palette[index % palette.length];
    const card = document.createElement("button");
    card.className = "suggestion-card";
    card.type = "button";
    card.style.setProperty("--card-start", colors[0]);
    card.style.setProperty("--card-end", colors[1]);
    card.title = `${suggestion.title}\n${suggestion.url}`;
    card.addEventListener("click", () => {
      window.location.href = suggestion.url;
    });

    const media = document.createElement("span");
    media.className = "suggestion-media";
    media.style.setProperty("--fallback-bg", iconColorFor(suggestion.title, suggestion.url));

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    loadIconSources(img, suggestion.url, 160, () => {
      img.hidden = true;
      media.textContent = initialFor(suggestion.title, suggestion.url);
      media.classList.add("icon-fallback");
    });

    const body = document.createElement("span");
    body.className = "suggestion-body";

    const title = document.createElement("span");
    title.className = "suggestion-title";
    title.textContent = shortTitle(suggestion.title || hostnameFor(suggestion.url), 28);

    const domain = document.createElement("span");
    domain.className = "suggestion-domain";
    domain.textContent = hostnameFor(suggestion.url);

    const time = document.createElement("span");
    time.className = "suggestion-time";
    time.textContent = suggestion.lastVisitTime
      ? relativeTime(suggestion.lastVisitTime)
      : "Frequently visited";

    media.append(img);
    body.append(title, domain, time);
    card.append(media, body);
    suggestionsList.append(card);
  });
}

async function loadSuggestions() {
  if (!IS_EXTENSION_CONTEXT) return fallbackSuggestions;
  const historyItems = await loadHistorySuggestions();
  if (historyItems.length) return historyItems;
  return loadTopSiteSuggestions();
}

async function loadHistorySuggestions() {
  const startTime = Date.now() - HISTORY_RANGE_DAYS * 24 * 60 * 60 * 1000;
  const history = await callChrome(chrome.history.search, {
    text: "",
    startTime,
    maxResults: 80
  });

  const byHost = new Map();

  history
    .filter((item) => item.url && isHttpUrl(item.url))
    .filter((item) => !isSearchOrInternalPage(item.url))
    .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0))
    .forEach((item) => {
      const host = hostnameFor(item.url);
      if (!host || byHost.has(host)) return;
      byHost.set(host, {
        title: readableTitle(item.title, item.url),
        url: item.url,
        lastVisitTime: item.lastVisitTime || 0
      });
    });

  return [...byHost.values()];
}

async function loadTopSiteSuggestions() {
  const topSites = await callChrome(chrome.topSites.get);
  return topSites
    .filter((site) => site.url && isHttpUrl(site.url))
    .filter((site) => !isSearchOrInternalPage(site.url))
    .map((site) => ({
      title: readableTitle(site.title, site.url),
      url: site.url,
      lastVisitTime: 0
    }));
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

function renderEmptyCards(container) {
  for (let index = 0; index < 4; index += 1) {
    const card = document.createElement("span");
    card.className = "suggestion-card suggestion-card-empty";
    container.append(card);
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
