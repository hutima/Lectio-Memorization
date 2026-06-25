  // ============================================================================
  // mode-fill.js — "Fill blanks" practice mode (class-body fragment; see core.js).
  // Selected words become inline inputs. Tap any blank to edit it (no need to start
  // at the beginning); a trailing space or an exact match auto-advances to the next.
  // The number of blanks is driven by the shared ease slider (core.onBlankPct).
  // ============================================================================

  focusNextBlank = (vi) => {
    const blanks = this.state.blankList || []; const i = blanks.indexOf(vi);
    for (let j = i + 1; j < blanks.length; j++) { const el = document.querySelector('[data-blank="' + blanks[j] + '"]'); if (el) { el.focus(); if (el.select) el.select(); return; } }
  };
  onBlankChange = (vi, val) => {
    const p = this.state.passage; const cur = p ? p.words[vi].text : '';
    const trailingSpace = /\s$/.test(val);
    const raw = val.replace(/\s+$/, '');
    const stored = cur && this.norm(raw) === this.norm(cur) ? cur : raw;
    // Auto-advance on a trailing space OR as soon as the typed word matches exactly,
    // so a correct blank turns green and hands focus to the next field.
    const exact = cur && this.norm(raw) === this.norm(cur);
    this.setState({ hiddenVals: { ...this.state.hiddenVals, [vi]: stored } }, () => { if (trailingSpace || exact) this.focusNextBlank(vi); this.checkHiddenDone(); });
  };
  checkHiddenDone = () => {
    const blanks = this.state.blankList; const p = this.state.passage; if (!p) return;
    if (!blanks.every((vi) => (this.state.hiddenVals[vi] || '').trim().length > 0)) return;
    const correct = blanks.filter((vi) => this.norm(this.state.hiddenVals[vi]) === this.norm(p.words[vi].text)).length;
    this.recordResult(correct / blanks.length);
  };

  renderWord_fill = (s, key) => {
    const h = React.createElement; const vi = s.vi, text = s.text; const st = this.state;
    const val = st.hiddenVals[vi] || ''; const ok = this.norm(val) === this.norm(text); const filled = val.length > 0;
    const col = !filled ? 'var(--muted)' : ok ? 'var(--good)' : 'var(--bad)';
    return h('input', {
      key, 'data-blank': vi, value: val,
      onChange: (e) => this.onBlankChange(vi, e.target.value),
      // Tapping a blank focuses it directly; keep it visible above the keyboard.
      onFocus: (e) => { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} },
      placeholder: st.showHints ? text[0] : '', spellCheck: false, autoCapitalize: 'off', autoComplete: 'off',
      style: { font: 'inherit', fontFamily: "'Gentium Book Plus',serif", width: (text.length * 0.62 + 1.4) + 'em', textAlign: 'center', border: 'none', borderBottom: '2px solid ' + col, background: 'transparent', color: filled ? (ok ? 'var(--good)' : 'var(--bad)') : 'var(--text)', outline: 'none', padding: '0 2px', margin: '0 1px', touchAction: 'manipulation' },
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
      else {
        const correct = st.blankList.filter((vi) => this.norm(st.hiddenVals[vi]) === this.norm(p.words[vi].text)).length;
        fillStatus = correct + ' / ' + total + ' correct';
      }
    }
    return { isHidden: st.mode === 'hidden', fillStatus };
  };
