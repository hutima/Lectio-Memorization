  // ============================================================================
  // mode-bank.js — "Word bank" practice mode (class-body fragment; see core.js).
  //
  // Two sub-modes, chosen by the shared ease slider:
  //
  //  • Multiple choice (slider below max): navigate blanks with Prev/Next or by
  //    tapping any blank. Each focused blank offers ~5 options — the right word
  //    plus Datamuse "similar" distractors, biased to the same part of speech
  //    (offline fallback: other passage words). A correct tap turns green and
  //    auto-advances to the next unfilled blank; a wrong tap flashes red.
  //
  //  • Shuffled tray (slider at max = every word blank): the classic word bank,
  //    but the tray only holds the current and next verse's words so an all-blank
  //    chapter isn't overwhelming. Tap words to drop them into the next slot.
  // ============================================================================

  allBlank = () => (this.state.blankPct || 0) >= 0.999;

  // ---- multiple-choice sub-mode ----
  nextBlank = (vi) => { const b = this.state.blankList; const i = b.indexOf(vi); for (let j = i + 1; j < b.length; j++) if (this.state.bankChoice[b[j]] == null) return b[j]; return null; };
  ensureOptions = () => { const vi = this.state.bankActive; if (vi == null) return; this.loadOptions(vi); const nx = this.nextBlank(vi); if (nx != null) this.loadOptions(nx); };
  loadOptions = async (vi) => {
    if (vi == null || this.state.bankOpts[vi]) return;
    const lo = this._optLoading || (this._optLoading = {}); if (lo[vi]) return; lo[vi] = true;
    const p = this.state.passage; if (!p) return;
    const correct = p.words[vi].text; const seed = this.hash(p.reference + '|opt|' + vi);
    let opts;
    const sim = await this.fetchJson('https://api.datamuse.com/words?ml=' + encodeURIComponent(correct.toLowerCase()) + '&md=p&max=30');
    if (sim && sim.length) {
      const posData = await this.fetchJson('https://api.datamuse.com/words?sp=' + encodeURIComponent(correct.toLowerCase()) + '&md=p&max=1');
      const targetPos = posData && posData[0] ? this.posOf(posData[0].tags) : null;
      opts = this.buildOptions(correct, sim, targetPos, seed);
    } else {
      opts = this.buildOptions(correct, null, null, seed);
    }
    this.setState({ bankOpts: { ...this.state.bankOpts, [vi]: opts } });
  };
  // Assemble the option list: correct answer + up to 4 distractors, same part of
  // speech first, topped up from passage words, then shuffled (seeded, stable).
  buildOptions = (correct, sim, targetPos, seed) => {
    const cn = this.norm(correct); const seen = new Set([cn]); const cand = [];
    const push = (w) => { if (!w) return; const n = this.norm(w); if (!n || seen.has(n)) return; if (/\s/.test(w)) return; seen.add(n); cand.push(this.matchCase(correct, w)); };
    if (sim) {
      const same = [], other = [];
      sim.forEach((d) => { if (!d.word || /[^a-zA-Z'\-]/.test(d.word)) return; const pos = this.posOf(d.tags); (targetPos && pos === targetPos ? same : other).push(d.word); });
      same.forEach(push); other.forEach(push);
    }
    if (cand.length < 4) {
      const words = (this.state.passage.words || []).map((w) => w.text);
      const r = this.rng(seed ^ 0x51ed); const sh = words.slice();
      for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[sh[i], sh[j]] = [sh[j], sh[i]]; }
      sh.forEach((w) => { if (cand.length < 4) push(w); });
    }
    const all = [correct, ...cand.slice(0, 4)];
    const r = this.rng(seed);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[all[i], all[j]] = [all[j], all[i]]; }
    return all;
  };
  setBankActive = (vi) => this.setState({ bankActive: vi }, () => { this.ensureOptions(); this.scrollActive(); });
  bankPrev = () => { const b = this.state.blankList; const i = b.indexOf(this.state.bankActive); if (i > 0) this.setBankActive(b[i - 1]); };
  bankNext = () => { const b = this.state.blankList; const i = b.indexOf(this.state.bankActive); if (i >= 0 && i < b.length - 1) this.setBankActive(b[i + 1]); };
  selectBankOption = (vi, opt) => {
    const p = this.state.passage; if (!p) return;
    if (this.norm(opt) === this.norm(p.words[vi].text)) {
      const choice = { ...this.state.bankChoice, [vi]: opt }; const miss = { ...this.state.bankMiss }; delete miss[vi];
      const nx = this.nextBlank(vi);
      this.setState({ bankChoice: choice, bankMiss: miss, bankActive: nx != null ? nx : vi }, () => {
        if (nx != null) { this.ensureOptions(); this.scrollActive(); }
        this.checkBankMcDone();
      });
    } else {
      this.setState({ bankMiss: { ...this.state.bankMiss, [vi]: opt }, bankMisses: this.state.bankMisses + 1 });
    }
  };
  checkBankMcDone = () => {
    const b = this.state.blankList; if (!b.length || !b.every((vi) => this.state.bankChoice[vi] != null)) return;
    const total = b.length; this.recordResult(total / (total + this.state.bankMisses));
  };

  // ---- shuffled-tray sub-mode (every word blank) ----
  // Drop the tapped token into the first empty slot, in reading order.
  placeBank = (id) => {
    const blanks = this.state.blankList; const fill = { ...this.state.bankFill };
    const slot = blanks.find((vi) => fill[vi] == null); if (slot == null) return;
    fill[slot] = id; this.setState({ bankFill: fill }, () => { this.scrollActive(); this.checkBankDone(); });
  };
  unplace = (vi) => { const fill = { ...this.state.bankFill }; delete fill[vi]; this.setState({ bankFill: fill }); };
  checkBankDone = () => {
    const blanks = this.state.blankList; const p = this.state.passage; if (!p || !this.state.bank) return;
    if (!blanks.every((vi) => this.state.bankFill[vi] != null)) return;
    const correct = blanks.filter((vi) => this.norm(this.state.bank.items[this.state.bankFill[vi]].text) === this.norm(p.words[vi].text)).length;
    this.recordResult(correct / blanks.length);
  };
  // The tray only exposes tokens belonging to the current verse (the one holding the
  // next empty slot) and the verse after it, so an all-blank chapter stays manageable.
  trayWindow = () => {
    const st = this.state; const p = st.passage; if (!p || !st.bank) return [];
    const used = new Set(Object.values(st.bankFill).filter((x) => x != null));
    const firstSlot = st.blankList.find((vi) => st.bankFill[vi] == null);
    if (firstSlot == null) return [];
    const v0 = p.words[firstSlot].v;
    return st.bank.order
      .filter((id) => !used.has(id) && (p.words[st.bank.items[id].vi].v === v0 || p.words[st.bank.items[id].vi].v === v0 + 1))
      .map((id) => ({ text: st.bank.items[id].text, onClick: this.tapGuard('tray' + id, () => this.placeBank(id)) }));
  };

  // ---- shared rendering ----
  renderWord_bank = (s, key) => {
    const h = React.createElement; const vi = s.vi, text = s.text; const st = this.state;
    if (this.allBlank()) {
      const pid = st.bankFill[vi];
      if (pid == null) {
        const firstSlot = st.blankList.find((x) => st.bankFill[x] == null);
        const active = vi === firstSlot;
        return h('span', { key, 'data-active': active ? '1' : null, style: { display: 'inline-block', minWidth: (text.length * 0.6 + 0.8) + 'em', borderBottom: '2px ' + (active ? 'solid var(--accent)' : 'dashed var(--muted)'), background: active ? 'var(--accent-soft)' : 'transparent', borderRadius: active ? '4px 4px 0 0' : '0', color: 'transparent' } }, ' ');
      }
      const it = st.bank.items[pid]; const ok = this.norm(it.text) === this.norm(text);
      return h('span', { key, onClick: this.tapGuard('unp' + vi, () => this.unplace(vi)), title: 'tap to remove', style: { cursor: 'pointer', touchAction: 'manipulation', color: ok ? 'var(--good)' : 'var(--bad)', borderBottom: '2px solid ' + (ok ? 'var(--good)' : 'var(--bad)'), padding: '0 2px' } }, it.text);
    }
    const chosen = st.bankChoice[vi];
    if (chosen != null) return h('span', { key, onClick: this.tapGuard('re' + vi, () => this.setBankActive(vi)), title: 'tap to revisit', style: { cursor: 'pointer', touchAction: 'manipulation', color: 'var(--good)', borderBottom: '2px solid var(--good)', padding: '0 2px' } }, chosen);
    const active = vi === st.bankActive;
    return h('span', { key, 'data-active': active ? '1' : null, onClick: this.tapGuard('ba' + vi, () => this.setBankActive(vi)), style: { display: 'inline-block', minWidth: (text.length * 0.6 + 0.8) + 'em', cursor: 'pointer', touchAction: 'manipulation', borderBottom: '2px ' + (active ? 'solid var(--accent)' : 'dashed var(--muted)'), background: active ? 'var(--accent-soft)' : 'transparent', borderRadius: active ? '4px 4px 0 0' : '0', color: 'transparent', padding: '0 2px' } }, ' ');
  };

  // Footer control values for word-bank mode.
  vals_bank = () => {
    const st = this.state; const p = st.passage;
    const optBtn = { padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: "'Gentium Book Plus',serif", fontSize: '18px', cursor: 'pointer', touchAction: 'manipulation' };
    const wrongOpt = { borderColor: 'var(--bad)', background: 'var(--accent-soft)', color: 'var(--bad)' };
    const out = { isBank: st.mode === 'bank', bankTray: false, bankMc: false, bankItems: [], bankEmpty: true, bankOptions: [], optionsLoading: false, bankActiveLabel: '', bankStatus: '', bankAtStart: true, bankAtEnd: true, bankPrev: this.bankPrev, bankNext: this.bankNext, bankTrayBtn: { padding: '7px 13px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontFamily: "'Gentium Book Plus',serif", fontSize: '17px', cursor: 'pointer', touchAction: 'manipulation' } };
    if (!p || st.mode !== 'bank') return out;

    if (this.allBlank()) {
      out.bankTray = true;
      out.bankItems = this.trayWindow();
      out.bankEmpty = out.bankItems.length === 0;
      const total = st.blankList.length;
      const filled = st.blankList.filter((vi) => st.bankFill[vi] != null).length;
      if (filled < total) out.bankStatus = filled + ' / ' + total + ' placed';
      else { const correct = st.blankList.filter((vi) => st.bank && this.norm(st.bank.items[st.bankFill[vi]].text) === this.norm(p.words[vi].text)).length; out.bankStatus = correct + ' / ' + total + ' correct'; }
      return out;
    }

    out.bankMc = true;
    const vi = st.bankActive; const idx = st.blankList.indexOf(vi);
    out.bankAtStart = idx <= 0; out.bankAtEnd = idx < 0 || idx >= st.blankList.length - 1;
    out.bankActiveLabel = vi != null ? 'Blank ' + (idx + 1) + ' of ' + st.blankList.length : '';
    const opts = vi != null ? st.bankOpts[vi] : null;
    out.optionsLoading = vi != null && st.bankChoice[vi] == null && !opts;
    if (vi != null && opts && st.bankChoice[vi] == null) {
      out.bankOptions = opts.map((o) => ({ text: o, onClick: this.tapGuard('opt' + vi + '|' + o, () => this.selectBankOption(vi, o)), style: { ...optBtn, ...(st.bankMiss[vi] != null && this.norm(st.bankMiss[vi]) === this.norm(o) ? wrongOpt : {}) } }));
    }
    const done = st.blankList.filter((x) => st.bankChoice[x] != null).length;
    out.bankStatus = done + ' / ' + st.blankList.length + ' filled' + (st.bankMisses ? ' · ' + st.bankMisses + ' slips' : '');
    return out;
  };
