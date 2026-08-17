# Safarian

A Chrome extension that replaces Chrome's new tab page with an elegant personal landing page.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Choose `Load unpacked`.
4. Select this folder: `/Users/felixzhang/Developer/React/safari-landing`.
5. Open a new tab.

## Build for Chrome Web Store

Run:

```sh
./scripts/build-release.sh
```

The script validates the manifest and JavaScript, checks required icon and listing asset sizes, and writes a minimal Chrome Web Store zip to `dist/`.

## Privacy Policy Website

The Chrome Web Store privacy policy site lives in `docs/` and is deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` when changes are pushed to `main` or `master`.

After the repository is published on GitHub, use this URL pattern in the Chrome Web Store Developer Dashboard:

```text
https://<github-username>.github.io/<repository-name>/
```

## Data Sources

- Recently Closed Tabs: Chrome Sessions API, with the Tabs permission so Chrome exposes tab titles and URLs
- Smart Recent Tabs: ranks up to 18 eligible recoverable web sessions, selects the most useful nine, and groups them into active tasks. The default on-device path runs only when Gemini Nano is already available and never starts a background model download. Users can explicitly opt in to Gemini Flash with their own device-local key. Fingerprinted results are cached locally for six hours, duplicate work is serialized across new tabs, and users can always switch back to chronological order.
- Favorites: Chrome Bookmarks Bar in mirror mode. Direct URL bookmarks are shown; folders are skipped. Add, edit, remove, and reorder actions update real Chrome bookmarks.
- Continue: repeat activity across multiple days from the last 30 days, excluding exact Favorite and Recently Closed URLs. Gemini Nano or the explicitly enabled Gemini Flash mode groups only strong related activity into up to three ongoing journeys. Fingerprinted results are cached for 12 hours; empty results, unavailable-model states, and failures use cooldowns with exponential backoff. When no strong journey is ready, the section stays stable and explains what it is waiting for instead of disappearing.
- Recall: Chrome's built-in Prompt API (Gemini Nano) semantically ranks real pages from up to 180 days of local history when the user explicitly selects Recall. Page titles and URL paths are processed on-device; generated URLs are never accepted. If Gemini is unavailable, Recall falls back to literal local title and address matching.
- Favicons: high-resolution Apple touch, PWA, SVG, and root icon candidates first, then geticon.dev, Google, DuckDuckGo, and Chrome's built-in `_favicon` endpoint as fallbacks. The chosen icon is cached per domain for 14 days and can be refreshed from a favorite's right-click menu.
- Backgrounds: user image URL, local image upload, or random no-key Picsum photo
- Appearance: System, Light, and Dark modes stored locally
- Favorite management: right-click a favorite to open the custom menu. Actions mirror to Chrome's Bookmarks Bar: add creates a bookmark, edit updates it, remove deletes it, and dragging reorders it. File preview simulates this because Chrome bookmark APIs are unavailable outside extension mode.
- Extension icon: source image at `assets/icons/safarian-logo-1024.png`, exported to PNG sizes used by Chrome.
- Privacy: see `PRIVACY.md` for the Chrome Web Store privacy policy text.

The Clear All control hides the current recently closed list locally. Chrome does not expose an extension API for deleting recently closed session entries from Chrome itself.

When `newtab.html` is opened directly as a file for visual debugging, Chrome extension APIs are not available, so the page renders preview data. Loaded as an unpacked extension, it uses the real Chrome APIs listed above.

## Hybrid Gemini behavior

Gemini Nano remains the default and is used through Chrome's built-in `LanguageModel` Prompt API. It requires a supported desktop Chrome version and compatible hardware. Automatic new-tab organization never starts a Nano download; an explicit user action may do so and reports progress.

Users can optionally enable smart cloud routing from Customize. Safarian uses Gemini 3.5 Flash-Lite for latency-sensitive Smart Recent Tabs and Gemini 3.7 Flash for the more ambiguous Continue journey inference. It validates a user-provided key with Flash-Lite without browsing data, so temporary 3.7 availability cannot block setup. The key is remembered in device-local `chrome.storage.local`, restricted to trusted extension contexts, and never synced. Requests go directly to Google's Gemini API with interaction storage disabled and fall back to Nano on cloud errors. Cloud mode is never enabled without the disclosure and affirmative consent. Recall always stays on-device.
