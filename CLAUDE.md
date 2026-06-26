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
`build.mjs` (see below). The logic is split further, one file per concern under
`src/logic/` — each is a **class-body fragment** (members only, no class wrapper)
that `build.mjs` concatenates inside a single `class Component extends DCLogic`.
Keep every member an arrow-field or method so it lands on the instance and stays
auto-bound; a fragment is **not** valid JS on its own (run `node build.mjs` and
`node --check` on the output to validate, not the fragment files directly).

> `support.js` is generated from the dc-runtime project (`GENERATED ... do not edit`).
> Treat it as a vendored dependency — don't hand-edit it.

## Repository layout

```
src/                Editable source for the component (edit these)
  helmet.html         <head> content injected by the runtime: CSS variables,
                      theme bootstrap, meta tags, manifest + font links.
  template.html       The app UI markup (the body of <x-dc>).
  logic/              The Component class, split by concern (class-body fragments,
                      concatenated by build.mjs in this order):
    core.js             Shared: state, data (BOOKS, SAMPLE), lifecycle, theme,
                        text/rng utils, caching, ESV usage, passage selector +
                        loading, progress/streak, settings, dictionary (Datamuse),
                        viewport/keyboard + tap-guard + scroll helpers.
    mode-hide.js        "Hide & reveal" mode.
    mode-fill.js        "Fill blanks" mode.
    mode-bank.js        "Word bank" mode (per-blank multiple choice + tray).
    mode-type.js        "Type it" mode.
    render.js           renderWord dispatch, renderPractice, renderVals aggregator.
  props.json          Editor-facing props (plain JSON; build escapes it).

build.mjs           Assembles src/* -> Lectio.dc.html AND index.html. Wraps the
                    src/logic/* fragments in the Component class (see LOGIC_PARTS).
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

3. Commit `src/`, the regenerated `Lectio.dc.html`/`index.html`, **and the
   `CACHE` bump in `sw.js`** (see "Version control & cache invalidation" below)
   together in the same commit.

The build is deterministic: assembling the current `src/` always reproduces the
same `Lectio.dc.html`/`index.html`. The built files are committed so that a diff
which touches `src/` but not the generated output (or vice-versa) is a red flag —
they must always move together.

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
detects the waiting worker (`registerServiceWorker` in `src/logic/core.js`) and shows
an **"Update available"** modal with a *Refresh now* action. Accepting posts
`skip-waiting` to the worker; once it activates and `controllerchange` fires, the
page reloads exactly once to run the new code. This keeps users off stale cached
shells.

### Version control & cache invalidation (enforced)

PR #2 deliberately replaced the old **silent** auto-refresh with this **loud**,
user-acknowledged update. That guarantee only holds if every shipped change is
paired with a cache-version bump — otherwise an installed PWA keeps serving the
old shell from cache and the "Update available" modal never fires. Treat the
following as hard requirements, not suggestions:

1. **Bump `CACHE` in `sw.js`** (`lectio-shell-vN` → `vN+1`) in the **same commit**
   as *any* change that alters the app shell: `src/**`, the generated
   `Lectio.dc.html`/`index.html`, `support.js`, `manifest.json`, or `sw.js`
   itself. When in doubt, bump — a redundant bump only costs one extra refresh;
   a missing bump strands users on stale code.
2. **Never reintroduce `skipWaiting()` on install** in `sw.js` and never wire an
   automatic reload that isn't gated on the user accepting the modal
   (`this._updating` in `registerServiceWorker`). The reload must stay
   user-initiated so updates are never silent.
3. **Rebuild before committing.** Run `node build.mjs` so `Lectio.dc.html` and
   `index.html` match `src/`. A commit that changes `src/` without the matching
   regenerated output (or bumps `CACHE` without rebuilding) is incomplete.
4. **Keep the bump monotonic.** The `activate` handler deletes every cache key
   except the current `CACHE`, so the version string must only ever increase.

A handy pre-commit check: if `git diff --cached --name-only` includes any
shell file above, it must also include a `sw.js` `CACHE` change.

## Practice modes (one file each under `src/logic/`)

- **hide** (`mode-hide.js`) – progressively hide words; tap to peek.
- **hidden** (`mode-fill.js`) – selected words become inline inputs; tap any blank
  to edit it; a trailing space or exact match auto-advances. Blank count is set by
  the shared **ease slider** at the top of the passage (`core.onBlankPct`).
- **bank** (`mode-bank.js`) – two sub-modes chosen by the ease slider:
  - *multiple choice* (slider below max): Prev/Next or tap any blank to focus it;
    each blank offers ~5 options (correct word + Datamuse "similar" distractors,
    biased to the same part of speech, with an offline fallback to passage words);
    a correct tap turns green and auto-advances.
  - *shuffled tray* (slider at max = every word blank): the classic word bank, but
    the tray only holds the current + next verse so an all-blank chapter isn't
    overwhelming.
- **type** (`mode-type.js`) – type the passage; **Backspace** on an empty field
  returns to the previous word to fix a mistake; tap any word to jump there.

The mode controls live in a **pinned footer** (`render.js` → `footerStyle`) that
floats above the iOS soft keyboard via `visualViewport` (`core` → `kbInset`), and
the active word/blank is scrolled into view (`core.scrollActive`). Tap targets use
`touch-action:manipulation` plus `core.tapGuard` to suppress iOS ghost double-taps.

The dictionary distractors come from the free, no-key **Datamuse** API
(`api.datamuse.com`, `core.fetchJson`/`buildOptions`); it is only used for
word-bank options and falls back to other passage words when offline.

## Scripture sources & terms

- **ESV** via `api.esv.org` (requires a user-supplied token; cached up to 500
  verses per the ESV API terms — see the in-app copyright notice).
- **KJV / fallback** via public APIs (`bible-api.com`, `bolls.life`).
- **Coverdale Psalter** (BCP 1662, public domain) — **Psalms only**, bundled
  fully offline at `data/coverdale/19.json`. Built by `scripts/build-coverdale.mjs`
  from the committed `data/coverdale/source.txt`: it drops the chant pause colon,
  recombines Psalm 119's 22 sections, and **re-numbers the verses onto the KJV
  scheme** (aligning Coverdale's verse boundaries to KJV by word overlap) so the
  canon map / selector / reference line all line up. The selector snaps to Psalms
  when Coverdale is chosen, and back to KJV when another book is picked.
- The service worker deliberately **never** caches Bible-text API responses
  (see the host checks in `sw.js`); passage text is cached only in
  `localStorage` by the app, capped to honor the ESV terms.
