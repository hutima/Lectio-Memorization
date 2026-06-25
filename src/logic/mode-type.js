  // ============================================================================
  // mode-type.js — "Test" practice mode (class-body fragment; see core.js).
  // The hardest mode: every word is a blank, typed inline in the text. It behaves
  // like "Fill blanks" locked to all words — there is no separate input field.
  // A trailing SPACE advances to the next word (finishing a word's letters does NOT
  // auto-jump — each word is committed deliberately, a truer test of recall); Backspace
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
    if (e.key === 'Backspace' && e.target.value === '') { e.preventDefault(); this.focusPrevType(vi); }
  };
  onTypeChange = (vi, val) => {
    const p = this.state.passage; const cur = p ? p.words[vi].text : '';
    const trailingSpace = /\s$/.test(val);
    const raw = val.replace(/\s+$/, '');
    const stored = cur && this.norm(raw) === this.norm(cur) ? cur : raw;
    // Typing reclaims a previously revealed word so it can count toward the score again.
    const reveal = { ...this.state.typeReveal }; if (reveal[vi]) delete reveal[vi];
    // Advance ONLY on a trailing space — completing a word's letters must not auto-jump.
    this.setState({ typeVals: { ...this.state.typeVals, [vi]: stored }, typeReveal: reveal }, () => { if (trailingSpace) this.focusNextType(vi); this.checkTypeDone(); });
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
  // Score the Test continuously so partial credit is captured. Blanks count as wrong,
  // so the known % always reflects how much of the passage has actually been recalled.
  // A long passage may never be fully filled — waiting for every word would mean no
  // credit at all for the verses you do know — so we record as you go: the first scored
  // keystroke counts as today's practice, and later keystrokes refine the score silently
  // (no repeated streak/heatmap bumps). The score keeps climbing toward MASTERY as more
  // words land, exactly as if you'd finished a shorter passage.
  checkTypeDone = () => {
    const p = this.state.passage; if (!p) return; const ws = this.typeWords(); if (!ws.length) return;
    const filled = ws.filter((vi) => (this.state.typeVals[vi] || '').trim().length > 0).length;
    if (!filled) return;
    const correct = ws.filter((vi) => this.typeCorrect(vi)).length;
    this.recordResult(correct / ws.length, { known: true, silent: this._typeScored });
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
