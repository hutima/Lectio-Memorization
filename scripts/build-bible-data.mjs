#!/usr/bin/env node
// =============================================================================
// build-bible-data.mjs — regenerate the offline Bible-text bundle in ../data/
// =============================================================================
//
// Plain Node (>=18), NO external dependencies. Uses the global fetch() to pull
// public-domain / share-friendly source texts from raw.githubusercontent.com,
// then emits one JSON file per book under data/<dir>/<id>.json plus a
// data/manifest.json. Re-running reproduces byte-identical output (idempotent),
// so the bundle stays reproducible from source.
//
//   node scripts/build-bible-data.mjs
//
// -----------------------------------------------------------------------------
// SCHEMA (the app depends on this exactly):
//
//   data/<dir>/<id>.json :
//     {
//       "v": "KJV" | "GNT" | "LXX",
//       "book": <1..66>,                 // canonical Protestant-canon id
//       "name": "<English book name>",
//       "chapters": {                    // OBJECT keyed by chapter-number string
//         "1": { "1": "verse text", "2": "..." },   // verses keyed by number
//         "2": { "1": "..." }
//       }
//     }
//
//   Chapter and verse keys are STRINGS. Verses are an OBJECT (never a positional
//   array) so that editions which omit a verse (e.g. Tischendorf omits Matthew
//   17:21) leave a genuine gap in the key set rather than silently shifting
//   later verse numbers. Verse text is: trimmed, internal whitespace collapsed
//   to a single space, NFC-normalised, with no HTML, no morphology codes, no
//   Strong's numbers, no verse-number prefixes. Greek keeps its Unicode accents
//   and punctuation (· , . ; ).
//
//   data/<dir> per version:  kjv -> ids 1..66, gnt -> 40..66, lxx -> 1..39.
//
// -----------------------------------------------------------------------------
// SOURCES & LICENSES:
//
//   KJV (King James Version, English) — PUBLIC DOMAIN.
//     aruljohn/Bible-kjv  (per-book JSON: {book, chapters:[{chapter,verses:[{verse,text}]}]})
//     https://github.com/aruljohn/Bible-kjv
//
//   GNT (Greek New Testament) — Tischendorf 8th edition w/ Sandborg-Petersen
//     analysis — PUBLIC DOMAIN ("This text and its analysis are in the Public
//     Domain. Copy freely." — repo README). We use the word-per-line/2.8/Unicode
//     files and reconstruct running verse text from the surface word-forms
//     (which already carry their trailing punctuation); the morphology, Strong's
//     and lemma columns are discarded.
//     https://github.com/morphgnt/tischendorf-data
//
//   LXX (Septuagint) — The Old Testament in Greek According to the Septuagint,
//     ed. Henry Barclay Swete (1909). The underlying critical text is PUBLIC
//     DOMAIN by age; this digital transcription (derived from the Open Greek and
//     Latin "First1KGreek" project, tlg0527) is distributed under CC BY-SA 4.0.
//     We chose this over the otherwise-similar sleeptillseven/LXX-Swete (which is
//     incomplete AND CC BY-NC-SA, i.e. NonCommercial). One word per line as
//     "book.chapter.verse <token>"; we join tokens (which carry their own
//     punctuation) per verse.
//     https://github.com/nathans/lxx-swete   (text: CC BY-SA 4.0)
//
//   LXX caveats:
//     * Versification is kept exactly as Swete prints it. LXX Psalm numbering
//       legitimately differs from the Hebrew (e.g. the "The Lord is my shepherd"
//       psalm is LXX Psalm 22, Hebrew 23); we do NOT remap it. Psalmi also
//       includes Psalm 151.
//     * Ezra and Nehemiah are a single Swete book ("Esdras B", 23 chapters):
//       chapters 1-10 -> Ezra (id 15), chapters 11-23 -> Nehemiah (id 16,
//       renumbered to chapters 1-13). (Esdras A is the deuterocanonical 1 Esdras
//       and is skipped.)
//     * Ecclesiastes (id 21) is ABSENT from this source — "34.Ecclesiasticus" is
//       Sirach (a deuterocanonical book), NOT Qoheleth. So LXX ships 38 of the 39
//       OT ids. All deuterocanonical books (1 Esdras, Tobit, Judith, Wisdom,
//       Sirach, Baruch, Epistle of Jeremiah, the Maccabees, Odes, Psalms of
//       Solomon, the Greek additions Susanna / Bel & the Dragon) are skipped
//       because they are outside the app's 66-book canon.
//     * For Daniel we use Theodotion's version (Swete "57.Daniel Theodotionis
//       versio"), which matches the chapter structure of printed editions; the
//       Old-Greek "translatio Graeca" is skipped.
//     * The printed chapter-number (a Roman numeral) is embedded in the source as
//       a token at chapter boundaries (standalone, e.g. "XX" at Exodus 20, or
//       glued to the first word, e.g. "IXκαὶ"). We strip it when it equals the
//       chapter (or chapter+1); see stripChapterMarker().
//     * The underlying First1KGreek transcription contains a small amount of OCR
//       noise — Greek letters occasionally misread as Latin look-alikes (e.g.
//       "’lσραὴλ" for Ἰσραήλ, "Μrπτον" for Αἴγυπτον) and a few stray capitals
//       (D, F, ...). These are inherent to the public source text; we do not
//       attempt to auto-correct individual Greek words, which would require a
//       clean reference edition. They are sparse (a few hundred tokens across the
//       whole OT) and do not affect the JSON schema.
// =============================================================================

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const RAW = 'https://raw.githubusercontent.com';

