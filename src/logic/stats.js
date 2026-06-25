  // ============================================================================
  // stats.js — progress dashboard + suggested passages (class-body fragment; see
  // core.js). Three things live here:
  //   1. A versification table (verses per chapter for all 66 books) + helpers to
  //      turn the user's progress into a per-verse 0/1/2 status across the canon.
  //   2. A calm "Your progress" view: summary tiles, a GitHub-style practice
  //      heatmap, and the canon-completion bar (every verse equal width, binned
  //      and averaged when space is tight; grey -> light blue -> dark blue).
  //   3. A curated "Suggested passages" picker (popular passages, Roman's Road,
  //      and the Navigators' Topical Memory System) for when you're not sure what
  //      to memorize.
  // This file is a CLASS-BODY FRAGMENT — see core.js. build.mjs concatenates it.
  // ============================================================================

  // Per-chapter verse counts for all 66 books (KJV / Protestant versification,
  // public domain). One book per ';' group; chapters are comma-separated counts,
  // index-aligned with BOOKS. Totals: 1189 chapters / 31,102 verses
  // (OT 23,145 · NT 7,957). Stored as a string and parsed once (see versify()).
  VERSIFY_RAW = '31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26;22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38;17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34;54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13;46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12;18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33;36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25;22,23,18,22;28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13;27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25;53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53;18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30;54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30;17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23;11,70,13,24,17,22,28,36,15,44;11,20,32,23,19,19,73,18,38,39,36,47,31;22,23,15,17,14,14,10,17,32,3;22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17;6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6;33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31;18,26,22,16,20,12,29,17,18,20,10,14;17,17,11,16,16,13,13,14;31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24;19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34;22,22,66,22,22;28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35;21,49,30,37,31,28,28,27,27,21,45,13;11,23,5,19,15,11,16,14,17,15,12,14,16,9;20,32,21;15,16,15,13,27,14,17,14,15;21;17,10,10,11;16,13,12,13,15,16,20;15,13,19;17,20,19;18,15,20;15,23;21,13,10,14,11,15,14,23,17,12,17,14,9,21;14,17,18,6;25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20;45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20;80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53;51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25;26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31;32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27;31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24;24,17,18,18,21,18,16,24,15,18,33,21,14;24,21,29,31,26,18;23,22,21,32,33,24;30,30,21,23;29,23,25,18;10,20,13,18,28;12,17,18;20,15,16,16,25,21;18,26,17,22;16,15,15;25;14,18,19,16,14,20,28,13,28,39,40,29,25;27,26,18,17,20;25,25,22,19,14;21,22,18;10,29,24,21,21;13;14;25;20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21';

  // Parse the versification string into arrays once: V[bookIndex][chapterIndex] = verses.
  versify = () => this._versify || (this._versify = this.VERSIFY_RAW.split(';').map((b) => b.split(',').map(Number)));
  // Flat canon geometry, derived once: the running start offset of every chapter
  // (off[book][chapter]), the total verse count, and the OT/NT split index.
  canonGeom = () => {
    if (this._geom) return this._geom;
    const V = this.versify(); const off = []; let total = 0, otEnd = 0;
    V.forEach((book, bi) => { const bo = []; book.forEach((n, ci) => { bo[ci] = total; total += n; }); off[bi] = bo; if (bi === 38) otEnd = total; });
    return (this._geom = { off, total, otEnd });
  };

  // A passage counts as "completed" (dark blue) once it's marked learned or scored
  // at/above this on Test or any graded mode; otherwise practising it marks it "seen".
  MASTERY = 0.9;
  // Normalized book-name -> 0-based index, including the "Psalm"/"Psalms" alias the
  // stored references use (fixBookName renders a single psalm as "Psalm 23").
  bookLookup = () => {
    if (this._blook) return this._blook;
    const m = {}; this.BOOKS.forEach((b, i) => { m[b.name.toLowerCase()] = i; }); m['psalm'] = m['psalms'];
    return (this._blook = m);
  };
  // Parse a reference ("Matthew 5:1-12", "Psalm 23", "Jude 3-5") into a canonical
  // shape: { bi (0-based book), ch (1-based, null = whole book), chEnd, vs, ve
  // (1-based, null = whole chapter) }. Returns null for anything non-Scripture
  // (creed/catechism keys never match a book name).
  parseRef = (ref) => {
    if (!ref) return null;
    const s = ref.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    const low = s.toLowerCase(); const look = this.bookLookup();
    let bi = -1, nameLen = 0;
    for (const name in look) { if (low.startsWith(name) && (low.length === name.length || low[name.length] === ' ') && name.length > nameLen) { nameLen = name.length; bi = look[name]; } }
    if (bi < 0) return null;
    const rest = s.slice(nameLen).trim();
    const nums = (str) => { const m = str.match(/\d+/g); return m ? m.map(Number) : []; };
    if (this.BOOKS[bi].chapters === 1) { const n = nums(rest); return { bi, ch: 1, vs: n.length ? n[0] : null, ve: n.length ? n[n.length - 1] : null }; }
    if (!rest) return { bi, ch: null, vs: null, ve: null };
    const colon = rest.indexOf(':');
    if (colon < 0) { const n = nums(rest); return n.length ? { bi, ch: n[0], chEnd: n[n.length - 1], vs: null, ve: null } : { bi, ch: null, vs: null, ve: null }; }
    const ch = parseInt(rest.slice(0, colon), 10) || 1; const n = nums(rest.slice(colon + 1));
    return { bi, ch, vs: n.length ? n[0] : 1, ve: n.length ? n[n.length - 1] : 1 };
  };

  // Build a per-verse status array over the whole canon: 0 unseen, 1 seen, 2
  // completed. Sources: the "seen on load" list (>=1) and every progress entry
  // (practised -> >=1, learned / high score -> 2). Also returns prefix sums so the
  // bar can average any range in O(1), plus the seen/completed verse totals.
  verseStatus = () => {
    const { off, total, otEnd } = this.canonGeom(); const V = this.versify();
    const status = new Uint8Array(total);
    const setRange = (bi, ci, a, b, val) => { const base = off[bi][ci]; for (let v = a; v <= b; v++) { const i = base + (v - 1); if (i >= 0 && i < total && status[i] < val) status[i] = val; } };
    const mark = (ref, val) => {
      const p = this.parseRef(ref); if (!p) return;
      if (p.ch == null) { V[p.bi].forEach((n, ci) => setRange(p.bi, ci, 1, n, val)); }
      else if (p.vs == null) { for (let c = p.ch; c <= (p.chEnd || p.ch); c++) { const n = V[p.bi][c - 1]; if (n) setRange(p.bi, c - 1, 1, n, val); } }
      else { const n = V[p.bi][p.ch - 1] || p.ve; setRange(p.bi, p.ch - 1, Math.max(1, p.vs), Math.min(n, p.ve || p.vs), val); }
    };
    (this.state.seen || []).forEach((r) => mark(r, 1));
    const prog = this.state.progress || {};
    Object.keys(prog).forEach((key) => {
      const p = prog[key]; const ref = key.replace(/^[^·]*·\s*/, '');
      if (p.learned || (p.best || 0) >= this.MASTERY || (p.known || 0) >= this.MASTERY) mark(ref, 2);
      else if ((p.attempts || 0) > 0) mark(ref, 1);
    });
    const pre = new Float64Array(total + 1); let seenN = 0, doneN = 0;
    for (let i = 0; i < total; i++) { pre[i + 1] = pre[i] + status[i]; if (status[i] >= 1) seenN++; if (status[i] === 2) doneN++; }
    return { status, pre, total, otEnd, seenN, doneN };
  };

  // ---------- colour ramp (unseen -> seen -> completed) ----------
  // JS values (not CSS vars) so we can interpolate the binned averages. Tuned per
  // theme: a calm grey rising through light blue to a deep blue (brighter on dark).
  canonStops = () => this.state.resolvedTheme === 'dark'
    ? { a: [52, 48, 42], b: [63, 109, 151], c: [124, 184, 242] }
    : { a: [228, 222, 208], b: [154, 195, 232], c: [47, 111, 176] };
  mix = (x, y, t) => 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  // Map an averaged status in [0,2] onto the ramp (0 grey, 1 light blue, 2 deep blue).
  canonColor = (avg) => { const s = this.canonStops(); return avg <= 1 ? this.mix(s.a, s.b, avg) : this.mix(s.b, s.c, avg - 1); };
  // Heatmap level: grey at 0, then four blue steps from light to deep by busy-ness.
  heatColor = (c) => { const s = this.canonStops(); if (c <= 0) return this.mix(s.a, s.a, 0); const t = c <= 1 ? 0.32 : c <= 3 ? 0.55 : c <= 5 ? 0.78 : 1; return this.mix(s.a, s.c, t); };

  // ---------- canon bar ----------
  // Render one bar over a flat verse range [a,b). Every verse is an equal slice;
  // when there isn't a pixel to spare per verse, adjacent verses bin together and
  // the bin shows the average of their 0/1/2 status. The bins are flex children, so
  // they always fill the width — the pixel estimate only sets the resolution.
  canonBins = () => { const w = Math.min((typeof window !== 'undefined' && window.innerWidth) || 380, 820) - 56; return Math.max(24, Math.floor(w / 2)); };
  renderBar = (data, a, b, key, height) => {
    const h = React.createElement; const len = b - a; const bins = Math.max(1, Math.min(len, this.canonBins())); const cells = [];
    for (let i = 0; i < bins; i++) { const s = a + Math.floor(i * len / bins); const e = a + Math.floor((i + 1) * len / bins); const n = Math.max(1, e - s); cells.push(h('div', { key: i, style: { flex: '1 1 0', background: this.canonColor((data.pre[e] - data.pre[s]) / n) } })); }
    return h('div', { key, style: { display: 'flex', height: (height || 26) + 'px', borderRadius: '7px', overflow: 'hidden', border: '1px solid var(--line)' } }, cells);
  };

  // ---------- per-book drill-down ----------
  // Flat verse range [a,b) of every book, derived once from the canon geometry:
  // off[bi][0] starts book bi, and the next book's start (or the canon total for the
  // last book) ends it. Lets a tapped canon bar expand into one mini-bar per book.
  bookRanges = () => {
    if (this._branges) return this._branges;
    const { off, total } = this.canonGeom();
    return (this._branges = this.BOOKS.map((b, bi) => ({ bi, name: b.name, a: off[bi][0], b: bi + 1 < off.length ? off[bi + 1][0] : total })));
  };
  // Tapping a canon bar toggles its per-book breakdown (keyed 'all' / 'ot' / 'nt').
  toggleCanon = (key) => { const open = { ...(this.state.canonOpen || {}) }; open[key] = !open[key]; this.setState({ canonOpen: open }); };
  // The expanded list: one row per book within [a,b) — name, a mini status bar, and
  // how many of its verses you've seen. Books with no progress stay muted.
  renderBookList = (data, a, b, key) => {
    const h = React.createElement;
    const rows = this.bookRanges().filter((r) => r.b > a && r.a < b).map((r) => {
      let seen = 0; for (let i = r.a; i < r.b; i++) if (data.status[i] >= 1) seen++;
      const total = r.b - r.a;
      return h('div', { key: r.bi, style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        h('div', { key: 'nm', style: { width: '108px', flex: 'none', fontSize: '12px', color: seen ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r.name),
        h('div', { key: 'br', style: { flex: 1, minWidth: 0 } }, this.renderBar(data, r.a, r.b, key + 'b' + r.bi, 14)),
        h('div', { key: 'ct', style: { width: '58px', flex: 'none', textAlign: 'right', fontSize: '11px', color: seen ? 'var(--text)' : 'var(--muted)' } }, seen + ' / ' + total),
      ]);
    });
    return h('div', { key: key + 'list', style: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--line)' } }, rows);
  };

  // ---------- practice heatmap (GitHub-style) ----------
  // Last ~26 weeks of daily practice, columns = weeks (Sunday-aligned), rows =
  // weekday. Cells are keyed and coloured by lectio.history[date] (UTC, matching
  // how the streak stamps "today"). Today gets an accent ring.
  renderHeatmap = () => {
    const h = React.createElement; const hist = this.state.history || {}; const MS = 86400000; const weeks = 26;
    const todayStr = new Date().toISOString().slice(0, 10); const tMid = Date.parse(todayStr + 'T00:00:00Z');
    let sMid = tMid - (weeks * 7 - 1) * MS; sMid -= new Date(sMid).getUTCDay() * MS;
    const days = Math.round((tMid - sMid) / MS) + 1; const cols = []; let col = [];
    for (let i = 0; i < days; i++) { const ds = new Date(sMid + i * MS).toISOString().slice(0, 10); const c = hist[ds] || 0; col.push(h('div', { key: ds, title: ds + (c ? ' · ' + c + ' practice' + (c === 1 ? '' : 's') : ''), style: { width: '12px', height: '12px', borderRadius: '3px', background: this.heatColor(c), boxShadow: ds === todayStr ? '0 0 0 1.5px var(--accent)' : 'none' } })); if (col.length === 7) { cols.push(h('div', { key: cols.length, style: { display: 'flex', flexDirection: 'column', gap: '3px' } }, col)); col = []; } }
    if (col.length) { while (col.length < 7) col.push(h('div', { key: 'pad' + col.length, style: { width: '12px', height: '12px' } })); cols.push(h('div', { key: 'last', style: { display: 'flex', flexDirection: 'column', gap: '3px' } }, col)); }
    return h('div', { key: 'hm', style: { display: 'flex', gap: '3px', overflowX: 'auto', paddingBottom: '2px' } }, cols);
  };

  // ---------- the "Your progress" view ----------
  openStats = () => this.setState({ view: 'stats', pickerOpen: false, settingsOpen: false });
  card = (kids, key) => React.createElement('div', { key, style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' } }, kids);
  sectionTitle = (t, key) => React.createElement('div', { key, style: { fontSize: '13px', fontWeight: 700, letterSpacing: '.3px', color: 'var(--muted)' } }, t);
  swatch = (color, label) => React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--muted)' } }, React.createElement('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: color, border: '1px solid var(--line)' } }), label);
  renderStats = () => {
    const h = React.createElement; const st = this.state; const data = this.verseStatus(); const s = this.canonStops();
    const fmt = (n) => n.toLocaleString();
    const completedPassages = Object.keys(st.progress || {}).filter((k) => { const p = st.progress[k]; return p.learned || (p.best || 0) >= this.MASTERY || (p.known || 0) >= this.MASTERY; }).length;
    const dayWord = (n) => n + (n === 1 ? ' day' : ' days');
    const tile = (label, value, accent) => h('div', { key: label, style: { background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: '13px', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: '3px' } },
      h('div', { style: { fontFamily: "'Gentium Book Plus',serif", fontSize: '27px', fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1.05 } }, value),
      h('div', { style: { fontSize: '12px', color: 'var(--muted)' } }, label));

    const header = h('div', { key: 'hd', style: { display: 'flex', alignItems: 'center', gap: '12px' } },
      h('button', { onClick: this.goHome, style: { padding: '7px 12px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' } }, '‹ Back'),
      h('h2', { style: { margin: 0, fontFamily: "'Gentium Book Plus',serif", fontSize: '24px', flex: 1 } }, 'Your progress'));

    const tiles = h('div', { key: 'tiles', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px' } }, [
      tile('Current streak', dayWord(st.streak.count || 0), (st.streak.count || 0) > 0),
      tile('Longest streak', dayWord(st.streak.best || 0)),
      tile('Passages learned', fmt(completedPassages)),
      tile('Verses memorized', fmt(data.doneN)),
    ]);

    const heat = this.card([
      h('div', { key: 't', style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } }, this.sectionTitle('PRACTICE · LAST 6 MONTHS'), h('span', { style: { fontSize: '12px', color: 'var(--muted)' } }, 'Every day you practise lights up.')),
      this.renderHeatmap(),
      h('div', { key: 'lg', style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)' } }, 'Less', h('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: this.heatColor(0), border: '1px solid var(--line)' } }), h('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: this.heatColor(1) } }), h('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: this.heatColor(3) } }), h('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: this.heatColor(5) } }), h('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: this.heatColor(9) } }), 'More'),
    ], 'heat');

    const pct = Math.round((data.seenN / data.total) * 1000) / 10;
    const open = this.state.canonOpen || {};
    // A tappable canon bar: its label (with a rotating chevron) and the bar itself
    // toggle a per-book breakdown, so you can drill from the whole canon down to which
    // books you've seen without leaving the overview. `caption` sits beneath the bar.
    const barGroup = (a, b, key, label, caption) => {
      const isOpen = !!open[key];
      const head = h('div', { key: 'hd', onClick: () => this.toggleCanon(key), style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', touchAction: 'manipulation' } },
        h('span', { style: { display: 'inline-block', transition: 'transform .15s ease', transform: isOpen ? 'rotate(90deg)' : 'none', fontSize: '10px' } }, '▶'), label);
      return h('div', { key, style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
        head,
        h('div', { key: 'br', onClick: () => this.toggleCanon(key), style: { cursor: 'pointer', touchAction: 'manipulation' } }, this.renderBar(data, a, b, key + 'bar')),
        caption ? h('div', { key: 'cap', style: { fontSize: '11px', color: 'var(--muted)' } }, caption) : null,
        isOpen ? this.renderBookList(data, a, b, key) : null,
      ]);
    };
    const canon = this.card([
      this.sectionTitle('THE WHOLE BIBLE', 'st'),
      h('div', { key: 'sum', style: { fontSize: '13px', color: 'var(--text)' } }, h('strong', null, fmt(data.seenN)), ' of ', fmt(data.total), ' verses seen', h('span', { style: { color: 'var(--muted)' } }, '  ·  ' + fmt(data.doneN) + ' memorized  ·  ' + pct + '%')),
      barGroup(0, data.total, 'all', 'Genesis → Revelation', 'Every verse in order, equal width — tap any bar to break it down by book.'),
      barGroup(0, data.otEnd, 'ot', 'Old Testament', null),
      barGroup(data.otEnd, data.total, 'nt', 'New Testament', null),
      h('div', { key: 'lg', style: { display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '2px' } }, this.swatch(this.mix(s.a, s.a, 0), 'Unseen'), this.swatch(this.mix(s.a, s.b, 1), 'Seen'), this.swatch(this.mix(s.b, s.c, 1), 'Memorized')),
    ], 'canon');

    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [header, tiles, heat, canon]);
  };

  // ---------- suggested passages ----------
  // Curated starting points for when you don't know what to memorize: beloved
  // passages, the Roman's Road gospel path, and the Navigators' Topical Memory
  // System (60 verses, series A-E). Each item is a label + a plain reference that
  // the existing loader understands; tapping one loads it.
  SUGGESTIONS = [
    { id: 'start', title: 'Start here', note: 'A gentle place to begin.', items: [
      { label: 'The Lord is my shepherd', ref: 'Psalm 23' }, { label: 'For God so loved the world', ref: 'John 3:16' },
      { label: 'Do not be anxious', ref: 'Philippians 4:6-7' }, { label: 'All things work together', ref: 'Romans 8:28' },
      { label: 'The two ways', ref: 'Psalm 1' }, { label: 'My help comes from the LORD', ref: 'Psalm 121' },
      { label: 'Trust in the LORD', ref: 'Proverbs 3:5-6' }, { label: 'Be strong and courageous', ref: 'Joshua 1:9' } ] },
    { id: 'popular', title: 'Popular passages', note: 'Well-loved, often-memorized texts.', items: [
      { label: "The Lord's Prayer", ref: 'Matthew 6:9-13' }, { label: 'The Christ hymn', ref: 'Philippians 2:5-11' },
      { label: 'Love is patient', ref: '1 Corinthians 13:4-8' }, { label: 'The Beatitudes', ref: 'Matthew 5:3-12' },
      { label: 'Fruit of the Spirit', ref: 'Galatians 5:22-23' }, { label: 'The Shema', ref: 'Deuteronomy 6:4-7' },
      { label: 'Be still, and know', ref: 'Psalm 46:10' }, { label: 'The Great Commission', ref: 'Matthew 28:18-20' },
      { label: 'The LORD is my light', ref: 'Psalm 27:1' }, { label: 'In the beginning was the Word', ref: 'John 1:1-5' },
      { label: 'Fearfully and wonderfully made', ref: 'Psalm 139:13-16' }, { label: 'Wings like eagles', ref: 'Isaiah 40:28-31' } ] },
    { id: 'romans', title: "Roman's Road (the gospel)", note: 'A path through Romans that tells the gospel, verse by verse.', items: [
      { label: 'All have sinned', ref: 'Romans 3:23' }, { label: 'The wages of sin', ref: 'Romans 6:23' },
      { label: 'God shows his love', ref: 'Romans 5:8' }, { label: 'Confess and believe', ref: 'Romans 10:9-10' },
      { label: 'Everyone who calls', ref: 'Romans 10:13' }, { label: 'No condemnation', ref: 'Romans 8:1' } ] },
    { id: 'tms-a', title: 'TMS · A — Live the New Life', note: "The Navigators' Topical Memory System.", items: [
      { label: 'Christ the Center', ref: '2 Corinthians 5:17' }, { label: 'Christ the Center', ref: 'Galatians 2:20' },
      { label: 'Obedience to Christ', ref: 'Romans 12:1' }, { label: 'Obedience to Christ', ref: 'John 14:21' },
      { label: 'The Word', ref: '2 Timothy 3:16' }, { label: 'The Word', ref: 'Joshua 1:8' },
      { label: 'Prayer', ref: 'John 15:7' }, { label: 'Prayer', ref: 'Philippians 4:6-7' },
      { label: 'Fellowship', ref: 'Matthew 18:20' }, { label: 'Fellowship', ref: 'Hebrews 10:24-25' },
      { label: 'Witnessing', ref: 'Matthew 4:19' }, { label: 'Witnessing', ref: 'Romans 1:16' } ] },
    { id: 'tms-b', title: 'TMS · B — Proclaim Christ', note: "The Navigators' Topical Memory System.", items: [
      { label: 'All Have Sinned', ref: 'Romans 3:23' }, { label: 'All Have Sinned', ref: 'Isaiah 53:6' },
      { label: "Sin's Penalty", ref: 'Romans 6:23' }, { label: "Sin's Penalty", ref: 'Hebrews 9:27' },
      { label: 'Christ Paid the Penalty', ref: 'Romans 5:8' }, { label: 'Christ Paid the Penalty', ref: '1 Peter 3:18' },
      { label: 'Salvation Not by Works', ref: 'Ephesians 2:8-9' }, { label: 'Salvation Not by Works', ref: 'Titus 3:5' },
      { label: 'Must Receive Christ', ref: 'John 1:12' }, { label: 'Must Receive Christ', ref: 'Revelation 3:20' },
      { label: 'Assurance of Salvation', ref: '1 John 5:13' }, { label: 'Assurance of Salvation', ref: 'John 5:24' } ] },
    { id: 'tms-c', title: "TMS · C — Rely on God's Resources", note: "The Navigators' Topical Memory System.", items: [
      { label: 'His Spirit', ref: '1 Corinthians 3:16' }, { label: 'His Spirit', ref: '1 Corinthians 2:12' },
      { label: 'His Strength', ref: 'Isaiah 41:10' }, { label: 'His Strength', ref: 'Philippians 4:13' },
      { label: 'His Faithfulness', ref: 'Lamentations 3:22-23' }, { label: 'His Faithfulness', ref: 'Numbers 23:19' },
      { label: 'His Peace', ref: 'Isaiah 26:3' }, { label: 'His Peace', ref: '1 Peter 5:7' },
      { label: 'His Provision', ref: 'Romans 8:32' }, { label: 'His Provision', ref: 'Philippians 4:19' },
      { label: 'His Help in Temptation', ref: 'Hebrews 2:18' }, { label: 'His Help in Temptation', ref: 'Psalm 119:9-11' } ] },
    { id: 'tms-d', title: "TMS · D — Be Christ's Disciple", note: "The Navigators' Topical Memory System.", items: [
      { label: 'Put Christ First', ref: 'Matthew 6:33' }, { label: 'Put Christ First', ref: 'Luke 9:23' },
      { label: 'Separate from the World', ref: '1 John 2:15-16' }, { label: 'Separate from the World', ref: 'Romans 12:2' },
      { label: 'Be Steadfast', ref: '1 Corinthians 15:58' }, { label: 'Be Steadfast', ref: 'Hebrews 12:3' },
      { label: 'Serve Others', ref: 'Mark 10:45' }, { label: 'Serve Others', ref: '2 Corinthians 4:5' },
      { label: 'Give Generously', ref: 'Proverbs 3:9-10' }, { label: 'Give Generously', ref: '2 Corinthians 9:6-7' },
      { label: 'Develop World Vision', ref: 'Acts 1:8' }, { label: 'Develop World Vision', ref: 'Matthew 28:19-20' } ] },
    { id: 'tms-e', title: 'TMS · E — Grow in Christlikeness', note: "The Navigators' Topical Memory System.", items: [
      { label: 'Love', ref: 'John 13:34-35' }, { label: 'Love', ref: '1 John 3:18' },
      { label: 'Humility', ref: 'Philippians 2:3-4' }, { label: 'Humility', ref: '1 Peter 5:5-6' },
      { label: 'Purity', ref: 'Ephesians 5:3' }, { label: 'Purity', ref: '1 Peter 2:11' },
      { label: 'Honesty', ref: 'Leviticus 19:11' }, { label: 'Honesty', ref: 'Acts 24:16' },
      { label: 'Faith', ref: 'Hebrews 11:6' }, { label: 'Faith', ref: 'Romans 4:20-21' },
      { label: 'Good Works', ref: 'Galatians 6:9-10' }, { label: 'Good Works', ref: 'Matthew 5:16' } ] },
  ];
  curSuggest = () => this.SUGGESTIONS.find((c) => c.id === this.state.suggestId) || this.SUGGESTIONS[0];
  onSuggestCollection = (e) => this.setState({ suggestId: e.target.value });
  // Tapping a suggestion fills the Scripture selector and loads it. We fall back to
  // King James when the current version can't serve the passage (Greek for an OT
  // text, or ESV with no token saved) so a tap always lands on something readable.
  loadSuggestion = (ref) => {
    const p = this.parseRef(ref); if (!p) return; const whole = p.vs == null;
    let version = this.state.version;
    if (version === 'Greek' && p.bi < 39) version = 'KJV';
    if (version === 'ESV' && !this.state.esvToken.trim()) version = 'KJV';
    try { localStorage.setItem('lectio.version', version); } catch (e) {}
    this.setState({ corpus: 'bible', version, book: this.BOOKS[p.bi].name, chapter: String(p.ch || 1), vStart: String(whole ? 1 : p.vs), vEnd: whole ? '' : String(p.ve || p.vs), pickerOpen: false, error: null, offerKjv: false },
      () => { this.persistSel(); this.ensureVerseCount(); this.doLoad(); });
  };

  // Footer/picker values for the stats view + suggested-passages picker.
  vals_stats = () => {
    const cur = this.curSuggest();
    return {
      isStats: this.state.view === 'stats', showPicker: this.state.view !== 'stats', openStats: this.openStats,
      statsView: this.state.view === 'stats' ? this.renderStats() : null,
      isSuggested: this.state.corpus === 'suggested',
      suggestCollections: this.SUGGESTIONS.map((c) => ({ id: c.id, title: c.title })),
      suggestId: this.state.suggestId, onSuggestCollection: this.onSuggestCollection, suggestNote: cur.note || '',
      chipStyle: { display: 'inline-flex', flexDirection: 'column', gap: '1px', alignItems: 'flex-start', textAlign: 'left', padding: '8px 12px', borderRadius: '11px', border: '1px solid var(--line)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', touchAction: 'manipulation' },
      suggestItems: cur.items.map((it, i) => ({ label: it.label, ref: it.ref, onClick: this.tapGuard('sg' + cur.id + i, () => this.loadSuggestion(it.ref)) })),
    };
  };
