  // ============================================================================
  // render.js — rendering glue (class-body fragment; see core.js). Dispatches each
  // word to the active mode's renderWord_*, lays out the passage, and assembles the
  // flat renderVals() object the template binds against (merging each mode's
  // vals_* footer values with the shared chrome/picker/status values).
  // ============================================================================

  sizeMap = { Compact: { fs: 'clamp(17px,2vw,22px)', lh: 1.85 }, Comfortable: { fs: 'clamp(19px,2.4vw,27px)', lh: 1.95 }, Large: { fs: 'clamp(22px,3vw,33px)', lh: 2.0 } };

  renderWord = (s, key) => {
    const h = React.createElement; if (!s.w) return h('span', { key }, s.text);
    const vi = s.vi, mode = this.state.mode;
    if (this.state.revealAllNow) return h('span', { key, style: { color: 'var(--accent)' } }, s.text);
    if (mode === 'hide') return this.renderWord_hide(s, key);
    if (mode === 'type') return this.renderWord_type(s, key);
    // fill / bank only style the selected blanks; everything else is plain text.
    if (!this._blankSet.has(vi)) return h('span', { key }, s.text);
    if (mode === 'hidden') return this.renderWord_fill(s, key);
    if (mode === 'bank') return this.renderWord_bank(s, key);
    return h('span', { key }, s.text);
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

    const ghostBtn = { padding: '9px 15px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' };
    const primaryBtn = { padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fbf8f1', fontSize: '14px', fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' };
    const selectStyle = { padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--surface)', color: 'var(--text)', fontSize: '15px', outline: 'none', flex: 1, minWidth: '150px' };

    // streak / best / learned
    const today = new Date().toISOString().slice(0, 10);
    const practicedToday = st.streak.last === today;
    const key = this.passageKey(); const prg = st.progress[key] || { best: 0, learned: false, attempts: 0 };
    const bestLabel = prg.attempts ? 'Best ' + Math.round(prg.best * 100) + '%' + (prg.attempts ? ' · ' + prg.attempts + ' tries' : '') : 'Not practiced yet';

    const modeHints = { hide: 'Recite from memory; peek when stuck.', hidden: 'Fill in the missing words.', bank: 'Rebuild it from the word bank.', type: 'Type it one word at a time.' };

    // shared "ease" slider (fill + bank): fewest → every word blank
    const showEase = !!p && (st.mode === 'hidden' || st.mode === 'bank');
    const easeLabel = this.allBlank() ? 'Every word blank' : Math.round(st.blankPct * 100) + '% blank';

    // pinned footer that floats above the iOS keyboard (translated by kbInset)
    const showFooter = st.view === 'practice' && !!p;
    const footerStyle = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, transform: 'translateY(-' + (st.kbInset || 0) + 'px)', background: 'var(--bg)', borderTop: '1px solid var(--line)', boxShadow: '0 -6px 20px rgba(0,0,0,.07)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom))' };
    const footerInner = { width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' };
    // Reserve room so the passage's tail can scroll clear of the pinned footer.
    const practicePad = { paddingBottom: 'calc(230px + env(safe-area-inset-bottom))' };
    const navBtn = (disabled) => ({ padding: '8px 13px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface)', color: disabled ? 'var(--muted)' : 'var(--text)', fontSize: '14px', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, touchAction: 'manipulation' });

    const base = {
      // chrome
      chromeBtn: { padding: '6px 11px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' },
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
      pickerChevron: st.pickerOpen ? '▾' : '▸',
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
      load: this.doLoad, loadBtn: primaryBtn, loadLabel: st.loading ? 'Loading…' : 'Load passage',

      // errors
      hasError: !!st.error, error: st.error, offerKjv: st.offerKjv, switchToKjv: this.switchToKjv,

      // tabs
      modeTabs: [['hide', 'Hide & reveal'], ['hidden', 'Fill blanks'], ['bank', 'Word bank'], ['type', 'Type it']].map(([id, label]) => ({ label, onClick: () => this.setMode(id), style: this.tab(id === st.mode) })),

      // passage
      hasPassage: !!p, reference: p ? p.reference : this.buildRef(), versionLabel: p ? p.version : st.version,
      modeHint: modeHints[st.mode] || '',
      practice: this.renderPractice(),

      // ease slider (top of passage)
      showEase, blankPct: st.blankPct, onBlankPct: this.onBlankPct, easeLabel,

      // pinned footer
      showFooter, footerStyle, footerInner, practicePad, navBtn,
      revealAll: this.revealAll, resetMode: this.resetMode,
      toggleHints: this.toggleHints, hintsBtn: this.toggleBtn(st.showHints), hintsLabel: st.showHints ? 'Hints on' : 'Hints off',

      // status
      streakDot: practicedToday ? 'var(--accent)' : 'var(--line)',
      streakLabel: (st.streak.count || 0) + '-day streak',
      bestLabel,
      toggleLearned: this.toggleLearned, learnedBtn: this.toggleBtn(prg.learned), learnedLabel: prg.learned ? '✓ Learned' : 'Mark as learned',

      // attribution
      isEsv: !!p && p.version === 'ESV', isKjv: !!p && p.version === 'KJV', isTr: !!p && p.version === 'GNT', openCopyright: this.openCopyright,

      // settings
      settingsOpen: st.settingsOpen, closeSettings: this.closeSettings, stop: this.stop,
      esvToken: st.esvToken, onTokenChange: this.onTokenChange, tokenState: st.esvToken ? 'Token saved.' : 'No token yet.',
      themeOpts: ['system', 'light', 'dark'].map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), onClick: () => this.setTheme(t), style: this.seg(t === st.theme) })),
      toggleReminder: this.toggleReminder, reminderBtn: this.toggleBtn(st.reminderOn), reminderLabel: st.reminderOn ? 'On' : 'Off',
      cacheStatus: st.cacheCount + (st.cacheCount === 1 ? ' ESV verse cached.' : ' ESV verses cached.'),
      clearCache: this.clearCache,
      usageVisible: st.usageToday > 0, usageToday: st.usageToday.toLocaleString(),

      copyrightOpen: st.copyrightOpen, closeCopyright: this.closeCopyright,

      // app update prompt
      updateReady: st.updateReady, applyUpdate: this.applyUpdate, dismissUpdate: this.dismissUpdate,
    };

    // Per-mode footer values, computed in their own files.
    const bankVals = this.vals_bank();
    return {
      ...base,
      ...this.vals_hide(),
      ...this.vals_fill(),
      ...bankVals,
      ...this.vals_type(),
      // nav buttons depend on bank enabled/disabled state
      bankPrevBtn: navBtn(bankVals.bankAtStart),
      bankNextBtn: navBtn(bankVals.bankAtEnd),
    };
  }
