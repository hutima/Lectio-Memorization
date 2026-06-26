  // ============================================================================
  // mode-fill.js — "Fill blanks" practice mode (class-body fragment; see core.js).
  // Selected words become inline inputs. Tap any blank to edit it (no need to start
  // at the beginning); a trailing space or an exact match auto-advances to the next.
  // The number of blanks is driven by the shared ease slider (core.onBlankPct).
  // "Reveal word" fills the current blank but counts it wrong.
  // ============================================================================

  focusNextBlank = (vi) => {
    const blanks = this.state.blankList || []; const i = blanks.indexOf(vi);
    for (let j = i + 1; j < blanks.length; j++) { const el = document.querySelector('[data-blank="' + blanks[j] + '"]'); if (el) { el.focus(); if (el.select) el.select(); return; } }
  };
  // Backspace on an empty blank steps focus back to the previous blank (mirrors the
  // typing mode) so corrections flow backwards without reaching for the next field.
  focusPrevBlank = (vi) => {
    const blanks = this.state.blankList || []; const i = blanks.indexOf(vi);
    for (let j = i - 1; j >= 0; j--) {
      const el = document.querySelector('[data-blank="' + blanks[j] + '"]');
      if (el) { el.focus(); const v = el.value || ''; try { el.setSelectionRange(v.length, v.length); } catch (_) {} return; }
    }
  };
  onBlankKey = (vi, e) => {
    if (e.key === 'Backspace' && e.target.value === '') { e.preventDefault(); this.focusPrevBlank(vi); return; }
    // A space typed into an empty blank is redundant — a correct word already auto-advanced
    // here, so swallow it rather than insert a leading space (which would also read as a
    // trailing space and skip the blank). Mistyped blanks still take a manual space to move on.
    if ((e.key === ' ' || e.key === 'Spacebar') && e.target.value === '') e.preventDefault();
  };
  onBlankChange = (vi, val) => {
    const p = this.state.passage; const cur = p ? p.words[vi].text : '';
    const trailingSpace = /\s$/.test(val);
    const raw = val.replace(/\s+$/, '');
    const stored = cur && this.norm(raw) === this.norm(cur) ? cur : raw;
    // Typing reclaims a previously revealed blank so it can count as correct again.
    const reveal = { ...this.state.hiddenReveal }; if (reveal[vi]) delete reveal[vi];
    // Auto-advance on a trailing space OR as soon as the typed word matches exactly,
    // so a correct blank turns green and hands focus to the next field.
    const exact = cur && this.norm(raw) === this.norm(cur);
    this.setState({ hiddenVals: { ...this.state.hiddenVals, [vi]: stored }, hiddenReveal: reveal }, () => { if (trailingSpace || exact) this.focusNextBlank(vi); this.checkHiddenDone(); });
  };
  // Reveal the current (focused, else first empty) blank: fill the answer but flag it in
  // hiddenReveal so it counts wrong; then advance to the next blank.
  revealFillWord = () => {
    const blanks = this.state.blankList; const p = this.state.passage; if (!p || !blanks.length) return;
    let vi = this.state.fillActive;
    if (vi == null || !blanks.includes(vi)) vi = blanks.find((b) => !(this.state.hiddenVals[b] || '').trim());
    if (vi == null) return;
    this.setState({
      hiddenVals: { ...this.state.hiddenVals, [vi]: p.words[vi].text },
      hiddenReveal: { ...this.state.hiddenReveal, [vi]: true },
    }, () => { this.focusNextBlank(vi); this.checkHiddenDone(); });
  };
  // A revealed blank counts wrong even though it shows the right text, so exclude it.
  fillCorrect = (vi) => !this.state.hiddenReveal[vi] && this.norm(this.state.hiddenVals[vi]) === this.norm(this.state.passage.words[vi].text);
  checkHiddenDone = () => {
    const blanks = this.state.blankList; const p = this.state.passage; if (!p) return;
    if (!blanks.every((vi) => (this.state.hiddenVals[vi] || '').trim().length > 0)) return;
    const correct = blanks.filter((vi) => this.fillCorrect(vi)).length;
    this.recordResult(correct / blanks.length);
  };

  renderWord_fill = (s, key) => {
    const h = React.createElement; const vi = s.vi, text = s.text; const st = this.state;
    const val = st.hiddenVals[vi] || ''; const revealed = !!st.hiddenReveal[vi];
    const ok = !revealed && this.norm(val) === this.norm(text); const filled = val.length > 0;
    const col = revealed ? 'var(--bad)' : !filled ? 'var(--muted)' : ok ? 'var(--good)' : 'var(--bad)';
    return h('input', {
      key, 'data-blank': vi, value: val,
      onChange: (e) => this.onBlankChange(vi, e.target.value),
      onKeyDown: (e) => this.onBlankKey(vi, e),
      // Tapping a blank focuses it directly (and marks it current); keep it above the keyboard.
      onFocus: (e) => { this.setState({ fillActive: vi }); try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} },
      placeholder: st.showHints ? text[0] : '', spellCheck: false, autoCapitalize: 'off', autoComplete: 'off', autoCorrect: 'off', inputMode: 'text',
      style: { font: 'inherit', fontFamily: this.scriptFont(), width: (text.length * 0.62 + 1.4) + 'em', textAlign: 'center', border: 'none', borderBottom: '2px solid ' + col, background: 'transparent', color: filled ? (ok ? 'var(--good)' : 'var(--bad)') : 'var(--text)', outline: 'none', padding: '0 2px', margin: '0 1px', touchAction: 'manipulation' },
    });
  };

  // Footer control values for fill mode.
  vals_fill = () => {
    const st = this.state; const p = st.passage;
    let fillStatus = '';
    if (p && st.blankList.length) {
      const total = st.blankList.length;
      const filled = st.blankList.filter((vi) => (st.hiddenVals[vi] || '').trim().length > 0).length;
      if (filled < total) fillStatus = filled + ' / ' + total + ' filled';
      else { const correct = st.blankList.filter((vi) => this.fillCorrect(vi)).length; fillStatus = correct + ' / ' + total + ' correct'; }
    }
    return { isHidden: st.mode === 'hidden', fillStatus, revealFillWord: this.revealFillWord };
  };
