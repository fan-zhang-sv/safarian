# Safarian Chrome Web Store Listing

## Short Description

An elegant new tab page with mirrored bookmarks, recently closed tabs, suggestions, themes, and backgrounds.

## Detailed Description

Safarian replaces Chrome's new tab page with a calm, elegant dashboard built for daily browsing.

Features:

- Mirror your Chrome Bookmarks Bar as editable favorites
- Drag favorites to reorder them, with changes saved back to Chrome bookmarks
- Recover recently closed tabs from Chrome's sessions list
- See useful suggestions from local Chrome history and top sites
- Use crisp site icons with cached favicon fallbacks
- Search or enter a URL from the start page
- Choose system, light, or dark appearance
- Add a custom background image, upload a local image, or use a random quiet backdrop

Safarian is local-first. It has no analytics, no ads, no account system, and no developer-operated server. Chrome data is used only to render the new tab page features described above.

## Category

Productivity

## Single Purpose

Replace Chrome's new tab page with a personal dashboard for bookmarks, recently closed tabs, suggestions, search, appearance, and background customization.

## Permission Justifications

- `bookmarks`: mirrors the Bookmarks Bar and lets the user add, edit, remove, and reorder favorites.
- `sessions`: reads and restores recently closed tabs and windows.
- `tabs`: allows recently closed session entries to include tab title and URL, which are needed for readable restore items.
- `history`: builds the Suggestions section from local browsing history.
- `topSites`: provides suggestion fallback data if history suggestions are unavailable.
- `storage`: stores appearance, background, hidden recently-closed timestamp, and cached icon choices.
- `favicon`: uses Chrome's built-in favicon endpoint as a final site icon fallback.

## Privacy Practice Notes

- No analytics.
- No ads.
- No account.
- No developer-operated server.
- Chrome API data is not sent to the developer.
- Site icon and remote background image requests are made directly by the browser to the relevant image host.
- The privacy policy text is in `PRIVACY.md`; host it at a public URL and provide that URL in the Chrome Web Store privacy policy field.

## Store Assets

- Store icon: `assets/icons/icon-128.png`
- Small promo tile: `store-assets/safarian-promo-440x280.png`
- Screenshot: `store-assets/safarian-screenshot-1280x800.png`
- Backup screenshot: `store-assets/safarian-screenshot-640x400.png`
