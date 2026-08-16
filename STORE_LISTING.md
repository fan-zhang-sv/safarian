# Safarian Chrome Web Store Listing

## Short Description

An elegant new tab page with bookmarks, smart session recovery, and private on-device AI journeys.

## Detailed Description

Safarian replaces Chrome's new tab page with a calm, elegant dashboard built for daily browsing.

Features:

- Mirror your Chrome Bookmarks Bar as editable favorites
- Drag favorites to reorder them, with changes saved back to Chrome bookmarks
- Recover recently closed tabs from Chrome's sessions list
- Automatically rank and group recently closed sessions when on-device Gemini is already ready, without triggering a background model download and with a one-click return to chronological order
- Continue evidence-backed journeys from repeated activity across recent days
- Use crisp site icons with cached favicon fallbacks
- Search or enter a URL from the start page
- Describe a half-remembered page and use Chrome's on-device Gemini Nano to find real matches in local history
- Choose system, light, or dark appearance
- Add a custom background image, upload a local image, or use a random quiet backdrop

Safarian is local-first. It has no analytics, no ads, no account system, and no developer-operated server. Chrome data is used only to render the new tab page features described above.

The AI features are deliberately narrow. Recall ranks real history entries, Smart Recent Tabs organizes only recoverable sessions, and Continue groups only repeated multi-day activity after excluding Favorites and Recently Closed. None can invent destinations, all use Chrome's built-in Gemini Nano model on your device, and weak Continue results stay hidden.

## Category

Productivity

## Single Purpose

Replace Chrome's new tab page with a personal dashboard for bookmarks, session recovery, ongoing journeys, search, appearance, and background customization.

## Permission Justifications

- `bookmarks`: mirrors the Bookmarks Bar and lets the user add, edit, remove, and reorder favorites.
- `sessions`: reads and restores recently closed tabs and windows.
- `tabs`: allows recently closed session entries to include tab title and URL, which are needed for readable restore items.
- `history`: powers Recall and identifies repeated multi-day activity for Continue.
- `storage`: stores appearance, background, hidden recently-closed timestamp, cached icon choices, cached on-device AI results, and local retry metadata.
- `favicon`: uses Chrome's built-in favicon endpoint as a final site icon fallback.

## Privacy Practice Notes

- No analytics.
- No ads.
- No account.
- No developer-operated server.
- Chrome API data is not sent to the developer.
- Recall, Smart Recent Tabs, and Continue inference is performed by Chrome's built-in on-device model; no browsing or session data is sent to a cloud AI service.
- Site icon and remote background image requests are made directly by the browser to the relevant image host.
- The privacy policy text is in `PRIVACY.md`; host it at a public URL and provide that URL in the Chrome Web Store privacy policy field.

## Store Assets

- Store icon: `assets/icons/icon-128.png`
- Small promo tile: `store-assets/safarian-promo-440x280.png`
- Screenshot: `store-assets/safarian-screenshot-1280x800.png`
- Backup screenshot: `store-assets/safarian-screenshot-640x400.png`
