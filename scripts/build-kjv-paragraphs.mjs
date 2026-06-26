#!/usr/bin/env node
// =============================================================================
// build-kjv-paragraphs.mjs — derive the KJV paragraph (pilcrow ¶) map
// =============================================================================
//
// Plain Node (>=18), no dependencies. Pulls the 1769 KJV from farskipper/kjv
// (Unlicense / public domain), whose verse text encodes a paragraph start with a
// leading "#". We DON'T re-bundle the text (the app already ships the aruljohn
// 1769 KJV under data/kjv/) — we only extract WHICH verses begin a paragraph and
// emit a compact position map that the app overlays at render time:
//
//   data/kjv-para.json :
//     { "source": "...", "para": { "<bookId>": { "<chapter>": [<verse>, ...] } } }
//
// Note the well-known 1769 quirk: the printed pilcrows stop after Acts 20:36, so
// Romans..Revelation (and the all-poetry Psalms) carry no paragraph marks here.
//
//   node scripts/build-kjv-paragraphs.mjs
//
// SOURCE: farskipper/kjv  json/verses-1769.json  (1769 KJV, Unlicense / PD)
//   https://github.com/farskipper/kjv
// =============================================================================

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const SRC = 'https://raw.githubusercontent.com/farskipper/kjv/master/json/verses-1769.json';

// Canonical book name -> id (Protestant 66). Plus farskipper's one spelling that
// differs from the app's canonical name.
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

async function main() {
  const res = await fetch(SRC, { headers: { 'User-Agent': 'lectio-build' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${SRC}`);
  const verses = await res.json();

  const para = {};
  let marks = 0; const unknown = new Set();
  for (const key of Object.keys(verses)) {
    if (!/^\s*#/.test(verses[key])) continue;            // not a paragraph start
    const m = key.match(/^(.*) (\d+):(\d+)$/);
    if (!m) { unknown.add(key); continue; }
    const id = NAME_TO_ID[m[1]];
    if (!id) { unknown.add(m[1]); continue; }
    const ch = m[2], v = Number(m[3]);
    ((para[id] ||= {})[ch] ||= []).push(v);
    marks++;
  }
  // Deterministic order: book id asc, chapter asc, verses asc.
  const ordered = {};
  for (const id of Object.keys(para).map(Number).sort((a, b) => a - b)) {
    ordered[id] = {};
    for (const ch of Object.keys(para[id]).map(Number).sort((a, b) => a - b)) {
      ordered[id][ch] = para[id][ch].slice().sort((a, b) => a - b);
    }
  }
  const doc = {
    source: 'KJV paragraph marks (pilcrows) from the 1769 King James Version, ' +
      'farskipper/kjv json/verses-1769.json (Unlicense / Public Domain). The printed ' +
      'pilcrows stop after Acts 20:36, so later books carry none.',
    para: ordered,
  };
  const out = JSON.stringify(doc);
  await writeFile(join(DATA_DIR, 'kjv-para.json'), out);
  if (unknown.size) console.log('UNMAPPED keys/books:', [...unknown].join(', '));
  console.log(`paragraph marks: ${marks}`);
  console.log(`books with paragraphs: ${Object.keys(ordered).length}`);
  console.log(`data/kjv-para.json size: ${out.length} bytes`);
  console.log('sample Genesis 1 starts:', JSON.stringify(ordered[1]['1']));
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