// ---- canonical book table (id -> English name) ------------------------------
const BOOK_NAMES = {
  1:'Genesis',2:'Exodus',3:'Leviticus',4:'Numbers',5:'Deuteronomy',6:'Joshua',
  7:'Judges',8:'Ruth',9:'1 Samuel',10:'2 Samuel',11:'1 Kings',12:'2 Kings',
  13:'1 Chronicles',14:'2 Chronicles',15:'Ezra',16:'Nehemiah',17:'Esther',
  18:'Job',19:'Psalms',20:'Proverbs',21:'Ecclesiastes',22:'Song of Solomon',
  23:'Isaiah',24:'Jeremiah',25:'Lamentations',26:'Ezekiel',27:'Daniel',
  28:'Hosea',29:'Joel',30:'Amos',31:'Obadiah',32:'Jonah',33:'Micah',34:'Nahum',
  35:'Habakkuk',36:'Zephaniah',37:'Haggai',38:'Zechariah',39:'Malachi',
  40:'Matthew',41:'Mark',42:'Luke',43:'John',44:'Acts',45:'Romans',
  46:'1 Corinthians',47:'2 Corinthians',48:'Galatians',49:'Ephesians',
  50:'Philippians',51:'Colossians',52:'1 Thessalonians',53:'2 Thessalonians',
  54:'1 Timothy',55:'2 Timothy',56:'Titus',57:'Philemon',58:'Hebrews',
  59:'James',60:'1 Peter',61:'2 Peter',62:'1 John',63:'2 John',64:'3 John',
  65:'Jude',66:'Revelation',
};

// ---- KJV: aruljohn/Bible-kjv file name per id -------------------------------
const KJV_REPO = 'aruljohn/Bible-kjv/master';
const KJV_FILES = {
  1:'Genesis',2:'Exodus',3:'Leviticus',4:'Numbers',5:'Deuteronomy',6:'Joshua',
  7:'Judges',8:'Ruth',9:'1Samuel',10:'2Samuel',11:'1Kings',12:'2Kings',
  13:'1Chronicles',14:'2Chronicles',15:'Ezra',16:'Nehemiah',17:'Esther',
  18:'Job',19:'Psalms',20:'Proverbs',21:'Ecclesiastes',22:'SongofSolomon',
  23:'Isaiah',24:'Jeremiah',25:'Lamentations',26:'Ezekiel',27:'Daniel',
  28:'Hosea',29:'Joel',30:'Amos',31:'Obadiah',32:'Jonah',33:'Micah',34:'Nahum',
  35:'Habakkuk',36:'Zephaniah',37:'Haggai',38:'Zechariah',39:'Malachi',
  40:'Matthew',41:'Mark',42:'Luke',43:'John',44:'Acts',45:'Romans',
  46:'1Corinthians',47:'2Corinthians',48:'Galatians',49:'Ephesians',
  50:'Philippians',51:'Colossians',52:'1Thessalonians',53:'2Thessalonians',
  54:'1Timothy',55:'2Timothy',56:'Titus',57:'Philemon',58:'Hebrews',
  59:'James',60:'1Peter',61:'2Peter',62:'1John',63:'2John',64:'3John',
  65:'Jude',66:'Revelation',
};

