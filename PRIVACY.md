# Safarian Privacy Policy

Last updated: August 16, 2026

Safarian replaces Chrome's new tab page with a local dashboard for bookmarks, session recovery, history recall, and ongoing journeys.

## Data Used

Safarian uses Chrome extension APIs to read:

- Bookmarks, to mirror the Chrome Bookmarks Bar as favorites
- Recently closed tabs, to show recoverable closed tabs
- Browsing history, to power local Recall and identify repeated activity for Continue
- Extension storage, to save appearance, background, cached site icon choices, local display preferences, cached AI results, retry metadata, and an optional device-local Gemini API key
- High-resolution site icon candidates plus geticon.dev, Google, DuckDuckGo, and Chrome's built-in favicon endpoints, to display site icons

When you explicitly use Recall, Safarian provides a limited set of page titles, site domains, URL paths, and visit times from your local Chrome history to Chrome's built-in Gemini Nano model. The model runs on your device. Recall only returns references to real history entries and does not create or store new URLs. If the built-in model is unavailable, Safarian uses direct title and address matching locally instead.

By default, when Chrome's on-device model is already available, Smart Recent Tabs automatically provides the titles, domains, close times, and limited window-tab titles of up to 18 eligible recoverable web sessions to that local model when a new tab opens. Safarian never starts a model download for this automatic action. Gemini returns only references to those real sessions. Safarian locally caches fingerprinted group labels and session identifiers for six hours so unchanged sessions are not repeatedly processed. You can return to chronological order at any time.

By default, when the on-device model is already available, Continue examines activity from the last 30 days that occurred across multiple days, excluding exact Favorite and Recently Closed URLs. Safarian provides eligible page titles, domains, URL paths, visit counts, active-day counts, and recency to the local model. Gemini can only group references to those real pages. Fingerprinted journey labels and page URLs are cached locally for 12 hours. Small local attempt records apply cooldowns after empty results, unavailable-model states, or failures so unchanged activity is not repeatedly processed. If there is no strong multi-page journey, the section remains hidden.

You may explicitly opt in to Gemini Flash for Smart Recent Tabs and Continue by supplying your own Gemini API key and accepting an in-product disclosure. In that mode, the same eligible metadata described above is sent directly by your browser to Google's Gemini API for grouping. Safarian requests that Google not store each interaction (`store: false`). If a cloud request fails, Safarian falls back to Gemini Nano when it is available. Cloud and on-device results use provider-aware local caches; a fallback result is cached for one hour to avoid repeated failed cloud requests.

Your Gemini API key is stored in Chrome's device-local `storage.local` area so Safarian can continue using it after the extension or browser restarts. Safarian restricts that storage area to trusted extension contexts and never syncs the key. Passwordless local storage is a convenience, not an OS-backed secret vault: someone who controls your device or Chrome profile may be able to access it. The key remains until you select Forget key, remove Safarian, or clear its extension data. It is sent only to Google's Gemini API as an authentication credential.

## Data Sharing

Safarian does not collect, sell, transmit, or share your bookmarks, browsing history, recently closed tabs, or settings with the developer or any analytics service.

Recall always remains local: it does not send browsing or session data to a cloud AI provider. Smart Recent Tabs and Continue also remain local unless you explicitly enable Gemini Flash with your own key. Chrome may download and manage the Gemini Nano model, but Nano inference runs locally after that download.

When you enable Gemini Flash, the eligible browsing metadata described above is shared directly with Google and is subject to the Gemini API terms and Google's privacy practices. It is not sent to Safarian's developer. You can stop this sharing at any time by selecting On-device or Forget key in Customize.

To display site icons, Safarian may load icons directly from the site's common icon files, such as `apple-touch-icon.png`, PWA icon files, SVG favicons, or `favicon.ico`. If direct site icons are unavailable or too small, Safarian may request an icon by domain from geticon.dev, Google favicon URLs, DuckDuckGo favicon URLs, or Chrome's built-in favicon endpoint. Those image requests are made directly by your browser to the icon host and can disclose the site domain needed to fetch the icon.

Background images are loaded only when you choose a remote image URL or request a random image. In those cases, your browser requests that image directly from the image host you selected.

## Limited Use

Safarian's use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy questions, contact the publisher listed on the Chrome Web Store listing.
