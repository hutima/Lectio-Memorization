  // ============================================================================
  // core.js — shared Component members (state, data, lifecycle, theme, text/rng,
  // caching, ESV usage, passage selector + loading, progress/streak, settings,
  // dictionary lookups, viewport/keyboard handling, tap protection, style helpers).
  //
  // This file is a CLASS-BODY FRAGMENT. It is not valid on its own: build.mjs
  // concatenates it (with the per-mode files and render.js) inside a single
  // `class Component extends DCLogic { ... }`. Keep every member an arrow-field or
  // method so it lands on the instance. See CLAUDE.md → "Repository layout".
  // ============================================================================

  state = {
    theme: 'system', resolvedTheme: 'light',
    version: 'KJV',
    view: 'home',
    pickerOpen: false,
    book: 'Psalms', chapter: '23', vStart: '1', vEnd: '',
    corpus: 'bible', creedId: 'apostles', qStart: '1', creedLang: 'en',
    ldMode: false, ldStart: '1',
    refInput: 'Psalms 23', verseCounts: {},
    loading: false, error: null, offerKjv: false,
    passage: null, mode: 'hide',
    settingsOpen: false, copyrightOpen: false, esvModalOpen: false,
    esvToken: '', reminderOn: false,
    showHints: true, showVerseNums: true, scriptureSize: 'Comfortable', scriptureFont: 'serif',
    blankPct: 0.25, blankList: [],
    hideAll: false, revealed: {}, revealAllNow: false,
    hiddenVals: {}, hiddenReveal: {}, fillActive: null,
    bank: null, bankFill: {},
    bankActive: null, bankChoice: {}, bankMiss: {}, bankOpts: {}, bankMisses: 0,
    typeVals: {}, typeReveal: {}, typeActive: null,
    progress: {}, streak: { count: 0, last: null },
    cacheCount: 0, usageToday: 0,
    updateReady: false,
    kbInset: 0,
  };

  BOOKS = [
    ['Genesis',50],['Exodus',40],['Leviticus',27],['Numbers',36],['Deuteronomy',34],['Joshua',24],['Judges',21],['Ruth',4],
    ['1 Samuel',31],['2 Samuel',24],['1 Kings',22],['2 Kings',25],['1 Chronicles',29],['2 Chronicles',36],['Ezra',10],['Nehemiah',13],
    ['Esther',10],['Job',42],['Psalms',150],['Proverbs',31],['Ecclesiastes',12],['Song of Solomon',8],['Isaiah',66],['Jeremiah',52],
    ['Lamentations',5],['Ezekiel',48],['Daniel',12],['Hosea',14],['Joel',3],['Amos',9],['Obadiah',1],['Jonah',4],['Micah',7],
    ['Nahum',3],['Habakkuk',3],['Zephaniah',3],['Haggai',2],['Zechariah',14],['Malachi',4],['Matthew',28],['Mark',16],['Luke',24],
    ['John',21],['Acts',28],['Romans',16],['1 Corinthians',16],['2 Corinthians',13],['Galatians',6],['Ephesians',6],['Philippians',4],
    ['Colossians',4],['1 Thessalonians',5],['2 Thessalonians',3],['1 Timothy',6],['2 Timothy',4],['Titus',3],['Philemon',1],['Hebrews',13],
    ['James',5],['1 Peter',5],['2 Peter',3],['1 John',5],['2 John',1],['3 John',1],['Jude',1],['Revelation',22],
  ].map(([name, chapters]) => ({ name, chapters }));

  SAMPLE = {
    reference: 'Psalm 23', version: 'KJV',
    verses: [
      { num: 1, text: 'The LORD is my shepherd; I shall not want.' },
      { num: 2, text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.' },
      { num: 3, text: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake." },
      { num: 4, text: 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.' },
      { num: 5, text: 'Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.' },
      { num: 6, text: 'Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.' },
    ],
  };

  // Embedded public-domain creeds & catechisms. The data is injected by build.mjs as a
  // plain <script> global (window.LECTIO_CREEDS) so the dc-runtime's per-load Babel
  // transform never has to re-parse ~160KB of text. Each doc is either a `creed`
  // (paras: string[]) or a `catechism` (items: {n, q, a}[]). See src/creeds.json.
  CREEDS = (typeof window !== 'undefined' && window.LECTIO_CREEDS) || [];

  componentDidMount() {
    const g = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
    const gj = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
    const theme = g('lectio.theme', 'system');
    const sel = gj('lectio.sel', null);
    const next = {
      theme,
      version: g('lectio.version', this.props.defaultVersion || 'KJV'),
      esvToken: g('lectio.esvToken', ''),
      reminderOn: g('lectio.reminder', '0') === '1',
      showHints: this.props.hintsDefault ?? true,
      showVerseNums: this.props.showVerseNumbers ?? true,
      scriptureSize: g('lectio.size', this.props.scriptureSize || 'Comfortable'),
      scriptureFont: g('lectio.font', this.props.scriptureFont || 'serif'),
      mode: this.props.defaultMode || 'hide',
      progress: gj('lectio.progress', {}),
      streak: gj('lectio.streak', { count: 0, last: null }),
      cacheCount: this.cachedVerseCount(),
      usageToday: this.usage().count,
    };
    if (sel && sel.book) { next.book = sel.book; next.chapter = sel.chapter; next.vStart = sel.vStart || '1'; next.vEnd = sel.vEnd || ''; }
    // Remember the last creeds picker selection (the displayed passage still starts
    // on the Scripture sample below; corpus stays 'bible' until the user switches).
    const csel = gj('lectio.creedsel', null);
    if (csel && csel.creedId) { next.creedId = csel.creedId; next.qStart = csel.qStart || '1'; next.ldMode = !!csel.ldMode; next.ldStart = csel.ldStart || '1'; if (csel.creedLang) next.creedLang = csel.creedLang; }
    next.verseCounts = gj('lectio.vc', {});
    this.setState(next, () => { this.applyTheme(theme); this.ensureVerseCount(); });

    const p = this.buildPassage(this.SAMPLE.reference, this.SAMPLE.version, this.SAMPLE.verses);
    this.setState({ passage: p }, () => this.initModes(p));

    this._mm = matchMedia('(prefers-color-scheme:dark)');
    this._onMM = () => { if (this.state.theme === 'system') this.applyTheme('system'); };
    this._mm.addEventListener('change', this._onMM);

    // Keep the pinned control bar above the iOS soft keyboard: the visual viewport
    // shrinks when the keyboard opens, and we translate the bar up by that inset.
    if (window.visualViewport) {
      this._vv = window.visualViewport;
      this._onVV = () => {
        const inset = Math.max(0, window.innerHeight - this._vv.height - this._vv.offsetTop);
        if (Math.abs(inset - this.state.kbInset) > 1) this.setState({ kbInset: inset });
      };
      this._vv.addEventListener('resize', this._onVV);
      this._vv.addEventListener('scroll', this._onVV);
    }

    this.registerServiceWorker();
    this.maybeRemind();
  }
  componentWillUnmount() {
    if (this._mm) this._mm.removeEventListener('change', this._onMM);
    if (this._onVisible) document.removeEventListener('visibilitychange', this._onVisible);
    if (this._vv && this._onVV) { this._vv.removeEventListener('resize', this._onVV); this._vv.removeEventListener('scroll', this._onVV); }
  }

  // ---------- app updates (service worker) ----------
  // A new build leaves its worker in "waiting" (sw.js no longer self-skipWaiting), so we
  // surface a refresh prompt instead of letting users sit on a stale cached shell.
  registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;
    // Reload exactly once, and only after the user accepts the update (this._updating),
    // so the controllerchange from a first-ever install never reloads mid-session.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this._updating && !this._reloaded) { this._reloaded = true; window.location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      if (!reg) return;
      this._swReg = reg;
      // An update could already be waiting from a previous visit.
      if (reg.waiting && navigator.serviceWorker.controller) this.setState({ updateReady: true });
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing; if (!sw) return;
        sw.addEventListener('statechange', () => {
          // Installed while an old worker still controls the page → a fresh build is ready.
          if (sw.state === 'installed' && navigator.serviceWorker.controller) this.setState({ updateReady: true });
        });
      });
      // Re-check for a new build when the app regains focus (long-lived PWA sessions).
      this._onVisible = () => { if (!document.hidden) { try { reg.update(); } catch (e) {} } };
      document.addEventListener('visibilitychange', this._onVisible);
    }).catch(() => {});
  };
  applyUpdate = () => {
    const sw = this._swReg && this._swReg.waiting;
    if (sw) { this._updating = true; sw.postMessage('skip-waiting'); }
    else { window.location.reload(); }
  };
  dismissUpdate = () => this.setState({ updateReady: false });

  // ---------- theme ----------
  applyTheme = (theme) => {
    const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    try { localStorage.setItem('lectio.theme', theme); } catch (e) {}
    this.setState({ resolvedTheme: resolved });
  };
  cycleTheme = () => { const o = ['system', 'light', 'dark']; const n = o[(o.indexOf(this.state.theme) + 1) % 3]; this.setState({ theme: n }, () => this.applyTheme(n)); };
  setTheme = (t) => this.setState({ theme: t }, () => this.applyTheme(t));

  // ---------- tap / scroll helpers ----------
  // iOS fires a synthetic click ~300ms after a touch; a "ghost tap" can double-fire
  // a reveal/placement. tapGuard ignores a repeat of the SAME logical action within
  // a short window, while still allowing fast taps on different targets. Pair it with
  // touch-action:manipulation on tap targets so the browser drops the 300ms delay.
  tapGuard = (key, fn) => (...a) => {
    const now = Date.now(); const t = this._taps || (this._taps = {});
    if (now - (t[key] || 0) < 320) return;
    t[key] = now; return fn(...a);
  };
  // Scroll the currently active word/blank (marked data-active="1") into view so
  // typing/word-bank progress stays visible above the pinned bar and keyboard.
  scrollActive = () => {
    try { requestAnimationFrame(() => { const el = document.querySelector('[data-active="1"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }); } catch (e) {}
  };

  // ---------- dictionary (Datamuse + offline fallback) ----------
  // Used to build word-bank distractors: similar-meaning words, biased to the same
  // part of speech. Free, no key. The fetch is time-boxed (~2s default) so a slow
  // or blocked network can't leave the "Finding similar words…" spinner hanging —
  // on timeout or failure we fall back to the offline, part-of-speech-aware pools.
  fetchJson = async (url, ms = 2000) => {
    try {
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const t = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, ms) : null;
      const r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
      if (t) clearTimeout(t);
      if (!r.ok) return null; return await r.json();
    } catch (e) { return null; }
  };
  posOf = (tags) => { if (!tags) return null; for (const t of tags) if (t === 'n' || t === 'v' || t === 'adj' || t === 'adv') return t; return null; };
  matchCase = (sample, word) => /^[A-Z]/.test(sample || '') ? word.charAt(0).toUpperCase() + word.slice(1) : word;

  // Curated common-word pools grouped by part of speech, so word-bank distractors
  // stay plausible even with no network. 'fn' holds function words (pronouns,
  // prepositions, articles) — the short, common words a verse leans on most.
  POS_POOL = {
    n: ['light','water','heart','hand','word','king','land','house','name','day','night','field','tree','stone','mountain','river','voice','face','soul','spirit','fire','wind','rock','gate','road','seed','bread','wine','sheep','staff','crown','throne','servant','master','father','mother','child','brother','friend','enemy','city','nation','people','glory','mercy','grace','truth','peace','joy','hope','faith','love','fear','death','life','power','strength','wisdom','valley','shadow','table','oil','cup','soul','path','sake','house'],
    v: ['walk','run','speak','call','hear','see','know','make','give','take','come','go','stand','sit','rise','fall','keep','hold','lead','follow','seek','find','build','break','send','bring','turn','open','show','tell','ask','answer','believe','remember','gather','bless','praise','sing','pray','rest','dwell','rule','reign','serve','save','heal','teach','trust','wait','flee','want','lie','restore','prepare','anoint','comfort','dwell','follow'],
    adj: ['good','great','holy','righteous','wicked','strong','weak','high','low','deep','wide','bright','dark','clean','pure','wise','foolish','rich','poor','glad','old','young','new','ancient','mighty','gentle','quiet','still','green','golden','heavy','sweet','bitter','faithful','true','living','eternal'],
    adv: ['quickly','slowly','surely','gently','greatly','wholly','freely','boldly','quietly','gladly','soon','again','always','never','often','here','there','now','then','forever','together','within','above','below','near','far','well','yea'],
    fn: ['the','and','but','for','with','from','unto','into','upon','before','after','over','under','through','among','beside','toward','against','they','them','their','thou','thee','thy','him','her','his','our','your','this','that','these','those','which','whom','where','when','shall','will','may','not','all','my','me','he','is','in','of','a'],
  };
  // Reverse index (normalized word -> pos), built once.
  posIndex = () => {
    if (this._posIndex) return this._posIndex;
    const idx = {}; const pools = this.POS_POOL;
    Object.keys(pools).forEach((k) => pools[k].forEach((w) => { const n = this.norm(w); if (n && !(n in idx)) idx[n] = k; }));
    return (this._posIndex = idx);
  };
  // Best-effort part of speech for a word with no Datamuse data: dictionary lookup
  // first, then a few high-signal suffix heuristics.
  localPos = (word) => {
    const n = this.norm(word); if (!n) return null;
    const idx = this.posIndex(); if (idx[n]) return idx[n];
    if (n.length > 3 && /ly$/.test(n)) return 'adv';
    if (/(ing|eth|est)$/.test(n) || (/ed$/.test(n) && n.length > 3)) return 'v';
    if (/(ness|tion|sion|ment|ity|ship|hood|ance|ence)$/.test(n)) return 'n';
    if (/(ous|ful|less|able|ible|ive|ic|ish)$/.test(n)) return 'adj';
    return null;
  };
  posPool = (pos) => { const p = this.POS_POOL; if (pos && p[pos]) return p[pos]; return p.n.concat(p.v, p.adj); };

  // ---------- text utils ----------
  norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ').replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
  stripHtml = (s) => (s || '').replace(/<S>.*?<\/S>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  // Collapse whitespace and clip to n chars (with an ellipsis) — used for the
  // catechism question labels in the picker dropdown.
  truncate = (s, n) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  bookIndex = (name) => this.BOOKS.findIndex((b) => b.name === name) + 1;
  splitSegs = (text) => {
    text = (text || '').normalize('NFC');
    const out = []; const re = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’\-][\p{L}\p{N}\p{M}]*)*/gu; let last = 0, m;
    while ((m = re.exec(text))) { if (m.index > last) out.push({ w: false, text: text.slice(last, m.index) }); out.push({ w: true, text: m[0] }); last = m.index + m[0].length; }
    if (last < text.length) out.push({ w: false, text: text.slice(last) });
    return out;
  };
  // verses: [{ num, text, head? }]. `head` (a catechism question) renders as a
  // non-practiced heading above the verse; only `text` words become practice words.
  // opts carries non-Scripture metadata (kind/attribution/title) used for layout +
  // the copyright line; it is absent (→ nulls) for ordinary Bible passages.
  buildPassage = (reference, version, verses, opts = {}) => {
    let vi = 0; const words = [];
    const vs = verses.map((v, vIdx) => {
      const segs = this.splitSegs((v.text || '').replace(/\s+/g, ' ').trim());
      segs.forEach((s) => { if (s.w) { s.vi = vi; words.push({ vi, text: s.text, v: vIdx }); vi++; } });
      return { num: v.num, head: v.head || null, segs };
    });
    return { reference, version, verses: vs, words, kind: opts.kind || null, attribution: opts.attribution || null, title: opts.title || null };
  };
  parseEsv = (text) => {
    text = (text || '').replace(/\r/g, '');
    const parts = text.split(/\[(\d+)\]/); const verses = [];
    for (let i = 1; i < parts.length; i += 2) {
      const num = parseInt(parts[i], 10);
      const t = (parts[i + 1] || '').replace(/\s+/g, ' ').trim();
      if (t) verses.push({ num, text: t });
    }
    if (!verses.length) { const t = text.replace(/\s+/g, ' ').trim(); if (t) verses.push({ num: 1, text: t }); }
    return verses;
  };

  // ---------- rng / blanks ----------
  hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  pickBlanks = (words, pct, seed) => {
    const idx = words.map((w) => w.vi); const r = this.rng(seed);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[idx[i], idx[j]] = [idx[j], idx[i]]; }
    const count = Math.max(1, Math.round(words.length * pct));
    return idx.slice(0, count).sort((a, b) => a - b);
  };
  buildBank = (passage, blanks, seed) => {
    const items = blanks.map((vi, i) => ({ id: i, vi, text: passage.words[vi].text }));
    const order = items.map((it) => it.id); const r = this.rng(seed ^ 0x9e3779b9);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[order[i], order[j]] = [order[j], order[i]]; }
    return { items, order };
  };
  initModes = (passage) => {
    const seed = this.hash(passage.reference + '|' + passage.words.length);
    const blanks = this.pickBlanks(passage.words, this.state.blankPct, seed);
    const bank = this.buildBank(passage, blanks, seed);
    this._revealPrev = null;
    this.setState({
      blankList: blanks, bank,
      hiddenVals: {}, hiddenReveal: {}, fillActive: null, bankFill: {},
      bankActive: blanks.length ? blanks[0] : null, bankChoice: {}, bankMiss: {}, bankOpts: {}, bankMisses: 0,
      hideAll: false, revealed: {}, revealAllNow: false,
      typeVals: {}, typeReveal: {}, typeActive: null,
    }, () => { if (this.state.mode === 'bank' && !this.allBlank()) this.ensureOptions(); });
  };
  // Shared "ease" slider: how many words become blanks (fill + word-bank modes).
  onBlankPct = (e) => {
    const pct = parseFloat(e.target.value); const p = this.state.passage; if (!p) { this.setState({ blankPct: pct }); return; }
    const seed = this.hash(p.reference + '|' + p.words.length);
    const blanks = this.pickBlanks(p.words, pct, seed); const bank = this.buildBank(p, blanks, seed);
    this.setState({
      blankPct: pct, blankList: blanks, bank,
      hiddenVals: {}, hiddenReveal: {}, fillActive: null, bankFill: {},
      bankChoice: {}, bankMiss: {}, bankOpts: {}, bankMisses: 0,
      bankActive: blanks.length ? blanks[0] : null,
    }, () => { if (this.state.mode === 'bank' && !this.allBlank()) this.ensureOptions(); });
  };

  // ---------- caching (ESV <= 500 verses) ----------
  cache = () => { try { return JSON.parse(localStorage.getItem('lectio.cache') || '{}'); } catch (e) { return {}; } };
  // ESV is the only version capped by terms, so the user-facing "verses cached"
  // count reflects ESV only (see Settings note). Clearing still wipes everything.
  cachedVerseCount = () => Object.values(this.cache()).filter((e) => e.version === 'ESV').reduce((n, e) => n + (e.verses ? e.verses.length : 0), 0);
  cacheKey = (version, ref) => version + '::' + ref.toLowerCase().replace(/\s+/g, ' ').trim();
  storePassage = (version, ref, reference, verses) => {
    const c = this.cache(); const key = this.cacheKey(version, ref);
    c[key] = { reference, version, verses, ts: Date.now() };
    if (version === 'ESV') {
      let total = Object.values(c).filter((e) => e.version === 'ESV').reduce((n, e) => n + e.verses.length, 0);
      const keys = Object.keys(c).filter((k) => c[k].version === 'ESV').sort((a, b) => c[a].ts - c[b].ts);
      while (total > 500 && keys.length) { const k = keys.shift(); if (k === key) continue; total -= c[k].verses.length; delete c[k]; }
    }
    try { localStorage.setItem('lectio.cache', JSON.stringify(c)); } catch (e) {}
    this.setState({ cacheCount: this.cachedVerseCount() });
  };
  getCached = (version, ref) => this.cache()[this.cacheKey(version, ref)];
  clearCache = () => {
    // Clears every cached version — ESV and the public-domain texts alike.
    try { localStorage.removeItem('lectio.cache'); } catch (e) {}
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('clear-cache');
    this.setState({ cacheCount: 0 });
  };

  // ---------- ESV usage limits ----------
  usage = () => {
    const now = Date.now(); const day = new Date().toISOString().slice(0, 10);
    let u; try { u = JSON.parse(localStorage.getItem('lectio.usage') || 'null'); } catch (e) { u = null; }
    if (!u || u.day !== day) u = { day, count: 0, hourStart: now, hourCount: 0, minStart: now, minCount: 0 };
    if (now - u.hourStart > 3600000) { u.hourStart = now; u.hourCount = 0; }
    if (now - u.minStart > 60000) { u.minStart = now; u.minCount = 0; }
    return u;
  };
  canRequestEsv = () => {
    const u = this.usage();
    if (u.count >= 5000) return { ok: false, msg: 'ESV daily limit reached (5,000 requests). It resets tomorrow — King James has no limit.' };
    if (u.hourCount >= 1000) return { ok: false, msg: 'ESV hourly limit reached (1,000 requests). Try later, or use King James.' };
    if (u.minCount >= 60) return { ok: false, msg: 'Slow down — ESV allows 60 requests/minute. Wait a moment, or use King James.' };
    return { ok: true };
  };
  bumpUsage = () => {
    const u = this.usage(); u.count++; u.hourCount++; u.minCount++;
    try { localStorage.setItem('lectio.usage', JSON.stringify(u)); } catch (e) {}
    this.setState({ usageToday: u.count });
  };

  // ---------- passage selector ----------
  bookMeta = (name) => this.BOOKS.find((b) => b.name === name) || { name, chapters: 1 };
  countKey = (book, chapter) => { const meta = this.bookMeta(book); return (meta.chapters === 1 ? book : book + ' ' + chapter).toLowerCase(); };
  curVerseCount = () => this.state.verseCounts[this.countKey(this.state.book, this.state.chapter)];
  ensureVerseCount = async () => {
    const book = this.state.book, chapter = this.state.chapter; const meta = this.bookMeta(book);
    const key = this.countKey(book, chapter); if (this.state.verseCounts[key] != null) return;
    const refForCount = meta.chapters === 1 ? book : book + ' ' + chapter;
    try {
      const res = await fetch('https://bible-api.com/' + encodeURIComponent(refForCount) + '?translation=kjv');
      if (!res.ok) return; const data = await res.json();
      if (data.verses && data.verses.length) {
        const vc = { ...this.state.verseCounts, [key]: data.verses.length };
        try { localStorage.setItem('lectio.vc', JSON.stringify(vc)); } catch (e) {}
        this.setState({ verseCounts: vc });
      }
    } catch (e) {}
  };
  buildRef = () => {
    const meta = this.bookMeta(this.state.book); const single = meta.chapters === 1; const ch = this.state.chapter;
    const count = this.curVerseCount();
    const s = Math.max(1, parseInt(this.state.vStart || '1', 10) || 1);
    const eRaw = (this.state.vEnd || '').trim();
    const e = eRaw ? (parseInt(eRaw, 10) || s) : (count || null);
    const whole = s <= 1 && (e === null || (count && e >= count));
    if (whole) return single ? meta.name : meta.name + ' ' + ch;
    const ee = e === null ? s : Math.max(s, e);
    const range = ee !== s ? s + '-' + ee : '' + s;
    return single ? meta.name + ' ' + range : meta.name + ' ' + ch + ':' + range;
  };
  isWholeSel = () => { const count = this.curVerseCount(); const s = parseInt(this.state.vStart || '1', 10) || 1; const eRaw = (this.state.vEnd || '').trim(); return s <= 1 && (!eRaw || (count && parseInt(eRaw, 10) >= count)); };
  persistSel = () => { try { localStorage.setItem('lectio.sel', JSON.stringify({ book: this.state.book, chapter: this.state.chapter, vStart: this.state.vStart, vEnd: this.state.vEnd })); } catch (e) {} };
  togglePicker = () => { const open = !this.state.pickerOpen; this.setState({ pickerOpen: open }); if (open) this.ensureVerseCount(); };
  onBook = (e) => { this.setState({ book: e.target.value, chapter: '1', vStart: '1', vEnd: '' }, () => this.ensureVerseCount()); };
  onChapter = (e) => this.setState({ chapter: e.target.value, vStart: '1', vEnd: '' }, () => this.ensureVerseCount());
  onVStart = (e) => this.setState({ vStart: e.target.value });
  onVEnd = (e) => this.setState({ vEnd: e.target.value });
  setWhole = () => { const count = this.curVerseCount(); this.setState({ vStart: '1', vEnd: count ? String(count) : '' }); };
  onRefKey = (e) => { if (e.key === 'Enter') this.doLoad(); };
  doLoad = () => {
    if (this.state.corpus === 'creeds') { this.loadCreed(); return; }
    const ref = this.buildRef(); this.persistSel(); this.setState({ refInput: ref, pickerOpen: false }, () => this.runLoad());
  };
  setVersion = (v) => {
    const upd = { version: v, error: null, offerKjv: false };
    if (v === 'Greek' && this.bookIndex(this.state.book) < 40) { upd.book = 'Matthew'; upd.chapter = '1'; upd.vStart = '1'; upd.vEnd = ''; }
    // ESV needs a user-supplied API token. Prompt for it the moment ESV is chosen if
    // one isn't saved yet, rather than waiting for a failed load.
    if (v === 'ESV' && !this.state.esvToken.trim()) upd.esvModalOpen = true;
    this.setState(upd, () => { try { localStorage.setItem('lectio.version', v); } catch (e) {} this.ensureVerseCount(); });
  };
  openEsvModal = () => this.setState({ esvModalOpen: true });
  closeEsvModal = () => this.setState({ esvModalOpen: false });
  switchToKjv = () => { this.setState({ version: 'KJV', error: null, offerKjv: false }, () => { try { localStorage.setItem('lectio.version', 'KJV'); } catch (e) {} this.runLoad(); }); };
  // From the ESV token modal: fall back to King James and dismiss (no forced load).
  switchToKjvFromModal = () => { this.setState({ version: 'KJV', error: null, offerKjv: false, esvModalOpen: false }, () => { try { localStorage.setItem('lectio.version', 'KJV'); } catch (e) {} }); };

  // ---------- creeds & catechisms (embedded, no network) ----------
  creedDoc = (id) => this.CREEDS.find((d) => d.id === (id || this.state.creedId)) || this.CREEDS[0] || null;
  // Some creeds (e.g. the Lord's Prayer) ship the same text in several languages,
  // chosen by a toggle. creedLangList returns that list (or null for single-language
  // docs); curCreedLang resolves the active language; creedParas yields its paragraphs.
  creedLangList = (d) => (d && Array.isArray(d.langs) && d.langs.length) ? d.langs : null;
  curCreedLang = (d) => { const ls = this.creedLangList(d); if (!ls) return null; return ls.find((l) => l.id === this.state.creedLang) || ls[0]; };
  creedParas = (d) => { const l = this.curCreedLang(d); return (l ? l.paras : d.paras) || []; };
  // A creed's display reference: title alone, or "title · Language" when multilingual
  // (so English and Greek track progress separately and the header reads clearly).
  creedLabel = (d) => { const l = this.curCreedLang(d); return l ? d.title + ' · ' + l.label : d.title; };
  // Whether this doc carries a Lord's Day map (Heidelberg) and is in that mode now.
  ldActive = (d) => Array.isArray(d.lordsDays) && d.lordsDays.length > 0 && this.state.ldMode;
  // Catechism questions are independent, so one is studied at a time. The exception is
  // grouping by Lord's Day (Heidelberg), where a single Lord's Day spans a few questions.
  // Returns the question range to load (qs..qe) plus its reference label.
  catSelection = (d) => {
    if (this.ldActive(d)) {
      const days = d.lordsDays; const n = Math.min(Math.max(1, parseInt(this.state.ldStart || '1', 10) || 1), days.length);
      const [qs, qe] = days[n - 1];
      return { qs, qe, label: d.short + ' · Lord’s Day ' + n };
    }
    const total = d.items.length;
    const n = Math.min(Math.max(1, parseInt(this.state.qStart || '1', 10) || 1), total);
    return { qs: n, qe: n, label: d.short + ' Q' + n };
  };
  // Reference shown in the picker/header before a creed has been loaded.
  creedRefPreview = () => { const d = this.creedDoc(); if (!d) return 'Creeds & Catechisms'; return d.kind === 'catechism' ? this.catSelection(d).label : this.creedLabel(d); };
  setCorpus = (c) => this.setState({ corpus: c, error: null, offerKjv: false });
  // Switching docs resets the question/Lord's-Day cursors and the language to the new
  // doc's first available language (so a single-language doc never shows a stale lang).
  onCreed = (e) => { const id = e.target.value; const ls = this.creedLangList(this.creedDoc(id)); this.setState({ creedId: id, qStart: '1', ldStart: '1', creedLang: ls ? ls[0].id : 'en' }, this.persistCreedSel); };
  setCatGroup = (m) => this.setState({ ldMode: m === 'lordsday' }, this.persistCreedSel);
  setCreedLang = (id) => this.setState({ creedLang: id }, this.persistCreedSel);
  onQStart = (e) => this.setState({ qStart: e.target.value }, this.persistCreedSel);
  onLdStart = (e) => this.setState({ ldStart: e.target.value }, this.persistCreedSel);
  persistCreedSel = () => { try { localStorage.setItem('lectio.creedsel', JSON.stringify({ creedId: this.state.creedId, qStart: this.state.qStart, ldMode: this.state.ldMode, ldStart: this.state.ldStart, creedLang: this.state.creedLang })); } catch (e) {} };
  loadCreed = () => {
    const d = this.creedDoc(); if (!d) return;
    let reference, verses;
    if (d.kind === 'catechism') {
      const sel = this.catSelection(d);
      verses = d.items.filter((it) => it.n >= sel.qs && it.n <= sel.qe).map((it) => ({ num: it.n, head: it.q, text: it.a }));
      reference = sel.label;
    } else {
      verses = this.creedParas(d).map((t) => ({ num: null, text: t }));
      reference = this.creedLabel(d);
    }
    this.persistCreedSel();
    const passage = this.buildPassage(reference, d.id, verses, { kind: d.kind, attribution: d.attribution, title: d.title });
    try { localStorage.setItem('lectio.ref', reference); } catch (e) {}
    this.setState({ pickerOpen: false, loading: false, error: null, offerKjv: false, refInput: reference, passage }, () => this.initModes(passage));
  };

  runLoad = async () => {
    const ref = this.state.refInput.trim(); if (!ref) return;
    const version = this.state.version;
    this.setState({ loading: true, error: null, offerKjv: false });
    try {
      let verses, reference, label = version;
      if (version === 'ESV') {
        const token = this.state.esvToken.trim();
        if (!token) { this.setState({ loading: false, esvModalOpen: true, error: 'Add your ESV API token to use the ESV — or switch to King James.', offerKjv: true }); return; }
        const gate = this.canRequestEsv();
        if (!gate.ok) {
          const cached = this.getCached('ESV', ref);
          if (cached) { const p = this.buildPassage(cached.reference, 'ESV', cached.verses); this.setState({ loading: false, passage: p }, () => this.initModes(p)); return; }
          this.setState({ loading: false, error: gate.msg, offerKjv: true }); return;
        }
        const url = 'https://api.esv.org/v3/passage/text/?q=' + encodeURIComponent(ref) +
          '&include-passage-references=true&include-verse-numbers=true&include-footnotes=false&include-headings=false&include-short-copyright=false&include-passage-horizontal-lines=false&include-heading-horizontal-lines=false&include-first-verse-numbers=true';
        let res;
        try { this.bumpUsage(); res = await fetch(url, { headers: { Authorization: 'Token ' + token } }); }
        catch (netErr) {
          const cached = this.getCached('ESV', ref);
          if (cached) { const p = this.buildPassage(cached.reference, 'ESV', cached.verses); this.setState({ loading: false, passage: p }, () => this.initModes(p)); return; }
          this.setState({ loading: false, error: 'Network error. Cached passages still work offline.' }); return;
        }
        if (res.status === 401) { this.setState({ loading: false, error: 'That ESV token was rejected. Check it in Settings.' }); return; }
        if (res.status === 429) { this.setState({ loading: false, error: 'ESV rate limit hit. Wait a moment, or switch to King James.', offerKjv: true }); return; }
        if (!res.ok) { this.setState({ loading: false, error: 'ESV request failed (' + res.status + '). Try King James instead.', offerKjv: true }); return; }
        const data = await res.json();
        if (!data.passages || !data.passages.length) { this.setState({ loading: false, error: 'No ESV passage found for "' + ref + '".' }); return; }
        reference = data.canonical || ref;
        verses = this.parseEsv(data.passages.join('\n'));
        if (verses.length > 500) { this.setState({ loading: false, error: 'That exceeds the ESV 500-verse limit. Choose a shorter passage, or use King James.', offerKjv: true }); return; }
        this.storePassage('ESV', ref, reference, verses);
      } else if (version === 'Greek') {
        const id = this.bookIndex(this.state.book);
        if (id < 40) { this.setState({ loading: false, error: 'The Greek New Testament covers Matthew through Revelation. Choose a New Testament book.' }); return; }
        const ch = this.state.chapter;
        let res;
        try { res = await fetch('https://bolls.life/get-text/TISCH/' + id + '/' + ch + '/'); }
        catch (netErr) {
          const cached = this.getCached('GNT', ref);
          if (cached) { const p = this.buildPassage(cached.reference, 'GNT', cached.verses); this.setState({ loading: false, passage: p }, () => this.initModes(p)); return; }
          this.setState({ loading: false, error: 'Network error — could not reach the Greek text service.' }); return;
        }
        if (!res.ok) { this.setState({ loading: false, error: 'Greek text request failed (' + res.status + ').' }); return; }
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) { this.setState({ loading: false, error: 'No Greek text found for "' + ref + '".' }); return; }
        let vs = data.map((v) => ({ num: v.verse, text: this.stripHtml(v.text) })).filter((v) => v.text);
        const count = this.curVerseCount();
        const s = Math.max(1, parseInt(this.state.vStart || '1', 10) || 1);
        const eRaw = (this.state.vEnd || '').trim();
        const e = eRaw ? (parseInt(eRaw, 10) || s) : (count || 9999);
        const isWhole = s <= 1 && (!eRaw || (count && e >= count));
        if (!isWhole) vs = vs.filter((v) => v.num >= s && v.num <= Math.max(s, e));
        if (!vs.length) { this.setState({ loading: false, error: 'No verses in that range.' }); return; }
        reference = ref; label = 'GNT';
        this.storePassage('GNT', ref, reference, vs);
        verses = vs;
      } else {
        let res;
        try { res = await fetch('https://bible-api.com/' + encodeURIComponent(ref) + '?translation=kjv'); }
        catch (netErr) {
          const cached = this.getCached('KJV', ref);
          if (cached) { const p = this.buildPassage(cached.reference, 'KJV', cached.verses); this.setState({ loading: false, passage: p }, () => this.initModes(p)); return; }
          this.setState({ loading: false, error: 'Network error — could not reach the King James service.' }); return;
        }
        if (!res.ok) { this.setState({ loading: false, error: 'Could not find "' + ref + '" (KJV). Check the reference.' }); return; }
        const data = await res.json();
        if (!data.verses || !data.verses.length) { this.setState({ loading: false, error: 'No passage found for "' + ref + '".' }); return; }
        reference = data.reference || ref; label = 'KJV';
        verses = data.verses.map((v) => ({ num: v.verse, text: (v.text || '').replace(/\s+/g, ' ').trim() }));
        this.storePassage('KJV', ref, reference, verses);
      }
      try { localStorage.setItem('lectio.ref', ref); } catch (e) {}
      const passage = this.buildPassage(reference, label, verses);
      this.setState({ loading: false, passage }, () => this.initModes(passage));
    } catch (e) {
      this.setState({ loading: false, error: 'Something went wrong loading that passage.' });
    }
  };

  // ---------- mode navigation ----------
  setMode = (m) => this.setState({ mode: m }, () => { if (m === 'bank' && !this.allBlank()) this.ensureOptions(); });
  goHome = () => this.setState({ view: 'home' });
  startMode = (m) => { const p = this.state.passage; this.setState({ mode: m, view: 'practice' }, () => { if (p) this.initModes(p); }); };
  startHide = () => this.startMode('hide');
  startFill = () => this.startMode('hidden');
  startBank = () => this.startMode('bank');
  startType = () => this.startMode('type');
  homeSummary = () => {
    const s = this.state.streak.count || 0;
    const learned = Object.values(this.state.progress).filter((p) => p.learned).length;
    const parts = [s > 0 ? s + '-day streak' : 'Start your streak today'];
    if (learned > 0) parts.push(learned + (learned === 1 ? ' passage learned' : ' passages learned'));
    return parts.join('  ·  ');
  };
  resetMode = () => { const p = this.state.passage; if (p) this.initModes(p); };
  toggleHints = () => this.setState({ showHints: !this.state.showHints });
  // Scripture display preferences (persisted): font family + size. Size always drives
  // font-size — never CSS zoom — so iOS keeps text crisp and inline inputs aligned.
  scriptFont = () => this.state.scriptureFont === 'sans' ? "'Noto Sans',system-ui,sans-serif" : "'Gentium Book Plus','Georgia',serif";
  setScriptureFont = (f) => { this.setState({ scriptureFont: f }); try { localStorage.setItem('lectio.font', f); } catch (e) {} };
  setScriptureSize = (s) => { this.setState({ scriptureSize: s }); try { localStorage.setItem('lectio.size', s); } catch (e) {} };

  // ---------- progress / streak ----------
  passageKey = () => { const p = this.state.passage; return p ? p.version + ' · ' + p.reference : ''; };
  recordResult = (acc, opts = {}) => {
    const key = this.passageKey(); if (!key) return;
    const prog = { ...this.state.progress }; const cur = prog[key] || { best: 0, learned: false, attempts: 0 };
    cur.best = Math.max(cur.best, acc); cur.attempts++; cur.lastMode = this.state.mode;
    // "Test" mode is the yardstick for how much of the passage is known: store its
    // latest score as the passage's known level (a fresh test reflects current recall).
    if (opts.known) cur.known = acc;
    prog[key] = cur;
    this.setState({ progress: prog }); try { localStorage.setItem('lectio.progress', JSON.stringify(prog)); } catch (e) {}
    this.markPracticed();
  };
  markPracticed = () => {
    const today = new Date().toISOString().slice(0, 10); const s = { ...this.state.streak };
    if (s.last === today) return;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.count = (s.last === y ? s.count : 0) + 1; s.last = today;
    this.setState({ streak: s }); try { localStorage.setItem('lectio.streak', JSON.stringify(s)); } catch (e) {}
  };
  toggleLearned = () => {
    const key = this.passageKey(); if (!key) return;
    const prog = { ...this.state.progress }; const cur = prog[key] || { best: 0, learned: false, attempts: 0 };
    cur.learned = !cur.learned; prog[key] = cur;
    this.setState({ progress: prog }); try { localStorage.setItem('lectio.progress', JSON.stringify(prog)); } catch (e) {}
  };

  // ---------- settings ----------
  openSettings = () => this.setState({ settingsOpen: true });
  closeSettings = () => this.setState({ settingsOpen: false });
  openCopyright = () => this.setState({ copyrightOpen: true });
  closeCopyright = () => this.setState({ copyrightOpen: false });
  stop = (e) => e.stopPropagation();
  onTokenChange = (e) => { const v = e.target.value; this.setState({ esvToken: v }); try { localStorage.setItem('lectio.esvToken', v); } catch (e2) {} };
  toggleReminder = async () => {
    if (!this.state.reminderOn) {
      try { if ('Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission(); } catch (e) {}
      this.setState({ reminderOn: true }); try { localStorage.setItem('lectio.reminder', '1'); } catch (e) {}
    } else { this.setState({ reminderOn: false }); try { localStorage.setItem('lectio.reminder', '0'); } catch (e) {} }
  };
  maybeRemind = () => {
    try {
      if (localStorage.getItem('lectio.reminder') !== '1') return;
      const today = new Date().toISOString().slice(0, 10);
      const s = JSON.parse(localStorage.getItem('lectio.streak') || '{}');
      if (s.last === today) return;
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Lectio', { body: 'Take a few minutes to hide his word in your heart today.' });
    } catch (e) {}
  };

  // ---------- style helpers ----------
  seg = (active) => ({ padding: '7px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, background: active ? 'var(--accent)' : 'transparent', color: active ? '#fbf8f1' : 'var(--muted)' });
  tab = (active) => ({ padding: '9px 15px', borderRadius: '10px', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--line)'), cursor: 'pointer', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', background: active ? 'var(--accent-soft)' : 'var(--surface)', color: active ? 'var(--accent)' : 'var(--text)' });
  toggleBtn = (active) => ({ padding: '9px 14px', borderRadius: '10px', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--line)'), background: active ? 'var(--accent-soft)' : 'var(--surface)', color: active ? 'var(--accent)' : 'var(--muted)', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' });