// ---- GNT: tischendorf 2.8 Unicode abbreviation per id (NT only) -------------
const TISCH_REPO = 'morphgnt/tischendorf-data/master/word-per-line/2.8/Unicode';
const TISCH_FILES = {
  40:'MT',41:'MR',42:'LU',43:'JOH',44:'AC',45:'RO',46:'1CO',47:'2CO',48:'GA',
  49:'EPH',50:'PHP',51:'COL',52:'1TH',53:'2TH',54:'1TI',55:'2TI',56:'TIT',
  57:'PHM',58:'HEB',59:'JAS',60:'1PE',61:'2PE',62:'1JO',63:'2JO',64:'3JO',
  65:'JUDE',66:'RE',
};

// ---- LXX: nathans/lxx-swete file per id (OT only) ---------------------------
// `range` (when present) selects a chapter window and renumbers it to start at 1
// (used to split the single "Esdras B" book into Ezra + Nehemiah).
const LXX_REPO = 'nathans/lxx-swete/master/data';
const LXX_FILES = {
  1:{file:'01.Genesis'},2:{file:'02.Exodus'},3:{file:'03.Leviticus'},
  4:{file:'04.Numeri'},5:{file:'05.Deuteronomium'},6:{file:'06.Josue'},
  7:{file:'08.Judices'},8:{file:'10.Ruth'},
  9:{file:'11.Regnorum_I'},10:{file:'12.Regnorum_II'},
  11:{file:'13.Regnorum_III'},12:{file:'14.Regnorum_IV'},
  13:{file:'15.Paralipomenon_I'},14:{file:'16.Paralipomenon_II'},
  15:{file:'18.Esdras_B', range:[1,10]},      // Ezra
  16:{file:'18.Esdras_B', range:[11,23]},     // Nehemiah (renumbered 1..13)
  17:{file:'19.Esther'},18:{file:'32.Job'},19:{file:'27.Psalmi'},
  20:{file:'29.Proverbia'},
  // 21 Ecclesiastes: absent in this LXX source (34.Ecclesiasticus is Sirach).
  22:{file:'31.Canticum'},23:{file:'48.Isaias'},24:{file:'49.Jeremias'},
  25:{file:'51.Threni_seu_Lamentationes'},26:{file:'53.Ezechiel'},
  27:{file:'57.Daniel_Theodotionis_versio'},
  28:{file:'36.Osee'},29:{file:'39.Joel'},30:{file:'37.Amos'},
  31:{file:'40.Abdias'},32:{file:'41.Jonas'},33:{file:'38.Michaeas'},
  34:{file:'42.Nahum'},35:{file:'43.Habacuc'},36:{file:'44.Sophonias'},
  37:{file:'45.Aggaeus'},38:{file:'46.Zacharias'},39:{file:'47.Malachias'},
};

// ---- small helpers ----------------------------------------------------------
const norm = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
const stripTags = (s) => s.replace(/<[^>]*>/g, ' ');

// Parse a Roman numeral (uppercase) to an integer, or null if not one.
function romanToInt(s) {
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]], next = map[s[i + 1]] || 0;
    n += cur < next ? -cur : cur;
  }
  return n;
}

