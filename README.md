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
- Favorites: Chrome Bookmarks Bar in mirror mode. Direct URL bookmarks are shown; folders are skipped. Add, edit, remove, and reorder actions update real Chrome bookmarks.
- Suggestions: Chrome History API, with Top Sites fallback
- Favicons: high-resolution Apple touch, PWA, SVG, and root icon candidates first, then geticon.dev, Google, DuckDuckGo, and Chrome's built-in `_favicon` endpoint as fallbacks. The chosen icon is cached per domain for 14 days and can be refreshed from a favorite's right-click menu.
- Backgrounds: user image URL, local image upload, or random no-key Picsum photo
- Appearance: System, Light, and Dark modes stored locally
- Favorite management: right-click a favorite to open the custom menu. Actions mirror to Chrome's Bookmarks Bar: add creates a bookmark, edit updates it, remove deletes it, and dragging reorders it. File preview simulates this because Chrome bookmark APIs are unavailable outside extension mode.
- Extension icon: source image at `assets/icons/safarian-logo-1024.png`, exported to PNG sizes used by Chrome.
- Privacy: see `PRIVACY.md` for the Chrome Web Store privacy policy text.

The Clear All control hides the current recently closed list locally. Chrome does not expose an extension API for deleting recently closed session entries from Chrome itself.

When `newtab.html` is opened directly as a file for visual debugging, Chrome extension APIs are not available, so the page renders preview data. Loaded as an unpacked extension, it uses the real Chrome APIs listed above.
