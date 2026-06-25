  // ============================================================================
  // mode-type.js — "Type it" practice mode (class-body fragment; see core.js).
  // Type the passage one word at a time. Backspace at the start of an empty input
  // steps back to the previous word so you can fix a submitted mistake; tapping any
  // word jumps the cursor there. Each word's typed value is remembered per index.
  // ============================================================================

  currentWord = () => { const p = this.state.passage; return p && this.state.typeIdx < p.words.length ? p.words[this.state.typeIdx].text : null; };
  onTypeChange = (e) => {
    const val = e.target.value; const cur = this.currentWord();
    if (!cur) { this.setState({ typeInput: '' }); return; }
    if (/\s$/.test(val)) { this.commitType(val.trim()); return; }
    if (this.norm(val) === this.norm(cur) && this.norm(val).length >= this.norm(cur).length) { this.commitType(val); return; }
    this.setState({ typeInput: val });
  };
  onTypeKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); this.commitType(this.state.typeInput.trim()); return; }
    // Backspace on an empty field returns to the previous word, reloading what was
    // typed there so a submitted mistake can be corrected.
    if (e.key === 'Backspace' && this.state.typeInput === '' && this.state.typeIdx > 0) {
      e.preventDefault(); const pi = this.state.typeIdx - 1;
      this.setState({ typeIdx: pi, typeInput: this.state.typeVals[pi] || '' }, () => this.scrollActive());
    }
  };
  jumpType = (vi) => { this.setState({ typeIdx: vi, typeInput: this.state.typeVals[vi] || '' }, () => { this.scrollActive(); const el = document.querySelector('[data-typebox="1"]'); if (el) el.focus(); }); };
  commitType = (val) => {
    const cur = this.currentWord(); if (cur == null) return;
    const correct = this.norm(val) === this.norm(cur);
    const vals = { ...this.state.typeVals, [this.state.typeIdx]: val };
    if (correct) {
      const ni = this.state.typeIdx + 1;
      this.setState({ typeIdx: ni, typeInput: '', typeVals: vals }, () => { this.scrollActive(); if (ni >= this.state.passage.words.length) this.finishType(); });
    } else {
      this.setState({ typeErrors: this.state.typeErrors + 1, typeInput: '', typeVals: vals });
    }
  };
  finishType = () => { const total = this.state.passage.words.length; this.recordResult(total / (total + this.state.typeErrors)); };

  renderWord_type = (s, key) => {
    const h = React.createElement; const vi = s.vi, text = s.text; const st = this.state; const ti = st.typeIdx;
    if (vi < ti) {
      const typed = st.typeVals[vi]; const ok = typed == null || this.norm(typed) === this.norm(text);
      return h('span', { key, onClick: this.tapGuard('jt' + vi, () => this.jumpType(vi)), title: 'tap to fix', style: { cursor: 'pointer', touchAction: 'manipulation', color: ok ? 'var(--accent)' : 'var(--bad)' } }, text);
    }
    if (vi === ti) return h('span', { key, 'data-active': '1', onClick: this.tapGuard('jt' + vi, () => this.jumpType(vi)), style: { display: 'inline-block', minWidth: (text.length * 0.6 + 0.6) + 'em', background: 'var(--accent-soft)', borderRadius: '4px', boxShadow: 'inset 0 -2px 0 var(--accent)', color: st.showHints ? 'var(--muted)' : 'transparent', textAlign: 'center', cursor: 'pointer', touchAction: 'manipulation' } }, st.showHints ? text[0] : ' ');
    return h('span', { key, onClick: this.tapGuard('jt' + vi, () => this.jumpType(vi)), style: { display: 'inline-block', minWidth: (text.length * 0.6 + 0.6) + 'em', borderBottom: '1px dotted var(--muted)', color: 'transparent', cursor: 'pointer', touchAction: 'manipulation' } }, ' ');
  };

  // Footer control values for type mode.
  vals_type = () => {
    const st = this.state; const p = st.passage; const cur = this.currentWord();
    const typeHint = !p ? '' : cur ? (st.showHints ? 'starts with “' + cur[0] + '”' : 'type the next word') : 'Finished — well done.';
    const typeProgress = p ? (Math.min(st.typeIdx, p.words.length) + ' / ' + p.words.length + ' words' + (st.typeErrors ? ' · ' + st.typeErrors + ' slips' : '')) : '';
    return { isType: st.mode === 'type', typeInput: st.typeInput, onTypeChange: this.onTypeChange, onTypeKey: this.onTypeKey, typeHint, typeProgress };
  };
