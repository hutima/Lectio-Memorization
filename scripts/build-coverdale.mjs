#!/usr/bin/env node
// =============================================================================
// build-coverdale.mjs — build the offline Coverdale Psalter bundle (KJV-numbered)
// =============================================================================
//
// Plain Node (>=18), NO external dependencies. Parses the committed source text
// (data/coverdale/source.txt — the Book of Common Prayer 1662 Coverdale Psalter,
// Public Domain) and RE-NUMBERS it onto the KJV verse scheme so its verses line
// up with the rest of the app (canon map, verse selector, reference line). It
// emits data/coverdale/19.json in the shared bundle schema (see build-bible-data.mjs):
//
//   data/coverdale/19.json :
//     { "v": "Coverdale", "book": 19, "name": "Psalms",
//       "chapters": { "1": { "1": "verse text", ... }, ... "150": { ... } } }
//
//   node scripts/build-coverdale.mjs
//
// -----------------------------------------------------------------------------
// WHY ALIGNMENT: the BCP Coverdale Psalter divides ~70 psalms into a different
// number of verses than the KJV (it splits some verses at the chant break and
// merges others). To present Coverdale under KJV numbering we align the Coverdale
// verse sequence to the KJV verse sequence (fetched as the anchor) by maximising
// word overlap: a monotonic DP that may MERGE consecutive Coverdale verses into
// one KJV verse, or SPLIT one Coverdale verse across several KJV verses (cutting
// its text at the word boundary that best matches the KJV division). The Coverdale
// WORDS are always preserved in full and in order — only the verse boundaries move.
//
// SOURCE FORMAT: see the parser below. "Day N." headings, Latin incipits, and the
// single mid-verse pause colon ( " : " ) are dropped; Psalm 119's 22 sections are
// recombined. KJV anchor text: aruljohn/Bible-kjv (Public Domain).
// =============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const SRC = join(DATA_DIR, 'coverdale', 'source.txt');
const KJV_URL = 'https://raw.githubusercontent.com/aruljohn/Bible-kjv/master/Psalms.json';

// ---- parse the Coverdale source into { psalm: [verse text, ...] } ------------
const cleanVerse = (s) =>
  s.replace(/\s*:\s+/g, ' ').replace(/\s*:\s*$/g, '').normalize('NFC').replace(/\s+/g, ' ').trim();
const HEADER = /^Psalm\s+(\d+)(?:[.\s]+(\d+)\s*[-–]\s*\d+)?/;

async function parseCoverdale() {
  const lines = (await readFile(SRC, 'utf8')).replace(/\r/g, '').split('\n');
  const psalms = {};
  let cur = null, skipIncipit = false, awaitFirst = false, firstNum = 1, vNum = null, vText = null;
  const flush = () => {
    if (cur != null && vNum != null && vText != null) { const t = cleanVerse(vText); if (t) (psalms[cur] ||= {})[vNum] = t; }
    vNum = null; vText = null;
  };
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;
    if (/^Day\b/i.test(line)) continue;
    const hm = line.match(HEADER);
    if (hm) { flush(); cur = hm[1]; firstNum = hm[2] ? parseInt(hm[2], 10) : 1; skipIncipit = true; awaitFirst = true; psalms[cur] ||= {}; continue; }
    if (skipIncipit) { skipIncipit = false; continue; }
    const vm = line.match(/^(\d+)\s+(.*)$/);
    if (vm) { flush(); vNum = parseInt(vm[1], 10); vText = vm[2]; awaitFirst = false; }
    else if (awaitFirst) { flush(); vNum = firstNum; vText = line; awaitFirst = false; }
    else if (vNum != null) { vText += ' ' + line; }
  }
  flush();
  const out = {};
  for (const n of Object.keys(psalms)) out[n] = Object.keys(psalms[n]).map(Number).sort((a, b) => a - b).map((v) => psalms[n][v]);
  return out;
}

// ---- KJV anchor -------------------------------------------------------------
async function fetchKJV() {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(KJV_URL, { headers: { 'User-Agent': 'lectio-build' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = JSON.parse(await res.text());
      const K = {};
      for (const ch of data.chapters) K[ch.chapter] = ch.verses.map((v) => v.text);
      return K;
    } catch (e) { lastErr = e; if (attempt < 4) await new Promise((r) => setTimeout(r, 600 * attempt)); }
  }
  throw lastErr;
}

// ---- similarity (word-set Jaccard) ------------------------------------------
const words = (s) => s.toLowerCase().normalize('NFC').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const sim = (a, b) => {
  const A = new Set(words(a)), B = new Set(words(b)); if (!A.size && !B.size) return 1; let i = 0; for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i || 1);
};

