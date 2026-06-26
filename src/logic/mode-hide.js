  // ============================================================================
  // mode-hide.js — "Hide & reveal" practice mode (class-body fragment; see core.js).
  // Progressively hide every word; tap a hidden word to peek. The Hide/Show toggle is
  // the only control — hiding the passage (to recite) counts as practice for the day.
  // ============================================================================

  // Hiding the passage marks the day practiced (this used to ride on the removed
  // "Reveal all" button); showing it again is a no-op for the streak. Toggling
  // hide/show keeps any peeked words revealed — the Clear button re-hides them, so
  // you can reveal the whole passage to check yourself and step back into your peeks.
  toggleHideAll = () => { const on = !this.state.hideAll; this.setState({ hideAll: on }); if (on) this.markPracticed(); };
  // Tap a hidden word to peek; tap a revealed word to hide it again.
  toggleWord = (vi) => { const r = { ...this.state.revealed }; if (r[vi]) delete r[vi]; else r[vi] = true; this.setState({ revealed: r }); };
  // Re-hide every peeked word without leaving hide mode.
  clearRevealed = () => this.setState({ revealed: {} });
  // Before the whole passage is hidden, tap a word to hide just that one (the inverse
  // of fill mode's tap-to-reveal): build up the words to recite a few at a time. Hiding
  // your first word counts as practice for the day, like the Hide-passage button does.
  toggleHideWord = (vi) => {
    const hdn = { ...this.state.hidden }; const first = !Object.keys(this.state.hidden).length;
    if (hdn[vi]) delete hdn[vi]; else { hdn[vi] = true; if (first) this.markPracticed(); }
    this.setState({ hidden: hdn });
  };
  // Show every individually-hidden word again (without hiding the whole passage).
  clearHidden = () => this.setState({ hidden: {} });
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

  // Hidden-word chrome (transparent text on a soft block) — shared by the whole-passage
  // peek state and the individually-hidden words, so a hidden word looks the same either way.
  hideChrome = { background: 'var(--accent-soft)', color: 'transparent', borderRadius: '4px', padding: '0 2px', boxShadow: 'inset 0 -1px 0 var(--line)' };
  renderWord_hide = (s, key) => {
    const h = React.createElement; const vi = s.vi, text = s.text; const st = this.state;
    if (!st.hideAll) {
      // Passage shown: tap a word to hide it, tap a hidden word to show it again.
      if (st.hidden[vi]) return h('span', { key, onClick: this.tapGuard('hid' + vi, () => this.toggleHideWord(vi)), title: 'tap to show', style: { cursor: 'pointer', touchAction: 'manipulation', ...this.hideChrome } }, text);
      return h('span', { key, onClick: this.tapGuard('hid' + vi, () => this.toggleHideWord(vi)), title: 'tap to hide', style: { cursor: 'pointer', touchAction: 'manipulation' } }, text);
    }
    if (st.revealed[vi]) return h('span', { key, onClick: this.tapGuard('rev' + vi, () => this.toggleWord(vi)), title: 'tap to hide', style: { cursor: 'pointer', touchAction: 'manipulation', color: 'var(--accent)' } }, text);
    return h('span', { key, onClick: this.tapGuard('rev' + vi, () => this.toggleWord(vi)), title: 'tap to peek', style: { cursor: 'pointer', touchAction: 'manipulation', ...this.hideChrome } }, text);
  };

  // Footer control values for hide mode. "Clear peeks" applies when the passage is hidden
  // (re-hides peeked words); "Show all words" applies when it's shown (clears the words you
  // tapped to hide). The hint flips to match which tap gesture is active.
  vals_hide = () => ({
    isHide: this.state.mode === 'hide',
    toggleHideAll: this.toggleHideAll,
    hideToggleLabel: this.state.hideAll ? 'Show passage' : 'Hide passage',
    clearRevealed: this.clearRevealed,
    hasRevealed: this.state.hideAll && Object.keys(this.state.revealed).length > 0,
    clearHidden: this.clearHidden,
    hasHidden: !this.state.hideAll && Object.keys(this.state.hidden).length > 0,
    hideHintText: this.state.hideAll ? 'Tap a word to peek.' : 'Tap a word to hide it.',
  });
