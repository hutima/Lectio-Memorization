#!/usr/bin/env node
// Build the Lectio Design Component from the editable parts in src/.
//
// The dc-runtime (support.js) requires a single self-contained document: it reads
// the template from <x-dc>'s innerHTML and the logic from the *inline*
// <script data-dc-script> textContent (it cannot load either from an external
// file). So we keep the parts split for editing and stitch them back together here.
//
// Outputs:
//   Lectio.dc.html  — canonical component (PWA start_url, sw.js cache, framework name)
//   index.html      — identical copy so GitHub Pages serves the app at the site root
//
// Usage: node build.mjs   (no dependencies)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

// HTML-escape the props JSON for the data-props="" attribute (order matters: & first).
const escapeAttr = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const helmet = src('helmet.html').trimEnd();
const template = src('template.html').trim();
const props = src('props.json').trimEnd();

// Embedded public-domain creeds & catechisms (src/creeds.json). This is pure data,
// so it is injected as a plain <script> global (window.LECTIO_CREEDS) BEFORE the
// dc-runtime's logic script — keeping ~160KB of text out of the Babel transform the
// runtime runs on every load. Minify for size and escape "<" for safe <script> embedding.
const creedsData = JSON.stringify(JSON.parse(src('creeds.json'))).replace(/</g, '\\u003c');

// KJV paragraph (pilcrow ¶) position map (data/kjv-para.json, built by
// scripts/build-kjv-paragraphs.mjs). Injected as window.LECTIO_KJVPARA so buildPassage can
// mark paragraph starts synchronously. Tiny (~14KB); only the position map is embedded.
const kjvPara = JSON.stringify(JSON.parse(readFileSync(join(root, 'data', 'kjv-para.json'), 'utf8')).para).replace(/</g, '\\u003c');

// The component logic is split by concern under src/logic/ for editability, but the
// dc-runtime needs a single `class Component extends DCLogic`. Each file is a
// CLASS-BODY FRAGMENT (members only); we concatenate them inside one class here.
// Order: shared core first, then one file per practice mode, then the render glue.
const LOGIC_PARTS = [
  'logic/core.js',
  'logic/mode-hide.js',
  'logic/mode-fill.js',
  'logic/mode-bank.js',
  'logic/mode-type.js',
  'logic/stats.js',
  'logic/render.js',
];
const logic =
  'class Component extends DCLogic {\n' +
  LOGIC_PARTS.map((f) => src(f).replace(/\s+$/, '')).join('\n\n') +
  '\n}';

// Validate props is real JSON before we bake it into an attribute.
JSON.parse(props);

const html =
  '<!DOCTYPE html>\n<html>\n<head>\n' +
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  '<script src="./support.js"></script>\n' +
  '</head>\n<body>\n' +
  '<x-dc>\n' +
  '<helmet>\n' + helmet + '\n</helmet>\n\n' +
  template + '\n' +
  '</x-dc>\n' +
  '<script>window.LECTIO_CREEDS=' + creedsData + ';window.LECTIO_KJVPARA=' + kjvPara + ';</script>\n' +
  '<script type="text/x-dc" data-dc-script data-props="' + escapeAttr(props) + '">\n' +
  logic + '\n' +
  '</script>\n</body>\n</html>\n';

for (const out of ['Lectio.dc.html', 'index.html']) {
  writeFileSync(join(root, out), html);
  console.log('wrote', out, html.length, 'bytes');
}
