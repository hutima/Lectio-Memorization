  // ============================================================================
  // mode-hide.js — "Hide & reveal" practice mode (class-body fragment; see core.js).
  // Progressively hide every word; tap a hidden word to peek. The Hide/Show toggle is
  // the only control — hiding the passage (to recite) counts as practice for the day.
  // ============================================================================

  // Hiding the passage marks the day practiced (this used to ride on the removed
  // "Reveal all" button); showing it again is a no-op for the streak.
  toggleHideAll = () => { const on = !this.state.hideAll; this.setState({ hideAll: on, revealed: {} }); if (on) this.markPracticed(); };
  revealWord = (vi) => this.setState({ revealed: { ...this.state.revealed, [vi]: true } });
  // "Reveal all" shows the whole passage. It snapshots the hide-mode state so the
  // user can step back into exactly where they were; the other modes keep their
  // progress (typed/placed words) untouched while revealed, so undo just hides
  // the answers again. Counts as a practice for the day. (Used by fill/type/bank.)
  revealAll = () => {
    this._revealPrev = { hideAll: this.state.hideAll, revealed: this.state.revealed };
    this.setState({ revealAllNow: true, hideAll: false, revealed: {} });
    this.markPracticed();
  };
  undoRevealAll = () => {
    const prev = this._revealPrev || {}; this._revealPrev = null;
    this.setState({ revealAllNow: false, hideAll: prev.hideAll || false, revealed: prev.revealed || {} });
  };
  toggleRevealAll = () => { if (this.state.revealAllNow) this.undoRevealAll(); else this.revealAll(); };

  renderWord_hide = (s, key) => {
    const h = React.createElement; const vi = s.vi, text = s.text; const st = this.state;
    if (!st.hideAll) return h('span', { key }, text);
    if (st.revealed[vi]) return h('span', { key, style: { color: 'var(--accent)' } }, text);
    return h('span', { key, onClick: this.tapGuard('rev' + vi, () => this.revealWord(vi)), title: 'tap to peek', style: { cursor: 'pointer', touchAction: 'manipulation', background: 'var(--accent-soft)', color: 'transparent', borderRadius: '4px', padding: '0 2px', boxShadow: 'inset 0 -1px 0 var(--line)' } }, text);
  };

  // Footer control values for hide mode.
  vals_hide = () => ({
    isHide: this.state.mode === 'hide',
    toggleHideAll: this.toggleHideAll,
    hideToggleLabel: this.state.hideAll ? 'Show passage' : 'Hide passage',
  });