// The Swete (First1KGreek) transcription embeds the printed chapter NUMBER as a
// Roman-numeral token at chapter boundaries — sometimes a standalone "verse 1"
// token (e.g. Exodus 20 -> "XX"), sometimes glued onto the first word of the
// chapter (e.g. "IXκαὶ" at Genesis 9:1). Such a token always equals the current
// chapter number (or, when it lands on the tail of the previous chapter, the
// next one). Strip it; a genuine Greek word never equals a pure Roman numeral.
// Returns the cleaned token ('' if it was nothing but the marker). Scattered
// single-letter OCR artifacts that don't match the chapter number are left
// untouched (see the LXX caveats in the header comment).
function stripChapterMarker(token, ch) {
  const r = romanToInt(token);
  if (r !== null) return (r === ch || r === ch + 1) ? '' : token;
  const gm = token.match(/^([IVXLCDM]+)([Ͱ-Ͽἀ-῿].*)$/);
  if (gm) {
    const rv = romanToInt(gm[1]);
    if (rv === ch || rv === ch + 1) return gm[2];
  }
  return token;
}

async function fetchText(url, { json = false } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'lectio-build' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const body = await res.text();
      return json ? JSON.parse(body) : body;
    } catch (err) {
      lastErr = err;
      if (attempt < 4) await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastErr;
}

// Serialise chapters deterministically with numeric-sorted string keys so the
// output is byte-stable across runs (object insertion order would otherwise
// depend on source ordering). Returns an ordered plain object.
function orderChapters(chapters) {
  const out = {};
  for (const ch of Object.keys(chapters).map(Number).sort((a, b) => a - b)) {
    const verses = chapters[ch];
    const vo = {};
    for (const v of Object.keys(verses).map(Number).sort((a, b) => a - b)) {
      vo[String(v)] = verses[v];
    }
    out[String(ch)] = vo;
  }
  return out;
}

function bookStats(chapters) {
  let nCh = 0, nV = 0;
  for (const ch of Object.keys(chapters)) {
    nCh++;
    nV += Object.keys(chapters[ch]).length;
  }
  return { chapters: nCh, verses: nV };
}

async function writeBook(dir, id, version, chaptersRaw) {
  const ordered = orderChapters(chaptersRaw);
  const doc = { v: version, book: id, name: BOOK_NAMES[id], chapters: ordered };
  const file = join(DATA_DIR, dir, `${id}.json`);
  await writeFile(file, JSON.stringify(doc));
  return bookStats(ordered);
}

// ---- KJV --------------------------------------------------------------------
async function buildKJV() {
  console.log('\n=== KJV (aruljohn/Bible-kjv, Public Domain) ===');
  let totalVerses = 0, count = 0;
  for (const id of Object.keys(KJV_FILES).map(Number).sort((a, b) => a - b)) {
    const url = `${RAW}/${KJV_REPO}/${KJV_FILES[id]}.json`;
    const data = await fetchText(url, { json: true });
    const chapters = {};
    for (const ch of data.chapters) {
      const cnum = parseInt(ch.chapter, 10);
      const verses = {};
      for (const v of ch.verses) {
        const vnum = parseInt(v.verse, 10);
        const text = norm(stripTags(v.text));
        if (text) verses[vnum] = text;
      }
      if (Object.keys(verses).length) chapters[cnum] = verses;
    }
    const st = await writeBook('kjv', id, 'KJV', chapters);
    totalVerses += st.verses;
    count++;
    process.stdout.write(`  [${String(id).padStart(2)}] ${BOOK_NAMES[id].padEnd(16)} ` +
      `ch=${String(st.chapters).padStart(3)} v=${String(st.verses).padStart(4)}\n`);
  }
  return { count, totalVerses };
}

