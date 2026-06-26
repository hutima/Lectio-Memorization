#!/usr/bin/env node
// =============================================================================
// build-kjv-paragraphs.mjs — derive the KJV paragraph (pilcrow ¶) map
// =============================================================================
//
// Plain Node (>=18), no dependencies. Emits a compact position map the app
// overlays at render time (it does NOT re-bundle any verse text — the app keeps
// shipping the aruljohn 1769 KJV under data/kjv/):
//
//   data/kjv-para.json :
//     { "source": "...", "para": { "<bookId>": { "<chapter>": [<verse>, ...] } } }
//
//   node scripts/build-kjv-paragraphs.mjs
//
// TWO SOURCES, merged by book:
//
//   Genesis..Acts — the authentic 1769 KJV pilcrows, from farskipper/kjv
//     json/verses-1769.json (Unlicense / Public Domain), which marks each
//     paragraph start with a leading "#". The printed pilcrows famously STOP
//     after Acts 20:36, so they cover Genesis..Acts only.
//     https://github.com/farskipper/kjv
//
//   Romans..Revelation (book ids 45-66) — the KJV has no pilcrows here, so we
//     borrow the paragraph divisions of the Berean Standard Bible (Public
//     Domain), whose USFM marks prose paragraphs with \p (and kin). The NT
//     versification matches the KJV, so the (chapter, verse) positions map
//     straight across. Poetry books (Psalms, etc.) are intentionally left out
//     of BOTH sources — the app lineates KJV poetry by its own colons instead.
//     https://github.com/usfm-bible/examples.bsb  (BSB, Public Domain)
// =============================================================================

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const KJV_SRC = 'https://raw.githubusercontent.com/farskipper/kjv/master/json/verses-1769.json';
const BSB_RAW = 'https://raw.githubusercontent.com/usfm-bible/examples.bsb/main';

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
const NAME_TO_ID = {};
for (const [id, name] of Object.entries(BOOK_NAMES)) NAME_TO_ID[name] = Number(id);
NAME_TO_ID["Solomon's Song"] = 22; // farskipper's spelling of Song of Solomon

// BSB USFM filename per app book id (file number = id + 1; ids 45..66).
const BSB_CODE = {
  45:'ROM',46:'1CO',47:'2CO',48:'GAL',49:'EPH',50:'PHP',51:'COL',52:'1TH',
  53:'2TH',54:'1TI',55:'2TI',56:'TIT',57:'PHM',58:'HEB',59:'JAS',60:'1PE',
  61:'2PE',62:'1JN',63:'2JN',64:'3JN',65:'JUD',66:'REV',
};
const bsbFile = (id) => `${String(id + 1).padStart(2, '0')}${BSB_CODE[id]}BSB.usfm`;

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

// Genesis..Acts: 1769 pilcrows (leading "#" in farskipper verse text).
async function kjvPilcrows() {
  const verses = await fetchText(KJV_SRC, { json: true });
  const para = {}; let marks = 0; const unknown = new Set();
  for (const key of Object.keys(verses)) {
    if (!/^\s*#/.test(verses[key])) continue;
    const m = key.match(/^(.*) (\d+):(\d+)$/);
    const id = m && NAME_TO_ID[m[1]];
    if (!id) { unknown.add(key); continue; }
    ((para[id] ||= {})[m[2]] ||= []).push(Number(m[3]));
    marks++;
  }
  if (unknown.size) console.log('  KJV unmapped:', [...unknown].slice(0, 5).join(', '));
  console.log(`  KJV pilcrows: ${marks} marks across ${Object.keys(para).length} books`);
  return para;
}

// Romans..Revelation: BSB prose paragraphs (\p and kin in USFM). The first verse
// of each chapter is the implicit chapter opening, so it's never recorded.
async function bsbParagraphs() {
  const para = {}; let marks = 0;
  for (const id of Object.keys(BSB_CODE).map(Number)) {
    const usfm = await fetchText(`${BSB_RAW}/${bsbFile(id)}`);
    let ch = 0, pending = false;
    for (const raw of usfm.split('\n')) {
      const t = raw.trim();
      const mc = t.match(/^\\c\s+(\d+)/);
      if (mc) { ch = mc[1]; pending = false; continue; }
      if (/^\\(p|pi|pc|pr|pmo|pm|nb|mi|m)\b/.test(t)) { pending = true; continue; }
      const mv = t.match(/^\\v\s+(\d+)/);
      if (mv) { const v = Number(mv[1]); if (pending && v !== 1) { ((para[id] ||= {})[ch] ||= []).push(v); marks++; } pending = false; }
    }
  }
  console.log(`  BSB paragraphs: ${marks} marks across ${Object.keys(para).length} books (Romans..Revelation)`);
  return para;
}

async function main() {
  console.log('Building KJV paragraph map...');
  const kjv = await kjvPilcrows();
  const bsb = await bsbParagraphs();
  // Merge: KJV pilcrows win where present (Genesis..Acts); BSB fills Romans..Revelation
  // (the KJV has nothing there, so this is effectively a union).
  const merged = {};
  for (const src of [kjv, bsb]) for (const id of Object.keys(src)) {
    (merged[id] ||= {});
    for (const ch of Object.keys(src[id])) (merged[id][ch] ||= []).push(...src[id][ch]);
  }
  // Deterministic order + de-dup + sort.
  const ordered = {};
  for (const id of Object.keys(merged).map(Number).sort((a, b) => a - b)) {
    ordered[id] = {};
    for (const ch of Object.keys(merged[id]).map(Number).sort((a, b) => a - b)) {
      ordered[id][ch] = [...new Set(merged[id][ch])].sort((a, b) => a - b);
    }
  }
  const doc = {
    source: 'KJV paragraphing. Genesis-Acts: the authentic 1769 pilcrows (¶) from ' +
      'farskipper/kjv (Unlicense / Public Domain); the printed pilcrows stop after Acts ' +
      '20:36. Romans-Revelation: paragraph divisions of the Berean Standard Bible ' +
      '(usfm-bible/examples.bsb, Public Domain), whose NT versification matches the KJV. ' +
      'Poetry books carry none — the app lineates KJV poetry by its own colons.',
    para: ordered,
  };
  const out = JSON.stringify(doc);
  await writeFile(join(DATA_DIR, 'kjv-para.json'), out);
  let total = 0; for (const id of Object.keys(ordered)) for (const ch of Object.keys(ordered[id])) total += ordered[id][ch].length;
  console.log(`\nmerged: ${total} paragraph marks across ${Object.keys(ordered).length} books`);
  console.log(`data/kjv-para.json size: ${out.length} bytes`);
  console.log('Romans(45) ch1 starts:', JSON.stringify(ordered[45]['1']));
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
