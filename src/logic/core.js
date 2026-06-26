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
    suggestId: 'start',
    ldMode: false, ldStart: '1',
    refInput: 'Psalms 23', verseCounts: {},
    loading: false, error: null, offerKjv: false,
    passage: null, mode: 'hide',
    settingsOpen: false, copyrightOpen: false, esvModalOpen: false,
    esvToken: '', reminderOn: false,
    showHints: true, showVerseNums: true, scriptureSize: 'Comfortable', scriptureFont: 'serif',
    blankPct: 0.25, blankList: [],
    hideAll: false, revealed: {}, hidden: {}, revealAllNow: false, holdPeek: false,
    hiddenVals: {}, hiddenReveal: {}, fillActive: null,
    bank: null, bankFill: {},
    bankActive: null, bankChoice: {}, bankMiss: {}, bankOpts: {}, bankMisses: 0,
    typeVals: {}, typeReveal: {}, typeActive: null,
    progress: {}, streak: { count: 0, last: null, best: 0 }, seen: [], history: {},
    cacheCount: 0, usageToday: 0,
    // Transient gamification banner (level-up / streak milestone / new badge /
    // first practice of the day). Set by markPracticed → maybeCelebrate (gamify.js).
    celebrate: null,
    updateReady: false, updateMsg: '', dataMsg: '',
    kbInset: 0,
    canonOpen: {},
    loadedSig: null,
    // Verse-by-verse study: focus a single verse of a loaded chapter at a time.
    // fullPassage holds the whole chapter while vbvIdx walks through its verses;
    // the displayed `passage` is swapped for a one-verse sub-passage so every mode
    // (hide/fill/bank/type) practises just that verse with no extra plumbing.
    vbv: false, vbvIdx: 0, fullPassage: null,
    // Which collection the "Your progress" view maps: 'bible' (the canon) or a
    // creed/catechism id.
    statsScope: 'bible',
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
  // KJV paragraph (pilcrow ¶) positions, injected by build.mjs as window.LECTIO_KJVPARA
  // (built by scripts/build-kjv-paragraphs.mjs): { <bookId>: { <chapter>: [<verse>, …] } }.
  // buildPassage marks the verses that begin a paragraph so KJV prose reads in paragraphs.
  // (The printed 1769 pilcrows stop after Acts 20:36, so later books simply have none.)
  KJV_PARA = (typeof window !== 'undefined' && window.LECTIO_KJVPARA) || {};

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
      mode: g('lectio.mode', this.props.defaultMode || 'hide'),
      progress: gj('lectio.progress', {}),
      streak: gj('lectio.streak', { count: 0, last: null, best: 0 }),
      seen: gj('lectio.seen', []),
      history: gj('lectio.history', {}),
      cacheCount: this.cachedVerseCount(),
      usageToday: this.usage().count,
    };
    // Seed the longest-streak record for users from before it was tracked.
    next.streak.best = Math.max(next.streak.best || 0, next.streak.count || 0);
    if (sel && sel.book) { next.book = sel.book; next.chapter = sel.chapter; next.vStart = sel.vStart || '1'; next.vEnd = sel.vEnd || ''; }
    // Remember the last creeds picker selection (the displayed passage still starts
    // on the Scripture sample below; corpus stays 'bible' until the user switches).
    const csel = gj('lectio.creedsel', null);
    if (csel && csel.creedId) { next.creedId = csel.creedId; next.qStart = csel.qStart || '1'; next.ldMode = !!csel.ldMode; next.ldStart = csel.ldStart || '1'; if (csel.creedLang) next.creedLang = csel.creedLang; }
    next.verseCounts = gj('lectio.vc', {});
    // While the saved passage is being restored, suppress the "changed selection"
    // overlay so a returning user never sees their last passage flagged as stale.
    // restoreLastSelection sets the passage (saved selection, or the bundled sample on a
    // first visit) — a single load, so its initModes isn't clobbered by a second one.
    this._booting = true;
    this.setState(next, () => { this.applyTheme(theme); this.ensureVerseCount(); this.restoreLastSelection(); });

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

    // Re-render the stats view on resize so the canon bar re-bins to the new width.
    this._onResize = () => { if (this.state.view === 'stats') this.setState({ rsz: (this.state.rsz || 0) + 1 }); };
    window.addEventListener('resize', this._onResize);

    this.registerServiceWorker();
    this.maybeRemind();
  }
  componentWillUnmount() {
    if (this._mm) this._mm.removeEventListener('change', this._onMM);
    if (this._onVisible) document.removeEventListener('visibilitychange', this._onVisible);
    if (this._vv && this._onVV) { this._vv.removeEventListener('resize', this._onVV); this._vv.removeEventListener('scroll', this._onVV); }
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._updTimer) clearInterval(this._updTimer);
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
      // Poll for a fresh build periodically — a long-lived foreground PWA session may
      // otherwise sit on stale code; the focus + mode-switch checks cover the rest.
      this._updTimer = setInterval(() => this.runUpdateCheck(false), 1800000);
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
  // Manual / background "check for updates": ping the worker for a fresh build. A new
  // build installs and trips the updatefound listener above (which shows the refresh
  // modal); the manual path also reports the outcome in Settings.
  runUpdateCheck = (manual) => {
    const reg = this._swReg;
    if (!('serviceWorker' in navigator) || !reg) { if (manual) this.setState({ updateMsg: 'Updates aren’t available here.' }); return; }
    if (manual) this.setState({ updateMsg: 'Checking…' });
    Promise.resolve().then(() => reg.update()).then(() => {
      if (!manual) return;
      this.setState({ updateMsg: (reg.installing || reg.waiting) ? 'A new version is downloading — you’ll be prompted to refresh.' : 'You’re on the latest version.' });
    }).catch(() => { if (manual) this.setState({ updateMsg: 'Couldn’t check just now — try again later.' }); });
  };
  checkForUpdates = () => this.runUpdateCheck(true);

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
  // Datamuse frequency tag ("f:NN.NN" — occurrences per million words). Word-bank
  // distractors below this floor are dropped so we don't offer junk or archaic forms
  // ("elr", "wottest") that the reader would never mistake for the answer.
  MIN_OPT_FREQ = 1;
  freqOf = (tags) => { if (!tags) return 0; for (const t of tags) if (t.indexOf('f:') === 0) return parseFloat(t.slice(2)) || 0; return 0; };
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
  // Normalize a word for matching: fold case + diacritics + Greek final sigma, then
  // drop EVERY non-alphanumeric — including apostrophes (curly or straight). So a
  // possessive/contraction matches whether or not the punctuation is typed ("Lords"
  // == "Lord's", "dont" == "don't"). Used by all graded modes (Test, Fill, Bank).
  norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]/gu, '');
  stripHtml = (s) => (s || '').replace(/<S>.*?<\/S>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  // Collapse whitespace and clip to n chars (with an ellipsis) — used for the
  // catechism question labels in the picker dropdown.
  truncate = (s, n) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  bookIndex = (name) => this.BOOKS.findIndex((b) => b.name === name) + 1;
  // Normalize verse/creed text for layout: collapse runs of spaces/tabs to a single space
  // but PRESERVE newlines as hard line breaks (poetry lines, paragraph breaks, Lord's Prayer
  // clauses) so renderWord can emit <br>s. A ¶ pilcrow (KJV-style paragraph mark) becomes a
  // paragraph break; spaces around each break are trimmed and 3+ blank lines collapse to one.
  normText = (s) => (s || '').replace(/\r/g, '').replace(/¶/g, '\n\n').replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
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
  // KJV poetry is set as parallel cola separated by the edition's own colon (with a secondary
  // semicolon): "The LORD is my shepherd; I shall not want." We break the poetry books on
  // those marks so each parallel line stands alone, and start every verse on its own line.
  // ESV carries its own lineation; prose books and creeds are left flowing.
  POETRY_REF = /^(?:Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Lamentations)\b/;
  isPoetryRef = (reference) => this.POETRY_REF.test(this.fixBookName(reference || ''));
  // KJV layout: lineate poetry at the edition's parallelism colon/semicolon (each verse on
  // its own line — br), and open a new paragraph at the 1769 pilcrow positions (KJV_PARA — pbr).
  // ESV brings its own lineation; prose books and creeds are left flowing.
  formatKjv = (reference, verses) => {
    const poetry = this.isPoetryRef(reference);
    const pr = this.parseRef(reference);
    const starts = (pr && pr.ch != null && this.KJV_PARA[pr.bi + 1] && this.KJV_PARA[pr.bi + 1][pr.ch]) || null;
    if (!poetry && !starts) return verses;
    return verses.map((v, i) => ({
      ...v,
      text: poetry ? (v.text || '').replace(/([;:])[^\S\n]+/g, '$1\n') : v.text,
      br: (poetry && i > 0) || !!v.br,
      pbr: (!!starts && starts.indexOf(v.num) !== -1) || !!v.pbr,
    }));
  };
  buildPassage = (reference, version, verses, opts = {}) => {
    reference = this.fixBookName(reference);
    if (version === 'KJV' && !opts.kind) verses = this.formatKjv(reference, verses);
    let vi = 0; const words = [];
    const vs = verses.map((v, vIdx) => {
      const segs = this.splitSegs(this.normText(v.text));
      segs.forEach((s) => { if (s.w) { s.vi = vi; words.push({ vi, text: s.text, v: vIdx }); vi++; } });
      return { num: v.num, head: v.head || null, br: !!v.br, pbr: !!v.pbr, segs };
    });
    // Scripture passages append the reference as a final memory line ("Psalm 23:1 to 5")
    // so it's practiced along with the text in every mode — its words join the flat
    // `words` list, so they hide/blank/score like the rest. Creeds/catechisms carry their
    // own attribution and pass opts.kind, so they skip this.
    let refSegs = null;
    if (!opts.kind && !opts.noRef && reference) {
      refSegs = this.splitSegs(this.refToText(reference));
      refSegs.forEach((s) => { if (s.w) { s.vi = vi; words.push({ vi, text: s.text, v: vs.length }); vi++; } });
    }
    return { reference, version, verses: vs, words, refSegs, kind: opts.kind || null, attribution: opts.attribution || null, title: opts.title || null };
  };
  parseEsv = (text) => {
    text = (text || '').replace(/\r/g, '');
    const parts = text.split(/\[(\d+)\]/); const verses = [];
    for (let i = 1; i < parts.length; i += 2) {
      const num = parseInt(parts[i], 10);
      const t = this.normText(parts[i + 1]);
      // The ESV text endpoint lineates poetry (and paragraphs) with newlines; a newline just
      // before this verse's number marker means the verse begins a new poetic line/paragraph.
      const br = /\n[^\S\n]*$/.test(parts[i - 1] || '');
      if (t) verses.push({ num, text: t, br });
    }
    if (!verses.length) { const t = this.normText(text); if (t) verses.push({ num: 1, text: t }); }
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
    // Fresh random seed per load/restart so the hidden words vary each time a passage is
    // opened, rather than always blanking the same set. The ease slider reuses this same
    // seed (onBlankPct), so dragging it grows/shrinks a stable, nested selection instead of
    // reshuffling on every tick.
    this._blankSeed = (Math.random() * 0x100000000) >>> 0;
    const seed = this._blankSeed;
    const blanks = this.pickBlanks(passage.words, this.state.blankPct, seed);
    const bank = this.buildBank(passage, blanks, seed);
    this._revealPrev = null;
    // Reset the per-test "already counted as practice" flag so the next Test attempt
    // bumps the streak/heatmap once, then refines its partial score silently.
    this._typeScored = false;
    // bankOpts (the per-blank option cache) is reset in the setState below; its companion
    // in-flight guard `_optLoading` lives on the instance, so it must be reset in lockstep.
    // Otherwise a word index that was loaded for a previous passage stays flagged, and the
    // matching blank in the new passage never repopulates options — the "Finding similar
    // words…" spinner hangs forever (notably the first one or two blanks after a switch).
    this._optLoading = {};
    this.setState({
      blankList: blanks, bank,
      hiddenVals: {}, hiddenReveal: {}, fillActive: null, bankFill: {},
      bankActive: blanks.length ? blanks[0] : null, bankChoice: {}, bankMiss: {}, bankOpts: {}, bankMisses: 0,
      hideAll: false, revealed: {}, hidden: {}, revealAllNow: false, holdPeek: false,
      // Test mode carries persistent per-passage progress: verses already mastered are
      // pre-filled so a returning user sees them done and can focus on the rest. A Restart
      // (resetMode) sets _typeNoSeed to clear them for a fresh self-test without erasing the
      // stored mastery — see seedTypeKnown.
      typeVals: this.seedTypeKnown(passage), typeReveal: {}, typeActive: null,
    }, () => { if (this.state.mode === 'bank' && !this.allBlank()) this.ensureOptions(); });
  };
  // Shared "ease" slider: how many words become blanks (fill + word-bank modes).
  onBlankPct = (e) => {
    const pct = parseFloat(e.target.value); const p = this.state.passage; if (!p) { this.setState({ blankPct: pct }); return; }
    // Reuse this load's random seed so dragging only changes how many words are hidden, not
    // which ones (a stable nested set); fall back to a derived seed if none was set yet.
    const seed = this._blankSeed != null ? this._blankSeed : this.hash(p.reference + '|' + p.words.length);
    const blanks = this.pickBlanks(p.words, pct, seed); const bank = this.buildBank(p, blanks, seed);
    // Keep the option-cache guard in sync with the bankOpts reset below (see initModes).
    this._optLoading = {};
    this.setState({
      blankPct: pct, blankList: blanks, bank,
      hiddenVals: {}, hiddenReveal: {}, fillActive: null, bankFill: {},
      bankChoice: {}, bankMiss: {}, bankOpts: {}, bankMisses: 0,
      bankActive: blanks.length ? blanks[0] : null,
    }, () => { if (this.state.mode === 'bank' && !this.allBlank()) this.ensureOptions(); });
  };
  // Re-roll WHICH words are blanked, keeping the current count (blankPct). The ease slider
  // grows/shrinks a stable nested set off one seed; this draws a fresh seed so the same
  // percentage lands on a different set of words — a new variation of the same difficulty.
  // (At "every word blank" there's nothing to vary, so it's a no-op.)
  reshuffleBlanks = () => {
    const p = this.state.passage; if (!p || this.allBlank()) return;
    this._blankSeed = (Math.random() * 0x100000000) >>> 0;
    const seed = this._blankSeed;
    const blanks = this.pickBlanks(p.words, this.state.blankPct, seed); const bank = this.buildBank(p, blanks, seed);
    // Keep the option-cache guard in sync with the bankOpts reset below (see initModes).
    this._optLoading = {};
    this.setState({
      blankList: blanks, bank,
      hiddenVals: {}, hiddenReveal: {}, fillActive: null, bankFill: {},
      bankChoice: {}, bankMiss: {}, bankOpts: {}, bankMisses: 0,
      bankActive: blanks.length ? blanks[0] : null,
    }, () => { if (this.state.mode === 'bank' && !this.allBlank()) this.ensureOptions(); });
  };

  // ---------- verse-by-verse study ----------
  // When a whole chapter (or any multi-verse Scripture passage) is on screen, you can
  // narrow practice to one verse at a time. The full chapter is parked in fullPassage
  // and each verse is rebuilt as its own tiny passage (offline-instant — no refetch),
  // so every mode (hide/fill/bank/type) practises just that verse with no special-casing.
  // Creeds/catechisms (kind set, or unnumbered verses) and single-verse picks are excluded.
  vbvAvailable = () => { const p = this.state.passage; return !!p && !p.kind && p.verses.length > 1 && p.verses.every((v) => v.num != null); };
  // A focused verse's reference, e.g. "John 3:16" (or "Jude 3" for single-chapter books),
  // derived from the full passage's reference so progress keys and the canon map line up.
  verseFocusRef = (full, v) => {
    const ref = this.parseRef(full.reference); if (!ref || v.num == null) return full.reference;
    const meta = this.BOOKS[ref.bi]; const single = meta.chapters === 1;
    return this.fixBookName(single ? meta.name + ' ' + v.num : meta.name + ' ' + (ref.ch || this.state.chapter) + ':' + v.num);
  };
  // Swap the displayed passage for the single verse at idx (rebuilt from its stored
  // segments) and re-init the active mode against it. No appended reference line.
  loadVerseFocus = (idx) => {
    const full = this.state.fullPassage; if (!full) return;
    const v = full.verses[idx]; if (!v) return;
    const text = v.segs.map((s) => s.text).join('');
    const passage = this.buildPassage(this.verseFocusRef(full, v), full.version, [{ num: v.num, text }], { noRef: true });
    this.setState({ vbvIdx: idx, passage }, () => this.initModes(passage));
  };
  enterVbv = () => { const full = this.state.passage; if (!this.vbvAvailable()) return; this.setState({ vbv: true, fullPassage: full }, () => this.loadVerseFocus(0)); };
  exitVbv = () => { const full = this.state.fullPassage; if (!full) { this.setState({ vbv: false }); return; } this.setState({ vbv: false, fullPassage: null, passage: full }, () => this.initModes(full)); };
  vbvGo = (delta) => {
    const full = this.state.fullPassage; if (!full) return;
    let i = (this.state.vbvIdx || 0) + delta; if (i < 0) i = 0; if (i > full.verses.length - 1) i = full.verses.length - 1;
    if (i !== this.state.vbvIdx) this.loadVerseFocus(i);
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

  // ---------- bundled offline text (KJV / GNT / LXX) ----------
  // The public-domain texts ship with the app as per-book JSON under data/<dir>/<id>.json
  // (precached by the service worker), so a passage you've never opened still works with no
  // network. ESV is never bundled (its terms cap caching, so it stays online + the 500-verse
  // localStorage cache). label is the cache/version label (KJV/GNT/LXX); the OT↔NT split for
  // Greek is already resolved into LXX vs GNT by the caller.
  BUNDLE_DIR = { KJV: 'kjv', GNT: 'gnt', LXX: 'lxx', Coverdale: 'coverdale' };
  bundledPassage = async (label) => {
    const dir = this.BUNDLE_DIR[label]; if (!dir) return null;
    const id = this.bookIndex(this.state.book); if (id < 1) return null;
    let data;
    try { const r = await fetch('data/' + dir + '/' + id + '.json'); if (!r.ok) return null; data = await r.json(); }
    catch (e) { return null; }
    const chap = data && data.chapters && data.chapters[String(this.state.chapter)]; if (!chap) return null;
    const nums = Object.keys(chap).map((n) => parseInt(n, 10)).filter((n) => n > 0).sort((a, b) => a - b);
    if (!nums.length) return null;
    const count = nums[nums.length - 1];
    const s = Math.max(1, parseInt(this.state.vStart || '1', 10) || 1);
    const eRaw = (this.state.vEnd || '').trim();
    const e = eRaw ? (parseInt(eRaw, 10) || s) : count;
    const whole = s <= 1 && (!eRaw || e >= count);
    const verses = nums.filter((n) => whole || (n >= s && n <= Math.max(s, e))).map((n) => ({ num: n, text: chap[String(n)] }));
    return verses.length ? verses : null;
  };
  // Try the bundled copy and, if it has the passage, render it. Returns true when handled,
  // so the live-fetch paths can `if (await this.useBundled(label, ref)) return;` before erroring.
  useBundled = async (label, ref) => {
    const verses = await this.bundledPassage(label); if (!verses) return false;
    this.markSeen(ref);
    const passage = this.buildPassage(ref, label, verses);
    this.setState({ loading: false, error: null, offerKjv: false, passage }, () => this.initModes(passage));
    return true;
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
  // The book list keeps the canonical plural "Psalms"; a single psalm reads "Psalm 23".
  fixBookName = (ref) => (ref || '').replace(/\bPsalms\b/g, 'Psalm');
  // Reference for the appended memory line: a verse range renders with a literal em-dash
  // ("Psalm 23:1-5" → "Psalm 23:1—5") rather than the word "to". The dash is punctuation,
  // not a word, so splitSegs leaves it out of the blanked/typed words — it's shown, never
  // hidden — while the surrounding numbers stay practiceable. (A whole chapter stays
  // "Psalm 23"; buildRef omits the verse range there.)
  refToText = (ref) => this.fixBookName(ref).replace(/(\d)\s*[–—-]\s*(\d)/, '$1—$2');
  buildRef = () => {
    const meta = this.bookMeta(this.state.book); const single = meta.chapters === 1; const ch = this.state.chapter;
    const count = this.curVerseCount();
    const s = Math.max(1, parseInt(this.state.vStart || '1', 10) || 1);
    const eRaw = (this.state.vEnd || '').trim();
    const e = eRaw ? (parseInt(eRaw, 10) || s) : (count || null);
    const whole = s <= 1 && (e === null || (count && e >= count));
    let out;
    if (whole) out = single ? meta.name : meta.name + ' ' + ch;
    else { const ee = e === null ? s : Math.max(s, e); const range = ee !== s ? s + '-' + ee : '' + s; out = single ? meta.name + ' ' + range : meta.name + ' ' + ch + ':' + range; }
    return this.fixBookName(out);
  };
  isWholeSel = () => { const count = this.curVerseCount(); const s = parseInt(this.state.vStart || '1', 10) || 1; const eRaw = (this.state.vEnd || '').trim(); return s <= 1 && (!eRaw || (count && parseInt(eRaw, 10) >= count)); };
  persistSel = () => { try { localStorage.setItem('lectio.sel', JSON.stringify({ book: this.state.book, chapter: this.state.chapter, vStart: this.state.vStart, vEnd: this.state.vEnd })); } catch (e) {} };
  // A signature of what the selector currently points at. Compared against the
  // signature stamped when the displayed passage was loaded (`loadedSig`) so the UI
  // can tell when the selection has moved on from what's on screen. Suggested is a
  // tap-to-load launcher (no manual Load), so it never counts as a pending change.
  selSig = () => {
    const st = this.state;
    if (st.corpus === 'creeds') return 'creeds|' + (st.creedId || '') + '|' + (st.creedLang || '') + '|' + (st.ldMode ? 'L' + (st.ldStart || '') : 'Q' + (st.qStart || ''));
    return 'bible|' + st.version + '|' + this.buildRef();
  };
  // True when the selector has been changed to a different passage than the one shown,
  // so the practice area can grey out and prompt to load the new selection.
  selDirty = () => !this._booting && this.state.corpus !== 'suggested' && !!this.state.passage && this.state.loadedSig != null && this.selSig() !== this.state.loadedSig;
  togglePicker = () => { const open = !this.state.pickerOpen; this.setState({ pickerOpen: open }); if (open) this.ensureVerseCount(); };
  onBook = (e) => {
    const book = e.target.value; const upd = { book, chapter: '1', vStart: '1', vEnd: '' };
    // Coverdale only carries the Psalms; choosing another book falls back to King James.
    if (this.state.version === 'Coverdale' && this.bookIndex(book) !== 19) { upd.version = 'KJV'; try { localStorage.setItem('lectio.version', 'KJV'); } catch (e2) {} }
    this.setState(upd, () => this.ensureVerseCount());
  };
  onChapter = (e) => this.setState({ chapter: e.target.value, vStart: '1', vEnd: '' }, () => this.ensureVerseCount());
  onVStart = (e) => this.setState({ vStart: e.target.value });
  onVEnd = (e) => this.setState({ vEnd: e.target.value });
  setWhole = () => { const count = this.curVerseCount(); this.setState({ vStart: '1', vEnd: count ? String(count) : '' }); };
  onRefKey = (e) => { if (e.key === 'Enter') this.doLoad(); };
  doLoad = () => {
    // Remember which corpus the displayed passage came from, so a reload restores it
    // (loadCreed stamps the signature itself).
    if (this.state.corpus === 'creeds') { this.loadCreed(); return; }
    try { localStorage.setItem('lectio.corpus', 'bible'); } catch (e) {}
    // Stamp the selection now so the just-loaded passage no longer reads as "changed".
    const ref = this.buildRef(); this.persistSel(); this.setState({ refInput: ref, pickerOpen: false, loadedSig: this.selSig() }, () => this.runLoad());
  };
  // Restore the last loaded passage on startup so the selection persists across reloads
  // (instead of always reopening on the bundled sample). Cached text restores instantly
  // and offline; otherwise we re-fetch the saved reference. First visit → the sample.
  restoreLastSelection = () => {
    let corpus = '', ref = '';
    try { corpus = localStorage.getItem('lectio.corpus') || ''; ref = localStorage.getItem('lectio.ref') || ''; } catch (e) {}
    if (corpus === 'creeds' && this.state.creedId) { this.setState({ corpus: 'creeds' }, () => { this.loadCreed(); this._booting = false; }); return; }
    if (ref && this.state.book) {
      const v = this.state.version; const label = v === 'Greek' ? (this.bookIndex(this.state.book) < 40 ? 'LXX' : 'GNT') : v; const r = this.buildRef();
      const cached = this.getCached(label, r);
      if (cached) { const p = this.buildPassage(cached.reference, label, cached.verses); this.setState({ passage: p, refInput: r, loadedSig: this.selSig(), vbv: false, fullPassage: null }, () => { this.initModes(p); this._booting = false; }); return; }
      this._booting = false; this.setState({ refInput: r, loadedSig: this.selSig() }, () => this.runLoad()); return;
    }
    this.showSample();
  };
  // The bundled offline sample (Psalm 23) — shown on a first visit, before anything has
  // been loaded. Stamps its own signature so the selector (also defaulting to Psalm 23)
  // reads as in sync.
  showSample = () => {
    const p = this.buildPassage(this.SAMPLE.reference, this.SAMPLE.version, this.SAMPLE.verses);
    this.setState({ passage: p, loadedSig: 'bible|' + this.SAMPLE.version + '|' + this.SAMPLE.reference, vbv: false, fullPassage: null }, () => this.initModes(p));
    this._booting = false;
  };
  setVersion = (v) => {
    const upd = { version: v, error: null, offerKjv: false };
    // Greek spans the whole canon now: the Septuagint (LXX) for the Old Testament and the
    // Tischendorf GNT for the New, so any book is valid — no need to bump OT picks to Matthew.
    // ESV needs a user-supplied API token. Prompt for it the moment ESV is chosen if
    // one isn't saved yet, rather than waiting for a failed load.
    if (v === 'ESV' && !this.state.esvToken.trim()) upd.esvModalOpen = true;
    // The Coverdale Psalter is Psalms-only: snap the selection to Psalms so the picker can't
    // sit on a book this version doesn't carry.
    if (v === 'Coverdale' && this.bookIndex(this.state.book) !== 19) { upd.book = 'Psalms'; upd.chapter = '1'; upd.vStart = '1'; upd.vEnd = ''; }
    this.setState(upd, () => { try { localStorage.setItem('lectio.version', v); } catch (e) {} this.persistSel(); this.ensureVerseCount(); });
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
    try { localStorage.setItem('lectio.ref', reference); localStorage.setItem('lectio.corpus', 'creeds'); } catch (e) {}
    this.setState({ corpus: 'creeds', pickerOpen: false, loading: false, error: null, offerKjv: false, refInput: reference, passage, loadedSig: this.selSig(), vbv: false, fullPassage: null }, () => this.initModes(passage));
  };

  runLoad = async () => {
    const ref = this.state.refInput.trim(); if (!ref) return;
    const version = this.state.version;
    // A fresh chapter load always leaves any verse-by-verse focus (it pertains to the
    // previous passage); clear it up front so every branch below restores the chapter view.
    this.setState({ loading: true, error: null, offerKjv: false, vbv: false, fullPassage: null });
    try {
      let verses, reference, label = version;
      if (version === 'Coverdale') {
        // The Coverdale Psalter ships fully offline (bundled, KJV-numbered) and covers
        // only the Psalms — no network call, no online fallback.
        if (this.bookIndex(this.state.book) !== 19) { this.setState({ loading: false, error: 'The Coverdale Psalter covers only the Psalms.' }); return; }
        try { localStorage.setItem('lectio.ref', ref); } catch (e) {}
        if (await this.useBundled('Coverdale', ref)) return;
        this.setState({ loading: false, error: 'Could not load that psalm from the Coverdale Psalter.' }); return;
      } else if (version === 'ESV') {
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
        // Old Testament → Septuagint (LXX); New Testament → Tischendorf GNT. Both come from
        // bolls.life under their own translation slug; `label` tracks which corpus, so the
        // localStorage cache and the bundled-offline data file resolve to the right text.
        const ot = id < 40; const slug = ot ? 'LXX' : 'TISCH'; label = ot ? 'LXX' : 'GNT';
        const ch = this.state.chapter;
        let res;
        try { res = await fetch('https://bolls.life/get-text/' + slug + '/' + id + '/' + ch + '/'); }
        catch (netErr) {
          const cached = this.getCached(label, ref);
          if (cached) { const p = this.buildPassage(cached.reference, label, cached.verses); this.setState({ loading: false, passage: p }, () => this.initModes(p)); return; }
          if (await this.useBundled(label, ref)) return;
          this.setState({ loading: false, error: 'Network error — could not reach the Greek text service.' }); return;
        }
        if (!res.ok) { if (await this.useBundled(label, ref)) return; this.setState({ loading: false, error: 'Greek text request failed (' + res.status + ').' }); return; }
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) { if (await this.useBundled(label, ref)) return; this.setState({ loading: false, error: 'No Greek text found for "' + ref + '".' }); return; }
        let vs = data.map((v) => ({ num: v.verse, text: this.stripHtml(v.text) })).filter((v) => v.text);
        const count = this.curVerseCount();
        const s = Math.max(1, parseInt(this.state.vStart || '1', 10) || 1);
        const eRaw = (this.state.vEnd || '').trim();
        const e = eRaw ? (parseInt(eRaw, 10) || s) : (count || 9999);
        const isWhole = s <= 1 && (!eRaw || (count && e >= count));
        if (!isWhole) vs = vs.filter((v) => v.num >= s && v.num <= Math.max(s, e));
        if (!vs.length) { this.setState({ loading: false, error: 'No verses in that range.' }); return; }
        reference = ref;
        this.storePassage(label, ref, reference, vs);
        verses = vs;
      } else {
        let res;
        try { res = await fetch('https://bible-api.com/' + encodeURIComponent(ref) + '?translation=kjv'); }
        catch (netErr) {
          const cached = this.getCached('KJV', ref);
          if (cached) { const p = this.buildPassage(cached.reference, 'KJV', cached.verses); this.setState({ loading: false, passage: p }, () => this.initModes(p)); return; }
          if (await this.useBundled('KJV', ref)) return;
          this.setState({ loading: false, error: 'Network error — could not reach the King James service.' }); return;
        }
        if (!res.ok) { if (await this.useBundled('KJV', ref)) return; this.setState({ loading: false, error: 'Could not find "' + ref + '" (KJV). Check the reference.' }); return; }
        const data = await res.json();
        if (!data.verses || !data.verses.length) { this.setState({ loading: false, error: 'No passage found for "' + ref + '".' }); return; }
        reference = data.reference || ref; label = 'KJV';
        verses = data.verses.map((v) => ({ num: v.verse, text: (v.text || '').replace(/\s+/g, ' ').trim() }));
        this.storePassage('KJV', ref, reference, verses);
      }
      try { localStorage.setItem('lectio.ref', ref); } catch (e) {}
      this.markSeen(reference);
      const passage = this.buildPassage(reference, label, verses);
      this.setState({ loading: false, passage }, () => this.initModes(passage));
    } catch (e) {
      this.setState({ loading: false, error: 'Something went wrong loading that passage.' });
    }
  };

  // ---------- mode navigation ----------
  // Remember the chosen practice mode so a reload resumes it (alongside the passage),
  // keeping the per-passage progress shown in context.
  persistMode = (m) => { try { localStorage.setItem('lectio.mode', m); } catch (e) {} };
  setMode = (m) => { this.runUpdateCheck(false); this.persistMode(m); this.setState({ mode: m }, () => { if (m === 'bank' && !this.allBlank()) this.ensureOptions(); }); };
  goHome = () => this.setState({ view: 'home' });
  startMode = (m) => { const p = this.state.passage; this.runUpdateCheck(false); this.persistMode(m); this.setState({ mode: m, view: 'practice' }, () => { if (p) this.initModes(p); }); };
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
  // "Restart" in Test mode clears the typed words for a fresh attempt but keeps the stored
  // per-verse mastery (it's only re-scored when a verse is actually retyped — see
  // checkTypeDone), so _typeNoSeed suppresses the one re-seed. Other modes just re-init.
  resetMode = () => { const p = this.state.passage; if (p) { if (this.state.mode === 'type') this._typeNoSeed = true; this.initModes(p); } };
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
    cur.best = Math.max(cur.best, acc); cur.lastMode = this.state.mode;
    // "Test" mode is the yardstick for how much of the passage is known: store its
    // latest score as the passage's known level (a fresh test reflects current recall).
    // Test also carries a per-verse breakdown so a partial retest only reassesses the
    // verses actually typed into — untouched verses keep their stored score.
    if (opts.known) cur.known = acc;
    if (opts.verseKnown) cur.verseKnown = opts.verseKnown;
    // A silent update is a live/partial refinement (Test mode scores as you type, so
    // partial credit on a long passage is captured even if you never fill every word).
    // It updates best/known but is NOT a fresh attempt and must not re-bump the
    // streak/heatmap — only the first scored keystroke of a test counts as practice.
    if (!opts.silent) cur.attempts++;
    prog[key] = cur;
    this.setState({ progress: prog }); try { localStorage.setItem('lectio.progress', JSON.stringify(prog)); } catch (e) {}
    if (!opts.silent) this.markPracticed();
  };
  // Map the current passage's words to their verse position + index within that verse:
  // { map: { [vi]: { v, local, n } }, refV } where v is the 0-based verse position (matching
  // buildPassage's word.v and the canon mapping), local is the word's index inside its verse,
  // n the verse's word count, and refV the appended reference-line group (which the canon map
  // ignores). Used to accumulate per-word recall into a verse's completion.
  passageVerseMap = () => {
    const p = this.state.passage; if (!p) return null;
    const groups = {}; p.words.forEach((w) => { (groups[w.v] = groups[w.v] || []).push(w.vi); });
    const map = {};
    Object.keys(groups).forEach((v) => { const arr = groups[v]; arr.forEach((vi, local) => { map[vi] = { v: Number(v), local, n: arr.length }; }); });
    return { map, refV: p.verses.length };
  };
  // Record which words were recalled from memory (correct blanks/placed words), accumulating
  // the UNION per verse so reshuffled blanks build a verse up over several passes. Stored on
  // the passage's progress entry as verseRecall { [versePos]: { n, w:[localIdx,...] } } and read
  // back by verseStatus to colour the canon map by how complete each verse is. Test mode uses
  // its own per-verse % (verseKnown); the other graded modes call this with their correct words.
  recordVerseRecall = (vis) => {
    if (!vis || !vis.length) return;
    const key = this.passageKey(); if (!key) return;
    const vm = this.passageVerseMap(); if (!vm) return;
    const prog = { ...this.state.progress }; const cur = { ...(prog[key] || { best: 0, learned: false, attempts: 0 }) };
    const vr = { ...(cur.verseRecall || {}) }; let changed = false;
    vis.forEach((vi) => {
      const m = vm.map[vi]; if (!m) return;
      const prev = vr[m.v]; const w = prev ? prev.w.slice() : [];
      if (w.indexOf(m.local) === -1) { w.push(m.local); changed = true; }
      vr[m.v] = { n: m.n, w };
    });
    if (!changed) return;
    cur.verseRecall = vr; prog[key] = cur;
    this.setState({ progress: prog }); try { localStorage.setItem('lectio.progress', JSON.stringify(prog)); } catch (e) {}
  };
  markPracticed = () => {
    const today = new Date().toISOString().slice(0, 10);
    // Snapshot the reward state BEFORE this practice so maybeCelebrate can tell what
    // milestone (if any) the practice just crossed. `firstToday` is true when today
    // had no prior practice; `advanced` when this practice extends the streak count.
    const firstToday = !((this.state.history || {})[today] > 0);
    const before = this.gamify(); before._badges = this.gamifyBadgeIds(before);
    this.bumpActivity(today);
    const s = { ...this.state.streak };
    const advanced = s.last !== today;
    if (advanced) {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      s.count = (s.last === y ? s.count : 0) + 1; s.last = today;
    }
    s.best = Math.max(s.best || 0, s.count || 0);
    // Celebrate after the streak state settles so gamify() reflects the new totals
    // (bumpActivity's history setState is batched with this one, so the callback
    // runs once both are applied).
    this.setState({ streak: s }, () => this.maybeCelebrate(before, firstToday, advanced));
    try { localStorage.setItem('lectio.streak', JSON.stringify(s)); } catch (e) {}
  };
  // Per-day practice tally for the heatmap (any practice in any mode bumps today).
  bumpActivity = (today) => {
    const h = { ...(this.state.history || {}) }; h[today] = (h[today] || 0) + 1;
    this.setState({ history: h }); try { localStorage.setItem('lectio.history', JSON.stringify(h)); } catch (e) {}
  };
  // Record that a passage's verses have been seen (loaded) — this feeds the canon
  // map's "seen" tier even for modes (like hide) that never post a score. Stored as
  // bare, version-agnostic references since the canon map is translation-independent.
  markSeen = (ref) => {
    const r = this.fixBookName(ref || '').trim(); if (!r) return;
    const seen = this.state.seen || []; if (seen.indexOf(r) !== -1) return;
    const next = seen.concat(r); this.setState({ seen: next });
    try { localStorage.setItem('lectio.seen', JSON.stringify(next)); } catch (e) {}
  };
  toggleLearned = () => {
    const key = this.passageKey(); if (!key) return;
    const prog = { ...this.state.progress }; const cur = prog[key] || { best: 0, learned: false, attempts: 0 };
    cur.learned = !cur.learned; prog[key] = cur;
    this.setState({ progress: prog }); try { localStorage.setItem('lectio.progress', JSON.stringify(prog)); } catch (e) {}
  };

  // ---------- settings ----------
  openSettings = () => this.setState({ settingsOpen: true, updateMsg: '', dataMsg: '' });
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

  // ---------- backup & restore ----------
  // Progress lives in four localStorage keys (progress / streak / history / seen).
  // Export bundles them into a single JSON file; import merges that file back in.
  // The ESV token and other device settings are deliberately left out — this is a
  // transferable record of what you've learned, not a clone of the device.
  PROGRESS_KEYS = ['progress', 'streak', 'history', 'seen'];
  exportProgress = () => {
    const payload = {
      app: 'lectio', kind: 'progress', version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        progress: this.state.progress || {},
        streak: this.state.streak || { count: 0, last: null, best: 0 },
        history: this.state.history || {},
        seen: this.state.seen || [],
      },
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'lectio-progress-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.setState({ dataMsg: 'Progress exported.' });
    } catch (e) { this.setState({ dataMsg: 'Couldn’t export on this device.' }); }
  };
  importProgress = () => {
    try {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files && input.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => this.applyImport(reader.result);
        reader.onerror = () => this.setState({ dataMsg: 'Couldn’t read that file.' });
        reader.readAsText(file);
      };
      input.click();
    } catch (e) { this.setState({ dataMsg: 'Import isn’t available here.' }); }
  };
  applyImport = (text) => {
    let obj; try { obj = JSON.parse(text); } catch (e) { this.setState({ dataMsg: 'That file isn’t valid JSON.' }); return; }
    const d = (obj && obj.data && typeof obj.data === 'object') ? obj.data : obj;
    if (!d || typeof d !== 'object' || (!d.progress && !d.history && !d.seen && !d.streak)) {
      this.setState({ dataMsg: 'That doesn’t look like a Lectio progress file.' }); return;
    }
    // Merge, never overwrite: imports combine with what's already here and never lower a
    // score — so restoring a backup or pulling in a second device both add, never erase.
    const inProg = (d.progress && typeof d.progress === 'object') ? d.progress : {};
    const progress = { ...(this.state.progress || {}) };
    let added = 0;
    for (const k in inProg) {
      const b = inProg[k]; if (!b || typeof b !== 'object') continue;
      const a = progress[k];
      if (!a) added++;
      progress[k] = this.mergeProgressEntry(a || {}, b);
    }
    // History (per-day heatmap counts): take the larger count for any shared day so a
    // re-import of the same backup doesn't double-count.
    const history = { ...(this.state.history || {}) };
    const inHist = (d.history && typeof d.history === 'object') ? d.history : {};
    for (const day in inHist) history[day] = Math.max(history[day] || 0, Number(inHist[day]) || 0);
    // Seen references: union.
    const seenSet = {}; (this.state.seen || []).forEach((r) => { seenSet[r] = 1; });
    if (Array.isArray(d.seen)) d.seen.forEach((r) => { if (r) seenSet[r] = 1; });
    const seen = Object.keys(seenSet);
    // Streak: keep the longer best; adopt the more recent last-practiced day + its count.
    const a = this.state.streak || { count: 0, last: null, best: 0 };
    const b = (d.streak && typeof d.streak === 'object') ? d.streak : {};
    const streak = (b.last && (!a.last || b.last > a.last)) ? { ...b } : { ...a };
    streak.best = Math.max(a.best || 0, b.best || 0, streak.count || 0);
    this.setState({ progress, history, seen, streak });
    try {
      localStorage.setItem('lectio.progress', JSON.stringify(progress));
      localStorage.setItem('lectio.history', JSON.stringify(history));
      localStorage.setItem('lectio.seen', JSON.stringify(seen));
      localStorage.setItem('lectio.streak', JSON.stringify(streak));
    } catch (e) {}
    const total = Object.keys(inProg).length;
    this.setState({ dataMsg: 'Imported ' + total + (total === 1 ? ' passage' : ' passages') + (added ? ' (' + added + ' new).' : '.') });
  };
  mergeProgressEntry = (a, b) => {
    const e = { ...a };
    e.best = Math.max(a.best || 0, b.best || 0);
    if (a.known != null || b.known != null) e.known = Math.max(a.known || 0, b.known || 0);
    e.learned = !!(a.learned || b.learned);
    e.attempts = Math.max(a.attempts || 0, b.attempts || 0);
    if ((a.verseKnown && typeof a.verseKnown === 'object') || (b.verseKnown && typeof b.verseKnown === 'object')) {
      const vk = { ...(a.verseKnown || {}) }; const bv = b.verseKnown || {};
      for (const k in bv) vk[k] = Math.max(vk[k] || 0, Number(bv[k]) || 0);
      e.verseKnown = vk;
    }
    // Per-word recall accumulates as a union per verse, so merging two devices keeps every
    // word either side recalled (and the larger verse word-count if they ever disagree).
    if ((a.verseRecall && typeof a.verseRecall === 'object') || (b.verseRecall && typeof b.verseRecall === 'object')) {
      const av = a.verseRecall || {}, bvr = b.verseRecall || {}; const vr = {};
      Object.keys(av).concat(Object.keys(bvr)).forEach((k) => {
        if (vr[k]) return; const ae = av[k] || {}, be = bvr[k] || {};
        const w = Array.from(new Set([...(ae.w || []), ...(be.w || [])]));
        vr[k] = { n: Math.max(ae.n || 0, be.n || 0) || w.length, w };
      });
      e.verseRecall = vr;
    }
    return e;
  };

  // ---------- style helpers ----------
  seg = (active) => ({ padding: '7px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, background: active ? 'var(--accent)' : 'transparent', color: active ? '#fbf8f1' : 'var(--muted)' });
  tab = (active) => ({ padding: '9px 15px', borderRadius: '10px', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--line)'), cursor: 'pointer', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', background: active ? 'var(--accent-soft)' : 'var(--surface)', color: active ? 'var(--accent)' : 'var(--text)' });
  toggleBtn = (active) => ({ padding: '9px 14px', borderRadius: '10px', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--line)'), background: active ? 'var(--accent-soft)' : 'var(--surface)', color: active ? 'var(--accent)' : 'var(--muted)', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' });
  // Practice-mode selector: a full-width 3-way segmented control (modeSeg) for the
  // no-typing modes, plus a distinct, full-width "Test" button (testTab) for the graded
  // mode. modeSeg flexes so the three segments share the row evenly on phone or desktop.
  modeSeg = (active) => ({ flex: 1, minWidth: 0, padding: '9px 8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: 'clamp(12px,3.1vw,14px)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fbf8f1' : 'var(--muted)', touchAction: 'manipulation' });
  testTab = (active) => ({ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--test)', cursor: 'pointer', fontSize: '15px', fontWeight: 700, letterSpacing: '.3px', whiteSpace: 'nowrap', background: active ? 'var(--test)' : 'var(--test-soft)', color: active ? '#fbf8f1' : 'var(--test)', touchAction: 'manipulation' });
