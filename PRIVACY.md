# Safarian Privacy Policy

Last updated: August 16, 2026

Safarian replaces Chrome's new tab page with a local dashboard for bookmarks, session recovery, history recall, and ongoing journeys.

## Data Used

Safarian uses Chrome extension APIs to read:

- Bookmarks, to mirror the Chrome Bookmarks Bar as favorites
- Recently closed tabs, to show recoverable closed tabs
- Browsing history, to power local Recall and identify repeated activity for Continue
- Extension storage, to save appearance, background, cached site icon choices, local display preferences, cached on-device AI results, and retry metadata
- High-resolution site icon candidates plus geticon.dev, Google, DuckDuckGo, and Chrome's built-in favicon endpoints, to display site icons

When you explicitly use Recall, Safarian provides a limited set of page titles, site domains, URL paths, and visit times from your local Chrome history to Chrome's built-in Gemini Nano model. The model runs on your device. Recall only returns references to real history entries and does not create or store new URLs. If the built-in model is unavailable, Safarian uses direct title and address matching locally instead.

When Chrome's on-device model is already available, Smart Recent Tabs automatically provides the titles, domains, close times, and limited window-tab titles of up to 18 eligible recoverable web sessions to that model when a new tab opens. Safarian never starts a model download for this automatic action. Gemini returns only references to those real sessions. Safarian locally caches fingerprinted group labels and session identifiers for six hours so unchanged sessions are not repeatedly processed. You can return to chronological order at any time.

When the on-device model is already available, Continue examines activity from the last 30 days that occurred across multiple days, excluding exact Favorite and Recently Closed URLs. Safarian provides eligible page titles, domains, URL paths, visit counts, active-day counts, and recency to the local model. Gemini can only group references to those real pages. Fingerprinted journey labels and page URLs are cached locally for 12 hours. Small local attempt records apply cooldowns after empty results, unavailable-model states, or failures so unchanged activity is not repeatedly processed. If there is no strong multi-page journey, the section remains hidden.

## Data Sharing

Safarian does not collect, sell, transmit, or share your bookmarks, browsing history, recently closed tabs, or settings with the developer or any analytics service.

Recall, Smart Recent Tabs, and Continue do not send browsing or session data to Google or another cloud AI provider. Chrome may download and manage the Gemini Nano model, but inference runs locally after that download.

To display site icons, Safarian may load icons directly from the site's common icon files, such as `apple-touch-icon.png`, PWA icon files, SVG favicons, or `favicon.ico`. If direct site icons are unavailable or too small, Safarian may request an icon by domain from geticon.dev, Google favicon URLs, DuckDuckGo favicon URLs, or Chrome's built-in favicon endpoint. Those image requests are made directly by your browser to the icon host and can disclose the site domain needed to fetch the icon.

Background images are loaded only when you choose a remote image URL or request a random image. In those cases, your browser requests that image directly from the image host you selected.

## Limited Use

Safarian's use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy questions, contact the publisher listed on the Chrome Web Store listing.
