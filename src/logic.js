class Component extends DCLogic {
  state = {
    theme: 'system', resolvedTheme: 'light',
    version: 'ESV',
    view: 'home',
    pickerOpen: false,
    book: 'Psalms', chapter: '23', vStart: '1', vEnd: '',
    refInput: 'Psalms 23', verseCounts: {},
    loading: false, error: null, offerKjv: false,
    passage: null, mode: 'hide',
    settingsOpen: false, copyrightOpen: false,
    esvToken: '', reminderOn: false,
    showHints: true, showVerseNums: true, scriptureSize: 'Comfortable',
    blankPct: 0.25, blankList: [],
    hideAll: false, revealed: {}, revealAllNow: false,
    hiddenVals: {},
    bank: null, bankFill: {},
    typeIdx: 0, typeInput: '', typeErrors: 0,
    progress: {}, streak: { count: 0, last: null },
    cacheCount: 0, usageToday: 0,
    updateReady: false,
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

  componentDidMount() {
    const g = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
    const gj = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
    const theme = g('lectio.theme', 'system');
    const sel = gj('lectio.sel', null);
    const next = {
      theme,
      version: g('lectio.version', this.props.defaultVersion || 'ESV'),
      esvToken: g('lectio.esvToken', ''),
      reminderOn: g('lectio.reminder', '0') === '1',
      showHints: this.props.hintsDefault ?? true,
      showVerseNums: this.props.showVerseNumbers ?? true,
      scriptureSize: this.props.scriptureSize || 'Comfortable',
      mode: this.props.defaultMode || 'hide',
      progress: gj('lectio.progress', {}),
      streak: gj('lectio.streak', { count: 0, last: null }),
      cacheCount: this.cachedVerseCount(),
      usageToday: this.usage().count,
    };
    if (sel && sel.book) { next.book = sel.book; next.chapter = sel.chapter; next.vStart = sel.vStart || '1'; next.vEnd = sel.vEnd || ''; }
    next.verseCounts = gj('lectio.vc', {});
    this.setState(next, () => { this.applyTheme(theme); this.ensureVerseCount(); });

    const p = this.buildPassage(this.SAMPLE.reference, this.SAMPLE.version, this.SAMPLE.verses);
    this.setState({ passage: p }, () => this.initModes(p));

    this._mm = matchMedia('(prefers-color-scheme:dark)');
    this._onMM = () => { if (this.state.theme === 'system') this.applyTheme('system'); };
    this._mm.addEventListener('change', this._onMM);

    this.registerServiceWorker();
    this.maybeRemind();
  }
  componentWillUnmount() {
    if (this._mm) this._mm.removeEventListener('change', this._onMM);
    if (this._onVisible) document.removeEventListener('visibilitychange', this._onVisible);
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

  // ---------- text utils ----------
  norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u03c2/g, '\u03c3').replace(/[\u2018\u2019]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
  stripHtml = (s) => (s || '').replace(/<S>.*?<\/S>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  bookIndex = (name) => this.BOOKS.findIndex((b) => b.name === name) + 1;
  splitSegs = (text) => {
    text = (text || '').normalize('NFC');
    const out = []; const re = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['\u2019\-][\p{L}\p{N}\p{M}]*)*/gu; let last = 0, m;
    while ((m = re.exec(text))) { if (m.index > last) out.push({ w: false, text: text.slice(last, m.index) }); out.push({ w: true, text: m[0] }); last = m.index + m[0].length; }
    if (last < text.length) out.push({ w: false, text: text.slice(last) });
    return out;
  };
  buildPassage = (reference, version, verses) => {
    let vi = 0; const words = [];
    const vs = verses.map((v) => {
      const segs = this.splitSegs((v.text || '').replace(/\s+/g, ' ').trim());
      segs.forEach((s) => { if (s.w) { s.vi = vi; words.push({ vi, text: s.text }); vi++; } });
      return { num: v.num, segs };
    });
    return { reference, version, verses: vs, words };
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
    this.setState({ blankList: blanks, bank, hiddenVals: {}, bankFill: {}, hideAll: false, revealed: {}, revealAllNow: false, typeIdx: 0, typeInput: '', typeErrors: 0 });
  };

  // ---------- caching (ESV <= 500 verses) ----------
  cache = () => { try { return JSON.parse(localStorage.getItem('lectio.cache') || '{}'); } catch (e) { return {}; } };
  cachedVerseCount = () => Object.values(this.cache()).reduce((n, e) => n + (e.verses ? e.verses.length : 0), 0);
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
  doLoad = () => { const ref = this.buildRef(); this.persistSel(); this.setState({ refInput: ref, pickerOpen: false }, () => this.runLoad()); };
  setVersion = (v) => {
    const upd = { version: v, error: null, offerKjv: false };
    if (v === 'Greek' && this.bookIndex(this.state.book) < 40) { upd.book = 'Matthew'; upd.chapter = '1'; upd.vStart = '1'; upd.vEnd = ''; }
    this.setState(upd, () => { try { localStorage.setItem('lectio.version', v); } catch (e) {} this.ensureVerseCount(); });
  };
  switchToKjv = () => { this.setState({ version: 'KJV', error: null, offerKjv: false }, () => { try { localStorage.setItem('lectio.version', 'KJV'); } catch (e) {} this.runLoad(); }); };

  runLoad = async () => {
    const ref = this.state.refInput.trim(); if (!ref) return;
    const version = this.state.version;
    this.setState({ loading: true, error: null, offerKjv: false });
    try {
      let verses, reference, label = version;
      if (version === 'ESV') {
        const token = this.state.esvToken.trim();
        if (!token) { this.setState({ loading: false, error: 'Add your ESV API token in Settings to use the ESV — or switch to King James.', offerKjv: true }); return; }
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

  // ---------- modes ----------
  setMode = (m) => this.setState({ mode: m });
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
    return parts.join('  \u00b7  ');
  };
  resetMode = () => { const p = this.state.passage; if (p) this.initModes(p); };
  toggleHints = () => this.setState({ showHints: !this.state.showHints });
  toggleHideAll = () => this.setState({ hideAll: !this.state.hideAll, revealed: {} });
  revealWord = (vi) => this.setState({ revealed: { ...this.state.revealed, [vi]: true } });
  revealAll = () => { this.setState({ revealAllNow: true, hideAll: false, revealed: {} }); this.markPracticed(); };
  focusNextBlank = (vi) => {
    const blanks = this.state.blankList || []; const i = blanks.indexOf(vi);
    for (let j = i + 1; j < blanks.length; j++) { const el = document.querySelector('[data-blank="' + blanks[j] + '"]'); if (el) { el.focus(); if (el.select) el.select(); return; } }
  };

  onBlankPct = (e) => {
    const pct = parseFloat(e.target.value); const p = this.state.passage; if (!p) { this.setState({ blankPct: pct }); return; }
    const seed = this.hash(p.reference + '|' + p.words.length);
    const blanks = this.pickBlanks(p.words, pct, seed); const bank = this.buildBank(p, blanks, seed);
    this.setState({ blankPct: pct, blankList: blanks, bank, hiddenVals: {}, bankFill: {} });
  };
  onBlankChange = (vi, val) => {
    const p = this.state.passage; const cur = p ? p.words[vi].text : '';
    const advance = /\s$/.test(val);
    const raw = val.replace(/\s+$/, '');
    const stored = cur && this.norm(raw) === this.norm(cur) ? cur : raw;
    this.setState({ hiddenVals: { ...this.state.hiddenVals, [vi]: stored } }, () => { if (advance) this.focusNextBlank(vi); this.checkHiddenDone(); });
  };
  checkHiddenDone = () => {
    const blanks = this.state.blankList; const p = this.state.passage; if (!p) return;
    if (!blanks.every((vi) => (this.state.hiddenVals[vi] || '').trim().length > 0)) return;
    const correct = blanks.filter((vi) => this.norm(this.state.hiddenVals[vi]) === this.norm(p.words[vi].text)).length;
    this.recordResult(correct / blanks.length);
  };

  placeBank = (id) => {
    const blanks = this.state.blankList; const fill = { ...this.state.bankFill };
    const slot = blanks.find((vi) => fill[vi] == null); if (slot == null) return;
    fill[slot] = id; this.setState({ bankFill: fill }, () => this.checkBankDone());
  };
  unplace = (vi) => { const fill = { ...this.state.bankFill }; delete fill[vi]; this.setState({ bankFill: fill }); };
  checkBankDone = () => {
    const blanks = this.state.blankList; const p = this.state.passage; if (!p || !this.state.bank) return;
    if (!blanks.every((vi) => this.state.bankFill[vi] != null)) return;
    const correct = blanks.filter((vi) => this.norm(this.state.bank.items[this.state.bankFill[vi]].text) === this.norm(p.words[vi].text)).length;
    this.recordResult(correct / blanks.length);
  };

  currentWord = () => { const p = this.state.passage; return p && this.state.typeIdx < p.words.length ? p.words[this.state.typeIdx].text : null; };
  onTypeChange = (e) => {
    const val = e.target.value; const cur = this.currentWord();
    if (!cur) { this.setState({ typeInput: '' }); return; }
    if (/\s$/.test(val)) { this.commitType(val.trim()); return; }
    if (this.norm(val) === this.norm(cur) && this.norm(val).length >= this.norm(cur).length) { this.commitType(val); return; }
    this.setState({ typeInput: val });
  };
  onTypeKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); this.commitType(this.state.typeInput.trim()); } };
  commitType = (val) => {
    const cur = this.currentWord(); if (cur == null) return;
    if (this.norm(val) === this.norm(cur)) {
      const ni = this.state.typeIdx + 1;
      this.setState({ typeIdx: ni, typeInput: '' }, () => { if (ni >= this.state.passage.words.length) this.finishType(); });
    } else { this.setState({ typeErrors: this.state.typeErrors + 1, typeInput: '' }); }
  };
  finishType = () => { const total = this.state.passage.words.length; this.recordResult(total / (total + this.state.typeErrors)); };

  // ---------- progress / streak ----------
  passageKey = () => { const p = this.state.passage; return p ? p.version + ' · ' + p.reference : ''; };
  recordResult = (acc) => {
    const key = this.passageKey(); if (!key) return;
    const prog = { ...this.state.progress }; const cur = prog[key] || { best: 0, learned: false, attempts: 0 };
    cur.best = Math.max(cur.best, acc); cur.attempts++; cur.lastMode = this.state.mode; prog[key] = cur;
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

  // ---------- practice render ----------
  sizeMap = { Compact: { fs: 'clamp(17px,2vw,22px)', lh: 1.85 }, Comfortable: { fs: 'clamp(19px,2.4vw,27px)', lh: 1.95 }, Large: { fs: 'clamp(22px,3vw,33px)', lh: 2.0 } };
  renderWord = (s, key) => {
    const h = React.createElement; if (!s.w) return h('span', { key }, s.text);
    const vi = s.vi, text = s.text, mode = this.state.mode;
    if (this.state.revealAllNow) return h('span', { key, style: { color: 'var(--accent)' } }, text);
    if (mode === 'hide') {
      if (!this.state.hideAll) return h('span', { key }, text);
      if (this.state.revealed[vi]) return h('span', { key, style: { color: 'var(--accent)' } }, text);
      return h('span', { key, onClick: () => this.revealWord(vi), title: 'tap to peek', style: { cursor: 'pointer', background: 'var(--accent-soft)', color: 'transparent', borderRadius: '4px', padding: '0 2px', boxShadow: 'inset 0 -1px 0 var(--line)' } }, text);
    }
    if (mode === 'hidden') {
      if (!this._blankSet.has(vi)) return h('span', { key }, text);
      const val = this.state.hiddenVals[vi] || ''; const ok = this.norm(val) === this.norm(text); const filled = val.length > 0;
      const col = !filled ? 'var(--muted)' : ok ? 'var(--good)' : 'var(--bad)';
      return h('input', { key, 'data-blank': vi, value: val, onChange: (e) => this.onBlankChange(vi, e.target.value), placeholder: this.state.showHints ? text[0] : '', spellCheck: false, autoCapitalize: 'off', autoComplete: 'off', style: { font: 'inherit', fontFamily: "'Gentium Book Plus',serif", width: (text.length * 0.62 + 1.4) + 'em', textAlign: 'center', border: 'none', borderBottom: '2px solid ' + col, background: 'transparent', color: filled ? (ok ? 'var(--good)' : 'var(--bad)') : 'var(--text)', outline: 'none', padding: '0 2px', margin: '0 1px' } });
    }
    if (mode === 'bank') {
      if (!this._blankSet.has(vi)) return h('span', { key }, text);
      const pid = this.state.bankFill[vi];
      if (pid == null) return h('span', { key, style: { display: 'inline-block', minWidth: (text.length * 0.6 + 0.8) + 'em', borderBottom: '2px dashed var(--muted)', color: 'transparent' } }, '\u00a0');
      const it = this.state.bank.items[pid]; const ok = this.norm(it.text) === this.norm(text);
      return h('span', { key, onClick: () => this.unplace(vi), title: 'tap to remove', style: { cursor: 'pointer', color: ok ? 'var(--good)' : 'var(--bad)', borderBottom: '2px solid ' + (ok ? 'var(--good)' : 'var(--bad)'), padding: '0 2px' } }, it.text);
    }
    if (mode === 'type') {
      const ti = this.state.typeIdx;
      if (vi < ti) return h('span', { key, style: { color: 'var(--accent)' } }, text);
      if (vi === ti) return h('span', { key, style: { display: 'inline-block', minWidth: (text.length * 0.6 + 0.6) + 'em', background: 'var(--accent-soft)', borderRadius: '4px', boxShadow: 'inset 0 -2px 0 var(--accent)', color: this.state.showHints ? 'var(--muted)' : 'transparent', textAlign: 'center' } }, this.state.showHints ? text[0] : '\u00a0');
      return h('span', { key, style: { display: 'inline-block', minWidth: (text.length * 0.6 + 0.6) + 'em', borderBottom: '1px dotted var(--muted)', color: 'transparent' } }, '\u00a0');
    }
    return h('span', { key }, text);
  };
  renderPractice = () => {
    const h = React.createElement; const p = this.state.passage;
    if (!p) return h('div', { style: { color: 'var(--muted)' } }, 'Choose a passage to begin.');
    const sz = this.sizeMap[this.state.scriptureSize] || this.sizeMap.Comfortable;
    const out = [];
    p.verses.forEach((v, vi) => {
      if (vi > 0) out.push(h('span', { key: 'sp' + vi }, ' '));
      if (this.state.showVerseNums && v.num != null) out.push(h('sup', { key: 'vn' + vi, style: { fontSize: '0.6em', color: 'var(--muted)', fontWeight: 700, marginRight: '3px', fontFamily: "'Noto Sans',sans-serif" } }, v.num));
      v.segs.forEach((s, si) => out.push(this.renderWord(s, vi + '_' + si)));
    });
    return h('div', { style: { fontFamily: "'Gentium Book Plus','Georgia',serif", fontSize: sz.fs, lineHeight: sz.lh, color: 'var(--text)', letterSpacing: '.1px' } }, out);
  };

  renderVals() {
    const st = this.state; const p = st.passage;
    this._blankSet = new Set(st.blankList || []);
    const meta = this.bookMeta(st.book); const single = meta.chapters === 1;
    const count = this.curVerseCount(); const whole = this.isWholeSel();

    const ghostBtn = { padding: '9px 15px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' };
    const primaryBtn = { padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fbf8f1', fontSize: '14px', fontWeight: 600, cursor: 'pointer' };
    const selectStyle = { padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--surface)', color: 'var(--text)', fontSize: '15px', outline: 'none', flex: 1, minWidth: '150px' };

    // mode-specific fill status
    let fillStatus = '';
    if (p && (st.mode === 'hidden' || st.mode === 'bank')) {
      const total = st.blankList.length;
      const filled = st.mode === 'hidden'
        ? st.blankList.filter((vi) => (st.hiddenVals[vi] || '').trim().length > 0).length
        : st.blankList.filter((vi) => st.bankFill[vi] != null).length;
      if (filled < total) fillStatus = filled + ' / ' + total + ' filled';
      else {
        const correct = st.mode === 'hidden'
          ? st.blankList.filter((vi) => this.norm(st.hiddenVals[vi]) === this.norm(p.words[vi].text)).length
          : st.blankList.filter((vi) => st.bank && this.norm(st.bank.items[st.bankFill[vi]].text) === this.norm(p.words[vi].text)).length;
        fillStatus = correct + ' / ' + total + ' correct';
      }
    }

    // bank tray (unused items)
    let bankItems = [];
    if (p && st.mode === 'bank' && st.bank) {
      const used = new Set(Object.values(st.bankFill).filter((x) => x != null));
      bankItems = st.bank.order.filter((id) => !used.has(id)).map((id) => ({ text: st.bank.items[id].text, onClick: () => this.placeBank(id) }));
    }

    // type progress / hint
    const cur = this.currentWord();
    const typeHint = !p ? '' : cur ? (st.showHints ? 'starts with \u201c' + cur[0] + '\u201d' : 'type the next word') : 'Finished \u2014 well done.';
    const typeProgress = p ? (Math.min(st.typeIdx, p.words.length) + ' / ' + p.words.length + ' words' + (st.typeErrors ? ' \u00b7 ' + st.typeErrors + ' slips' : '')) : '';

    // streak / best / learned
    const today = new Date().toISOString().slice(0, 10);
    const practicedToday = st.streak.last === today;
    const key = this.passageKey(); const prg = st.progress[key] || { best: 0, learned: false, attempts: 0 };
    const bestLabel = prg.attempts ? 'Best ' + Math.round(prg.best * 100) + '%' + (prg.attempts ? ' \u00b7 ' + prg.attempts + ' tries' : '') : 'Not practiced yet';

    const modeHints = { hide: 'Recite from memory; peek when stuck.', hidden: 'Fill in the missing words.', bank: 'Rebuild it from the word bank.', type: 'Type it one word at a time.' };

    return {
      // chrome
      chromeBtn: { padding: '6px 11px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
      themeLabel: st.theme.charAt(0).toUpperCase() + st.theme.slice(1),
      cycleTheme: this.cycleTheme, openSettings: this.openSettings,
      ghostBtn, primaryBtn,

      // views
      isHome: st.view === 'home', isPractice: st.view === 'practice', goHome: this.goHome,
      startHide: this.startHide, startFill: this.startFill, startBank: this.startBank, startType: this.startType,
      currentModeName: ({ hide: 'Hide & reveal', hidden: 'Fill blanks', bank: 'Word bank', type: 'Type it' })[st.mode],
      homeSummary: this.homeSummary(),

      // picker
      pickerOpen: st.pickerOpen, togglePicker: this.togglePicker,
      pickerChevron: st.pickerOpen ? '\u25be' : '\u25b8',
      versions: ['ESV', 'KJV', 'Greek'].map((v) => ({ label: v, onClick: () => this.setVersion(v), style: this.seg(v === st.version) })),
      books: st.version === 'Greek' ? this.BOOKS.filter((b, i) => i >= 39) : this.BOOKS, book: st.book, onBook: this.onBook, selectStyle,
      chapterSelectStyle: { ...selectStyle, flex: 'none', minWidth: '92px' },
      showChapter: !single,
      chapter: st.chapter, onChapter: this.onChapter,
      chapterList: Array.from({ length: meta.chapters }, (_, i) => String(i + 1)),
      versesKnown: count != null, versesUnknown: count == null,
      verseOptions: count != null ? Array.from({ length: count }, (_, i) => String(i + 1)) : [],
      vStart: st.vStart, vEndValue: st.vEnd || (count != null ? String(count) : ''),
      onVStart: this.onVStart, onVEnd: this.onVEnd, onRefKey: this.onRefKey,
      verseSelectStyle: { padding: '8px 9px', border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)', fontSize: '14px', outline: 'none' },
      setWhole: this.setWhole, wholeBtn: this.toggleBtn(whole), wholeLabel: single ? 'Whole book' : 'Whole chapter',
      load: this.doLoad, loadBtn: primaryBtn, loadLabel: st.loading ? 'Loading\u2026' : 'Load passage',

      // errors
      hasError: !!st.error, error: st.error, offerKjv: st.offerKjv, switchToKjv: this.switchToKjv,

      // tabs
      modeTabs: [['hide', 'Hide & reveal'], ['hidden', 'Fill blanks'], ['bank', 'Word bank'], ['type', 'Type it']].map(([id, label]) => ({ label, onClick: () => this.setMode(id), style: this.tab(id === st.mode) })),

      // passage
      hasPassage: !!p, reference: p ? p.reference : this.buildRef(), versionLabel: p ? p.version : st.version,
      modeHint: modeHints[st.mode] || '',
      practice: this.renderPractice(),

      // mode toolbars
      isHide: st.mode === 'hide', toggleHideAll: this.toggleHideAll, hideToggleLabel: st.hideAll ? 'Show passage' : 'Hide passage', revealAll: this.revealAll,
      isHidden: st.mode === 'hidden', blankPct: st.blankPct, onBlankPct: this.onBlankPct,
      isBank: st.mode === 'bank', bankItems, bankEmpty: bankItems.length === 0,
      bankBtn: { padding: '7px 13px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontFamily: "'Gentium Book Plus',serif", fontSize: '17px', cursor: 'pointer' },
      isType: st.mode === 'type', typeInput: st.typeInput, onTypeChange: this.onTypeChange, onTypeKey: this.onTypeKey, typeHint, typeProgress,
      toggleHints: this.toggleHints, hintsBtn: this.toggleBtn(st.showHints), hintsLabel: st.showHints ? 'Hints on' : 'Hints off',
      resetMode: this.resetMode, fillStatus,

      // status
      streakDot: practicedToday ? 'var(--accent)' : 'var(--line)',
      streakLabel: (st.streak.count || 0) + (st.streak.count === 1 ? '-day streak' : '-day streak'),
      bestLabel,
      toggleLearned: this.toggleLearned, learnedBtn: this.toggleBtn(prg.learned), learnedLabel: prg.learned ? '\u2713 Learned' : 'Mark as learned',

      // attribution
      isEsv: !!p && p.version === 'ESV', isKjv: !!p && p.version === 'KJV', isTr: !!p && p.version === 'GNT', openCopyright: this.openCopyright,

      // settings
      settingsOpen: st.settingsOpen, closeSettings: this.closeSettings, stop: this.stop,
      esvToken: st.esvToken, onTokenChange: this.onTokenChange, tokenState: st.esvToken ? 'Token saved.' : 'No token yet.',
      themeOpts: ['system', 'light', 'dark'].map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), onClick: () => this.setTheme(t), style: this.seg(t === st.theme) })),
      toggleReminder: this.toggleReminder, reminderBtn: this.toggleBtn(st.reminderOn), reminderLabel: st.reminderOn ? 'On' : 'Off',
      cacheStatus: st.cacheCount + (st.cacheCount === 1 ? ' verse cached.' : ' verses cached.'),
      clearCache: this.clearCache,
      usageVisible: st.usageToday > 0, usageToday: st.usageToday.toLocaleString(),

      copyrightOpen: st.copyrightOpen, closeCopyright: this.closeCopyright,

      // app update prompt
      updateReady: st.updateReady, applyUpdate: this.applyUpdate, dismissUpdate: this.dismissUpdate,
    };
  }
}