// ---- GNT (Tischendorf word-per-line) ----------------------------------------
// Each line: "MT 1:1.1 C Βίβλος Βίβλος N-NSF 976 βίβλος ! βίβλος"
//   field 0: "<ABBR> <ch>:<vs>.<word>"   field 2: surface form (with punctuation)
// We join field-2 surface forms per verse in word order. The surface form
// already carries trailing punctuation, so a plain space-join reproduces the
// running text.
async function buildGNT() {
  console.log('\n=== GNT (morphgnt/tischendorf-data 2.8, Tischendorf 8th, Public Domain) ===');
  let totalVerses = 0, count = 0;
  for (const id of Object.keys(TISCH_FILES).map(Number).sort((a, b) => a - b)) {
    const url = `${RAW}/${TISCH_REPO}/${TISCH_FILES[id]}.txt`;
    const body = await fetchText(url);
    // accumulate words per "ch:vs"
    const acc = new Map(); // "ch:vs" -> { ch, vs, words: [] }
    for (const raw of body.split('\n')) {
      const line = raw.replace(/\r$/, '').trim();
      if (!line) continue;
      // whitespace columns:
      //   [0]=ABBR  [1]=ch:vs.word  [2]=state  [3]=surface  [4]=lemma-form  ...
      const cols = line.split(/\s+/);
      const m = cols[1] && cols[1].match(/^(\d+):(\d+)\.\d+$/);
      if (!m) continue;
      const ch = parseInt(m[1], 10);
      const vs = parseInt(m[2], 10);
      const surface = cols[3];                        // surface form w/ punctuation
      if (!surface) continue;
      const key = ch + ':' + vs;
      let entry = acc.get(key);
      if (!entry) { entry = { ch, vs, words: [] }; acc.set(key, entry); }
      entry.words.push(surface);
    }
    const chapters = {};
    for (const { ch, vs, words } of acc.values()) {
      const text = norm(stripTags(words.join(' ')));
      if (!text) continue;
      (chapters[ch] ||= {})[vs] = text;
    }
    const st = await writeBook('gnt', id, 'GNT', chapters);
    totalVerses += st.verses;
    count++;
    process.stdout.write(`  [${String(id).padStart(2)}] ${BOOK_NAMES[id].padEnd(16)} ` +
      `ch=${String(st.chapters).padStart(3)} v=${String(st.verses).padStart(4)}\n`);
  }
  return { count, totalVerses };
}

// ---- LXX (Swete word-per-line) ----------------------------------------------
// Each line: "<book>.<chapter>.<verse> <token>" (one word per line). We join the
// tokens (which carry their own punctuation) per verse. `range` windows+renumbers
// chapters (Ezra/Nehemiah split out of the single Esdras B book).
async function buildLXX() {
  console.log('\n=== LXX (nathans/lxx-swete, Swete 1909, text CC BY-SA 4.0) ===');
  let totalVerses = 0, count = 0;
  const missing = [];
  for (let id = 1; id <= 39; id++) {
    const spec = LXX_FILES[id];
    if (!spec) { missing.push(id); continue; }
    const url = `${RAW}/${LXX_REPO}/${spec.file}.txt`;
    const body = await fetchText(url);
    const [lo, hi] = spec.range || [null, null];
    const acc = new Map(); // ch -> Map(vs -> [tokens])
    for (const raw of body.split('\n')) {
      const line = raw.replace(/\r$/, '');
      if (!line.trim()) continue;
      const sp = line.indexOf(' ');
      if (sp < 0) continue;
      const ref = line.slice(0, sp);
      const token = line.slice(sp + 1).trim();
      const m = ref.match(/^\d+\.(\d+)\.(\d+)$/);
      if (!m || !token) continue;
      let ch = parseInt(m[1], 10);
      const vs = parseInt(m[2], 10);
      // Drop the printed chapter-number Roman-numeral marker (compared against
      // the SOURCE chapter, before any Esdras-B renumbering below).
      const cleaned = stripChapterMarker(token, ch);
      if (!cleaned) continue;
      if (lo != null) {
        if (ch < lo || ch > hi) continue;
        ch = ch - lo + 1;                 // renumber window to start at chapter 1
      }
      let chMap = acc.get(ch);
      if (!chMap) { chMap = new Map(); acc.set(ch, chMap); }
      let words = chMap.get(vs);
      if (!words) { words = []; chMap.set(vs, words); }
      words.push(cleaned);
    }
    const chapters = {};
    for (const [ch, chMap] of acc) {
      for (const [vs, words] of chMap) {
        const text = norm(stripTags(words.join(' ')));
        if (!text) continue;
        (chapters[ch] ||= {})[vs] = text;
      }
    }
    const st = await writeBook('lxx', id, 'LXX', chapters);
    totalVerses += st.verses;
    count++;
    process.stdout.write(`  [${String(id).padStart(2)}] ${BOOK_NAMES[id].padEnd(16)} ` +
      `ch=${String(st.chapters).padStart(3)} v=${String(st.verses).padStart(4)}` +
      `${spec.range ? '  (Esdras B ch ' + spec.range.join('-') + ')' : ''}\n`);
  }
  if (missing.length) {
    console.log('  (omitted ids — not in this PD/CC-BY-SA source): ' +
      missing.map((i) => `${i} ${BOOK_NAMES[i]}`).join(', '));
  }
  return { count, totalVerses, missing };
}

