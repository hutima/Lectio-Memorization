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
const logic = src('logic.js').trimEnd();

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
  '<script type="text/x-dc" data-dc-script data-props="' + escapeAttr(props) + '">\n' +
  logic + '\n' +
  '</script>\n</body>\n</html>\n';

for (const out of ['Lectio.dc.html', 'index.html']) {
  writeFileSync(join(root, out), html);
  console.log('wrote', out, html.length, 'bytes');
}
