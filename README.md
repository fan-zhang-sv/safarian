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

Refresh the deterministic multi-theme marketing screenshots with:

```sh
node scripts/capture-marketing-screenshots.mjs
```

The capture uses simulated browsing data to show Safarian's real Smart Recent Tabs and Continue interfaces without exposing personal browsing history.

## Privacy Policy Website

The Chrome Web Store privacy policy site lives in `docs/` and is deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` when changes are pushed to `main` or `master`.

After the repository is published on GitHub, use this URL pattern in the Chrome Web Store Developer Dashboard:

```text
https://<github-username>.github.io/<repository-name>/
```

## Data Sources

- Recently Closed Tabs: Chrome Sessions API, with the Tabs permission so Chrome exposes tab titles and URLs
- Smart Recent Tabs: ranks up to 18 eligible recoverable web sessions, selects the most useful nine, and groups them into active tasks. The default on-device path runs only when Gemini Nano is already available and never starts a background model download. Users can explicitly opt in to Gemini Flash with their own device-local key. Flash performs one claimed full review per Chrome session; later new tabs are compared with an immutable full-review snapshot and Nano patches are merged into it without replacing untouched groups or making another automatic cloud call. During an incremental update, the previous groups remain visible and fully usable until the patch is ready. Fingerprinted results are cached locally for six hours, duplicate work is serialized across new tabs, users can request a fresh full review with Refresh AI, and they can always switch back to chronological order.
- Favorites: Chrome Bookmarks Bar in mirror mode. Direct URL bookmarks are shown; folders are skipped. Add, edit, remove, and reorder actions update real Chrome bookmarks.
- Continue: repeat activity across multiple days from the last 30 days, excluding exact Favorite and Recently Closed URLs. Gemini Nano or the explicitly enabled Gemini Flash mode groups only strong related activity into up to three ongoing journeys. Flash performs one full review per Chrome session; new or changed history activity is incrementally evaluated by Nano and merged into the immutable full-review journeys, preserving every untouched journey. Continue waits only for raw Favorites and session exclusions, so its cache and AI pipeline resolve independently while Recently Closed is still organizing. Its expensive per-URL visit expansion is cached for five minutes, served stale for up to six hours while refreshing during idle time, and bounded to six concurrent History API calls. During an incremental update, the previous journey cards remain visible and clickable until the patch is ready. Fingerprinted AI results are cached for 12 hours; empty results, unavailable-model states, and failures use cooldowns with exponential backoff. When no strong journey is ready, the section stays stable and explains what it is waiting for instead of disappearing.
- Recall: Chrome's built-in Prompt API (Gemini Nano) semantically ranks real pages from up to 180 days of local history when the user explicitly selects Recall. Page titles and URL paths are processed on-device; generated URLs are never accepted. If Gemini is unavailable, Recall falls back to literal local title and address matching.
- Favicons: Chrome's local `_favicon` database is used first for an immediate, network-free result. Missing icons fall back to high-resolution Apple touch, PWA, SVG, root icon, geticon.dev, Google, and DuckDuckGo candidates. Resolution-aware selections are cached per domain for 14 days, and bursts of icon discoveries are persisted as one batched write. Icons can be refreshed from a favorite's right-click menu.
- Backgrounds: user image URL, local image upload, or random no-key Picsum photo
- Appearance: System, Light, and Dark modes stored locally
- Favorite management: right-click a favorite to open the custom menu. Actions mirror to Chrome's Bookmarks Bar: add creates a bookmark, edit updates it, remove deletes it, and dragging reorders it. File preview simulates this because Chrome bookmark APIs are unavailable outside extension mode.
- Extension icon: source image at `assets/icons/safarian-logo-1024.png`, exported to PNG sizes used by Chrome.
- Privacy: see `PRIVACY.md` for the Chrome Web Store privacy policy text.

The Clear All control hides the current recently closed list locally. Chrome does not expose an extension API for deleting recently closed session entries from Chrome itself.

When `newtab.html` is opened directly as a file for visual debugging, Chrome extension APIs are not available, so the page renders preview data. Loaded as an unpacked extension, it uses the real Chrome APIs listed above.

## Rendering performance

Safarian paints cached and chronological content before AI work completes. Device-local settings use an in-memory read-through cache with concurrent-read deduplication and cross-tab invalidation. Independent data sources load in parallel, repeated card DOM is committed in fragments, Favorites use delegated interactions instead of per-tile handlers, and below-the-fold sections use browser rendering containment. Reduced-motion preferences disable decorative motion.

## Hybrid Gemini behavior

Gemini Nano remains the default and is used through Chrome's built-in `LanguageModel` Prompt API. It requires a supported desktop Chrome version and compatible hardware. Automatic new-tab organization never starts a Nano download; an explicit user action may do so and reports progress.

Users can optionally enable smart cloud routing from Customize. Safarian uses Gemini 3.5 Flash-Lite for latency-sensitive Smart Recent Tabs and Gemini 3.7 Flash for the more ambiguous Continue journey inference. Each feature claims at most one automatic full Flash review per Chrome session using `chrome.storage.session`; subsequent changes are evaluated locally by Nano and never escalate automatically to another cloud request. A persistent 30-minute minimum interval prevents rapid extension reloads from creating fresh cloud reviews. A deliberate Refresh AI action can request a fresh full review for either feature. Safarian validates a user-provided key with Flash-Lite without browsing data, so temporary 3.7 availability cannot block setup. The key is remembered in device-local `chrome.storage.local`, restricted to trusted extension contexts, and never synced. Chrome requests optional access only to `generativelanguage.googleapis.com` when the user enables Flash, and Forget key removes that access. Requests go directly to Google's Gemini API with interaction storage disabled and fall back to Nano on cloud errors. Cloud mode is never enabled without the disclosure and affirmative consent. Recall always stays on-device.
