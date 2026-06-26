  // ============================================================================
  // mode-type.js — "Test" practice mode (class-body fragment; see core.js).
  // The hardest mode: every word is a blank, typed inline in the text. It behaves
  // like "Fill blanks" locked to all words — there is no separate input field.
  // A correct word auto-advances to the next blank (so does a trailing SPACE); Backspace
  // on an empty field steps back to the previous word so a slip can be corrected;
  // tapping any word jumps the cursor there. "Reveal word" fills the current word but
  // counts it wrong. Each word's value lives in typeVals; revealed words in typeReveal.
  // A completed Test records the passage's "known %" (recordResult opts.known).
  // ============================================================================

  // Every word index, in reading order — type mode blanks all of them.
  typeWords = () => { const p = this.state.passage; return p ? p.words.map((w) => w.vi) : []; };
  focusNextType = (vi) => {
    const ws = this.typeWords(); const i = ws.indexOf(vi);
    for (let j = i + 1; j < ws.length; j++) { const el = document.querySelector('[data-typebox="' + ws[j] + '"]'); if (el) { el.focus(); if (el.select) el.select(); return; } }
  };
  // Backspace on an empty field steps focus back to the previous word.
  focusPrevType = (vi) => {
    const ws = this.typeWords(); const i = ws.indexOf(vi);
    for (let j = i - 1; j >= 0; j--) {
      const el = document.querySelector('[data-typebox="' + ws[j] + '"]');
      if (el) { el.focus(); const v = el.value || ''; try { el.setSelectionRange(v.length, v.length); } catch (_) {} return; }
    }
  };
  onTypeKey = (vi, e) => {
    if (e.key === 'Backspace' && e.target.value === '') { e.preventDefault(); this._typeSpaceArmed = null; this.focusPrevType(vi); return; }
    // A space typed into an empty field is redundant — a correct word already auto-advanced
    // here, so swallow the space rather than insert a leading one (which would also count as
    // a trailing space and skip the word). But a SECOND space in a row deliberately advances:
    // the first space is ignored, and the double-space steps past a word you mean to skip
    // without typing it. Only words you actually mistype need a trailing space.
    if ((e.key === ' ' || e.key === 'Spacebar') && e.target.value === '') {
      e.preventDefault();
      if (this._typeSpaceArmed === vi) { this._typeSpaceArmed = null; this.focusNextType(vi); }
      else this._typeSpaceArmed = vi;
      return;
    }
    this._typeSpaceArmed = null;
  };
  onTypeChange = (vi, val) => {
    const p = this.state.passage; const cur = p ? p.words[vi].text : '';
    const trailingSpace = /\s$/.test(val);
    const raw = val.replace(/\s+$/, '');
    const stored = cur && this.norm(raw) === this.norm(cur) ? cur : raw;
    // Typing reclaims a previously revealed word so it can count toward the score again.
    const reveal = { ...this.state.typeReveal }; if (reveal[vi]) delete reveal[vi];
    // Advance on a trailing space OR as soon as the typed word matches exactly, so a correct
    // word turns green and hands focus on. A habitual space on the now-empty next field is
    // swallowed by onTypeKey, so it can't skip a word.
    const exact = cur && this.norm(raw) === this.norm(cur);
    this.setState({ typeVals: { ...this.state.typeVals, [vi]: stored }, typeReveal: reveal }, () => { if (trailingSpace || exact) this.focusNextType(vi); this.checkTypeDone(); });
  };
  // Reveal the current (focused, else first empty) word: fill the answer but flag it in
  // typeReveal so it counts wrong; then advance. This lowers the recorded "known %".
  revealTypeWord = () => {
    const ws = this.typeWords(); const p = this.state.passage; if (!p || !ws.length) return;
    let vi = this.state.typeActive;
    if (vi == null || !ws.includes(vi)) vi = ws.find((w) => !(this.state.typeVals[w] || '').trim());
    if (vi == null) return;
    this.setState({
      typeVals: { ...this.state.typeVals, [vi]: p.words[vi].text },
      typeReveal: { ...this.state.typeReveal, [vi]: true },
    }, () => { this.focusNextType(vi); this.checkTypeDone(); });
  };
  // A revealed word counts wrong even though it shows the right text, so exclude it.
  typeCorrect = (vi) => !this.state.typeReveal[vi] && this.norm(this.state.typeVals[vi]) === this.norm(this.state.passage.words[vi].text);
  // Group every word index by the verse it belongs to ({ verse -> [vi, ...] }).
  typeVerseGroups = () => { const p = this.state.passage; const g = {}; if (p) p.words.forEach((w) => { (g[w.v] = g[w.v] || []).push(w.vi); }); return g; };
  // Persistent Test progress: a verse you've already mastered (stored per-verse score >=
  // MASTERY) is pre-filled with its text on entry, so returning to a passage shows the
  // verses you know already done and you can test only what's left. Returns the typeVals to
  // seed (called by initModes). A Restart sets _typeNoSeed so it clears instead — the stored
  // mastery is untouched and is only re-scored if that verse is retyped (checkTypeDone).
  seedTypeKnown = (passage) => {
    if (this._typeNoSeed) { this._typeNoSeed = false; return {}; }
    const p = passage || this.state.passage; if (!p) return {};
    const cur = this.state.progress[p.version + ' · ' + p.reference] || {}; const vk = cur.verseKnown || {};
    const vals = {};
    p.words.forEach((w) => { if ((vk[w.v] || 0) >= this.MASTERY) vals[w.vi] = w.text; });
    return vals;
  };
  // Score the Test continuously so partial credit is captured, but assess it PER VERSE.
  // Blanks count as wrong, so a verse's score reflects how much of it you've recalled.
  // Crucially, a verse is only reassessed when it's reattempted — i.e. something is
  // typed (or revealed) inside it this test. Verses you leave untouched keep their
  // previously stored score, so a partial retest of a long passage never wipes out the
  // credit you already earned for the verses you're not retyping. The passage-level
  // known % is the word-weighted average of the per-verse scores. The first scored
  // keystroke counts as today's practice; later keystrokes refine silently (no repeated
  // streak/heatmap bumps).
  checkTypeDone = () => {
    const p = this.state.passage; if (!p) return; const ws = this.typeWords(); if (!ws.length) return;
    const vals = this.state.typeVals, reveal = this.state.typeReveal;
    if (!ws.some((vi) => (vals[vi] || '').trim().length > 0)) return;
    const groups = this.typeVerseGroups();
    const cur = this.state.progress[this.passageKey()] || {};
    const prev = cur.verseKnown || {};
    // Baseline for a verse never scored per-verse before: fall back to the passage's
    // old whole-passage known % so upgrading from the previous (all-or-nothing) scoring
    // doesn't drop credit on the first partial retest.
    const base = cur.known != null ? cur.known : 0;
    const verseKnown = {}; let total = 0, sum = 0;
    Object.keys(groups).forEach((v) => {
      const idxs = groups[v];
      const touched = idxs.some((vi) => (vals[vi] || '').trim().length > 0 || reveal[vi]);
      // Reattempted verse -> reassess (overwrite, even if lower). Otherwise keep its
      // stored per-verse score, or the legacy baseline if it has none yet.
      const score = touched ? idxs.filter((vi) => this.typeCorrect(vi)).length / idxs.length
        : (prev[v] != null ? prev[v] : base);
      verseKnown[v] = score; total += idxs.length; sum += score * idxs.length;
    });
    this.recordResult(total ? sum / total : 0, { known: true, silent: this._typeScored, verseKnown });
    this._typeScored = true;
  };

  renderWord_type = (s, key) => {
    const h = React.createElement; const vi = s.vi, text = s.text; const st = this.state;
    const val = st.typeVals[vi] || ''; const revealed = !!st.typeReveal[vi];
    const ok = !revealed && this.norm(val) === this.norm(text); const filled = val.length > 0;
    const col = revealed ? 'var(--bad)' : !filled ? 'var(--muted)' : ok ? 'var(--good)' : 'var(--bad)';
    return h('input', {
      key, 'data-typebox': vi, value: val,
      onChange: (e) => this.onTypeChange(vi, e.target.value),
      onKeyDown: (e) => this.onTypeKey(vi, e),
      // Tapping a word focuses it directly (and marks it current); keep it above the keyboard.
      onFocus: (e) => { this.setState({ typeActive: vi }); try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} },
      placeholder: st.showHints ? text[0] : '', spellCheck: false, autoCapitalize: 'off', autoComplete: 'off', autoCorrect: 'off', inputMode: 'text',
      style: { font: 'inherit', fontFamily: this.scriptFont(), width: (text.length * 0.62 + 1.4) + 'em', textAlign: 'center', border: 'none', borderBottom: '2px solid ' + col, background: 'transparent', color: filled ? (ok ? 'var(--good)' : 'var(--bad)') : 'var(--text)', outline: 'none', padding: '0 2px', margin: '0 1px', touchAction: 'manipulation' },
    });
  };

  // Footer control values for type mode.
  vals_type = () => {
    const st = this.state; const p = st.passage; const ws = this.typeWords();
    let typeStatus = '';
    if (p && ws.length) {
      const total = ws.length;
      const filled = ws.filter((vi) => (st.typeVals[vi] || '').trim().length > 0).length;
      const correct = ws.filter((vi) => this.typeCorrect(vi)).length;
      // Always show the running score (blanks count as wrong) so partial credit is
      // visible on long passages; while words remain, also note how many are filled.
      typeStatus = filled < total ? (correct + ' / ' + total + ' correct · ' + filled + ' filled') : (correct + ' / ' + total + ' correct');
    }
    return { isType: st.mode === 'type', typeStatus, revealTypeWord: this.revealTypeWord };
  };
