# Lectio — Scripture Memory

A small, offline-capable PWA for memorizing Scripture a passage at a time (a verse,
a paragraph, or a whole chapter). It loads passages from public Bible APIs, caches a
limited amount of text locally, and offers several practice modes (progressive hide,
fill-in-the-blanks, word bank, and typing).

## Tech / framework

The UI is a single **Design Component** (`.dc.html`) rendered by the **dc-runtime**
in `support.js`. The runtime is a thin, React-based template engine:

- It reads the **template** from the `<x-dc>` element's `innerHTML`
  (custom tags `<sc-if>`, `<sc-for>`, and `{{ expr }}` / `{{ handler }}` bindings).
- It reads the **logic** from the *inline* `<script type="text/x-dc" data-dc-script>`'s
  `textContent` — a `class Component extends DCLogic` (React-style `state`,
  `setState`, lifecycle, and `=>` handler fields referenced from the template).
- It reads **editable props** (defaults shown in the visual editor) from that
  script tag's HTML-escaped `data-props="..."` attribute.
- React, ReactDOM, and Babel are loaded at runtime from the **unpkg CDN**
  (see `REACT_URL` / `REACT_DOM_URL` / `BABEL_URL` in `support.js`). An internet
  connection is required on first load; the service worker then caches the shell.

Because the runtime requires the template and logic to live **inline in one
document**, the component cannot be split across files at runtime. To keep it
editable, the source is split under `src/` and stitched back together by
`build.mjs` (see below).

> `support.js` is generated from the dc-runtime project (`GENERATED ... do not edit`).
> Treat it as a vendored dependency — don't hand-edit it.

## Repository layout

```
src/                Editable source for the component (edit these)
  helmet.html         <head> content injected by the runtime: CSS variables,
                      theme bootstrap, meta tags, manifest + font links.
  template.html       The app UI markup (the body of <x-dc>).
  logic.js            The Component class: state, data (BOOKS, SAMPLE),
                      fetching/parsing Scripture, and the practice modes.
  props.json          Editor-facing props (plain JSON; build escapes it).

build.mjs           Assembles src/* -> Lectio.dc.html AND index.html.
Lectio.dc.html      Built component. PWA start file; do not edit by hand.
index.html          Built copy of the component so GitHub Pages serves the app
                    at the site root (instead of rendering README.md). Generated.
support.js          Vendored dc-runtime (React template engine). Do not edit.
sw.js               Service worker: network-first app shell + Google Fonts cache.
manifest.json       PWA manifest.
icons/              App icons (180/192/512).
screenshots/        Store/listing screenshots.
.nojekyll           Disables Jekyll on GitHub Pages so files are served verbatim.
```

## Editing & building

1. Edit the files under `src/` — never edit `Lectio.dc.html` or `index.html`
   directly (they are generated and will be overwritten).
2. Rebuild:

   ```sh
   node build.mjs
   ```

   This writes `Lectio.dc.html` and `index.html` (identical content). No
   dependencies are required — plain Node.

3. Commit `src/`, the regenerated `Lectio.dc.html`/`index.html`, and any other
   changed files together.

The build is lossless: assembling the current `src/` reproduces the previously
shipped `Lectio.dc.html` byte-for-byte.

### Local preview

Serve the folder over HTTP (a `file://` open will not register the service
worker and may block `fetch`):

```sh
python3 -m http.server 8099   # then open http://localhost:8099/
```

React/Babel come from unpkg, so the first load needs network access.

## Deployment (GitHub Pages)

Pages is served from the default branch root. The site root must contain an
`index.html` — without it, Pages renders `README.md` with the default Jekyll
theme (this was the "white sheet" symptom). `index.html` is produced by
`build.mjs`; keep it in sync by rebuilding after any `src/` change.

## App updates

When a new build is deployed, the service worker installs but stays in the
**waiting** state (`sw.js` no longer calls `skipWaiting()` on install). The app
detects the waiting worker (`registerServiceWorker` in `src/logic.js`) and shows
an **"Update available"** modal with a *Refresh now* action. Accepting posts
`skip-waiting` to the worker; once it activates and `controllerchange` fires, the
page reloads exactly once to run the new code. This keeps users off stale cached
shells. Bump `CACHE` in `sw.js` when shipping a build that must invalidate the
old app-shell cache.

## Practice modes (in `src/logic.js`)

- **hide** – progressively hide words; tap to reveal.
- **hidden** – everything hidden up front; difficulty slider controls blank %.
- **bank** – fill blanks by picking from a shuffled word bank.
- **type** – type the passage; tracks errors.

## Scripture sources & terms

- **ESV** via `api.esv.org` (requires a user-supplied token; cached up to 500
  verses per the ESV API terms — see the in-app copyright notice).
- **KJV / fallback** via public APIs (`bible-api.com`, `bolls.life`).
- The service worker deliberately **never** caches Bible-text API responses
  (see the host checks in `sw.js`); passage text is cached only in
  `localStorage` by the app, capped to honor the ESV terms.