// Split `text` into b parts at the word boundaries that best match kParts (b>=2).
function splitInto(text, kParts) {
  const b = kParts.length; if (b === 1) return [text.trim()];
  const W = text.split(/\s+/).filter(Boolean);
  // choose cut indices 0<c1<...<c_{b-1}<W.length maximising sum sim(segment, kPart)
  let best = { score: -1, parts: null };
  const rec = (start, part, cuts) => {
    if (part === b - 1) {
      const segs = []; let s = 0; for (const c of cuts) { segs.push(W.slice(s, c).join(' ')); s = c; } segs.push(W.slice(s).join(' '));
      if (segs.some((x) => !x)) return;
      let sc = 0; for (let k = 0; k < b; k++) sc += sim(segs[k], kParts[k]);
      if (sc > best.score) best = { score: sc, parts: segs };
      return;
    }
    for (let c = start + 1; c <= W.length - (b - 1 - part); c++) rec(c, part + 1, cuts.concat(c));
  };
  rec(0, 0, []);
  return best.parts || [text.trim(), ...kParts.slice(1).map(() => '…')];
}

// Monotonic DP: align Coverdale verses C[] onto KJV verses Kv[] with groups of
// size 1..4 on each side; returns the list of ops [aCov, bKjv, ci, kj].
function alignOps(C, Kv) {
  const n = C.length, m = Kv.length, memo = new Map();
  const MAX = 4;
  function best(i, j) {
    if (i === n && j === m) return { score: 0, ops: [] };
    if (i >= n || j >= m) return { score: -1e9, ops: [] };
    const key = i * (m + 1) + j; const hit = memo.get(key); if (hit) return hit;
    let r = { score: -1e9, ops: [] };
    for (let a = 1; a <= MAX && i + a <= n; a++) for (let b = 1; b <= MAX && j + b <= m; b++) {
      const ct = C.slice(i, i + a).join(' '), kt = Kv.slice(j, j + b).join(' ');
      const s = sim(ct, kt) / (a * b <= 1 ? 1 : a * b);     // prefer 1:1
      const sub = best(i + a, j + b); const sc = s + sub.score;
      if (sc > r.score) r = { score: sc, ops: [[a, b, i, j]].concat(sub.ops) };
    }
    memo.set(key, r); return r;
  }
  return best(0, 0).ops;
}

// Realise the alignment into exactly Kv.length verses of Coverdale text.
function reKey(C, Kv) {
  const ops = alignOps(C, Kv); const out = [];
  for (const [a, b, ci, kj] of ops) {
    const joined = C.slice(ci, ci + a).join(' ').replace(/\s+/g, ' ').trim();
    const parts = b === 1 ? [joined] : splitInto(joined, Kv.slice(kj, kj + b));
    for (const p of parts) out.push(p.replace(/\s+/g, ' ').trim());
  }
  return out;
}

async function main() {
  const cov = await parseCoverdale();
  const kjv = await fetchKJV();

  const chapters = {}; const problems = []; let totalVerses = 0; const opsSummary = [];
  for (let n = 1; n <= 150; n++) {
    const C = cov[String(n)], Kv = kjv[String(n)];
    if (!C) { problems.push('missing Coverdale Psalm ' + n); continue; }
    if (!Kv) { problems.push('missing KJV Psalm ' + n); continue; }
    const verses = C.length === Kv.length ? C : reKey(C, Kv);
    if (verses.length !== Kv.length) { problems.push(`Psalm ${n}: produced ${verses.length} verses, KJV has ${Kv.length}`); }
    if (C.length !== Kv.length) opsSummary.push(`${n}(${C.length}→${Kv.length})`);
    const vo = {}; verses.forEach((t, k) => { vo[String(k + 1)] = t; totalVerses++; });
    chapters[String(n)] = vo;
  }
  if (Object.keys(chapters).length !== 150) problems.push('expected 150 psalms');
  if (problems.length) { console.error('VALIDATION:\n  ' + problems.join('\n  ')); process.exitCode = 1; }

  await mkdir(join(DATA_DIR, 'coverdale'), { recursive: true });
  await writeFile(join(DATA_DIR, 'coverdale', '19.json'), JSON.stringify({ v: 'Coverdale', book: 19, name: 'Psalms', chapters }));
  console.log(`Coverdale Psalter (KJV-numbered): 150 psalms, ${totalVerses} verses -> data/coverdale/19.json`);
  console.log(`Re-numbered ${opsSummary.length} psalms to KJV scheme: ${opsSummary.join(' ')}`);

  // Register Coverdale in the manifest so the service worker precaches it (and the
  // attribution is recorded). Idempotent — run this AFTER build-bible-data.mjs, which
  // rewrites manifest.json from scratch; this merges the coverdale entry back in.
  const manifestPath = join(DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.versions = manifest.versions || {};
  manifest.versions.Coverdale = {
    dir: 'coverdale',
    label: 'Coverdale Psalter (BCP 1662)',
    attribution:
      'The Psalter, or Psalms of David, from the Book of Common Prayer (1662) — ' +
      "Miles Coverdale's translation (Great Bible, 1539), Public Domain. Re-numbered " +
      'to the King James verse scheme for this app (verse boundaries aligned to the ' +
      'KJV; wording unchanged). Psalms only.',
    books: [19],
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Registered Coverdale in data/manifest.json');
}

main().catch((err) => { console.error('BUILD FAILED:', err); process.exit(1); });