// ---- manifest ---------------------------------------------------------------
async function writeManifest(lxxBooks) {
  const manifest = {
    versions: {
      KJV: {
        dir: 'kjv',
        label: 'King James Version',
        attribution:
          'King James Version (1769), Public Domain. Text from ' +
          'https://github.com/aruljohn/Bible-kjv (Public Domain).',
        books: Array.from({ length: 66 }, (_, i) => i + 1),
      },
      GNT: {
        dir: 'gnt',
        label: 'Tischendorf 8th edition (Greek NT)',
        attribution:
          "Tischendorf's 8th edition Greek New Testament with " +
          'Sandborg-Petersen morphological analysis (G. Clint Yale text, ' +
          'M. A. Robinson analysis), Public Domain. Surface text reconstructed ' +
          'from https://github.com/morphgnt/tischendorf-data ' +
          '(word-per-line/2.8/Unicode; Public Domain).',
        books: Array.from({ length: 27 }, (_, i) => i + 40),
      },
      LXX: {
        dir: 'lxx',
        label: 'Septuagint (Swete 1909)',
        attribution:
          'The Old Testament in Greek According to the Septuagint, ed. ' +
          'Henry Barclay Swete (Cambridge, 1909). Critical text Public Domain ' +
          'by age. Digital transcription from ' +
          'https://github.com/nathans/lxx-swete (derived from the Open Greek ' +
          'and Latin First1KGreek project, tlg0527), licensed CC BY-SA 4.0 ' +
          '(https://creativecommons.org/licenses/by-sa/4.0/). LXX versification ' +
          'kept as printed (Psalm numbering differs from the Hebrew). ' +
          'Ecclesiastes is absent from this source.',
        books: lxxBooks,
      },
    },
    generated:
      'Built by scripts/build-bible-data.mjs from: ' +
      'aruljohn/Bible-kjv (KJV, PD); ' +
      'morphgnt/tischendorf-data 2.8 (GNT, PD); ' +
      'nathans/lxx-swete (LXX, Swete 1909, CC BY-SA 4.0).',
  };
  await writeFile(join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

// ---- main -------------------------------------------------------------------
async function main() {
  // Fresh per-version dirs so deletions in the mapping don't leave stale files.
  for (const d of ['kjv', 'gnt', 'lxx']) {
    await rm(join(DATA_DIR, d), { recursive: true, force: true });
    await mkdir(join(DATA_DIR, d), { recursive: true });
  }

  const kjv = await buildKJV();
  const gnt = await buildGNT();
  const lxx = await buildLXX();

  const lxxBooks = Object.keys(LXX_FILES).map(Number).sort((a, b) => a - b);
  await writeManifest(lxxBooks);

  console.log('\n=== Summary ===');
  console.log(`KJV : ${kjv.count} books, ${kjv.totalVerses} verses`);
  console.log(`GNT : ${gnt.count} books, ${gnt.totalVerses} verses`);
  console.log(`LXX : ${lxx.count} books, ${lxx.totalVerses} verses` +
    (lxx.missing.length ? ` (missing ${lxx.missing.map((i) => BOOK_NAMES[i]).join(', ')})` : ''));
  console.log('manifest.json written.');
}

main().catch((err) => { console.error('BUILD FAILED:', err); process.exit(1); });
