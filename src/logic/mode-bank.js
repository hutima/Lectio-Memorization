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
    // Greek text: the Datamuse lookups and the English POS pool are meaningless here, so
    // draw decoys from real Greek lexemes (same-case where possible) instead — and skip
    // the network round-trip entirely.
    if (this.isGreek(correct)) { this.setState({ bankOpts: { ...this.state.bankOpts, [vi]: this.buildGreekOptions(vi, correct, seed) } }); return; }
    const q = encodeURIComponent(correct.toLowerCase());
    // The two Datamuse lookups (similar words + part of speech) race a single ~2s
    // deadline in parallel — not back to back — so a slow or blocked network can't
    // hold the "Finding similar words…" spinner for long. Whatever hasn't answered
    // by then is dropped and buildOptions falls back to the offline POS dictionary.
    const [sim, posData] = await Promise.all([
      this.fetchJson('https://api.datamuse.com/words?ml=' + q + '&md=pf&max=30', 2000),
      this.fetchJson('https://api.datamuse.com/words?sp=' + q + '&md=p&max=1', 2000),
    ]);
    const targetPos = posData && posData[0] ? this.posOf(posData[0].tags) : null;
    const opts = this.buildOptions(correct, (sim && sim.length ? sim : null), targetPos, seed);
    this.setState({ bankOpts: { ...this.state.bankOpts, [vi]: opts } });
  };
  // Assemble the option list: correct answer + up to 4 distractors, same part of
  // speech first. Sources, in order: Datamuse "similar" words filtered to the same POS
  // and a sane frequency (no junk/archaic forms), then the curated offline POS pool,
  // then any leftover (cross-POS) Datamuse words, then other passage words — so a
  // function word like "your" draws {thou, thy, his, our…} instead of "elr"/"per".
  // Finally shuffled.
  buildOptions = (correct, sim, targetPos, seed) => {
    const cn = this.norm(correct); const seen = new Set([cn]); const cand = [];
    const push = (w) => { if (!w) return; const n = this.norm(w); if (!n || seen.has(n)) return; if (/\s/.test(w)) return; seen.add(n); cand.push(this.matchCase(correct, w)); };
    const pos = targetPos || this.localPos(correct);
    const other = [];
    if (sim) {
      const same = [];
      sim.forEach((d) => { if (!d.word || /[^a-zA-Z'\-]/.test(d.word)) return; if (this.freqOf(d.tags) < this.MIN_OPT_FREQ) return; const p = this.posOf(d.tags); (pos && p === pos ? same : other).push(d.word); });
      same.forEach(push);
    }
    if (cand.length < 4) {
      const pool = this.posPool(pos).slice(); const r = this.rng(seed ^ 0x1f3b);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
      pool.forEach((w) => { if (cand.length < 4) push(w); });
    }
    if (cand.length < 4) other.forEach((w) => { if (cand.length < 4) push(w); });
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

  // ---- Greek option building ----
  // True if the word is written in Greek script (Greek NT, or a Greek-language creed
  // like the Lord's Prayer). English "similar word" distractors don't make sense for
  // these, so we build Greek decoys instead. Covers the Greek block (incl. bare
  // consonants/vowels like θ, α) and the polytonic Greek Extended block.
  isGreek = (w) => /[Ͱ-Ͽἀ-῿]/.test(w || '');
  // A compact pool of high-frequency Koine lexemes spanning the cases/numbers, so a
  // Greek blank can be offered plausible same-inflection decoys even when the passage
  // itself is short. Real NT forms; accents only affect display (ranking/dedup fold
  // them away), so a stray accent never makes a decoy count as correct.
  GREEK_POOL = ('ὁ ἡ τό οἱ αἱ τά τοῦ τῆς τῶν τῷ τῇ τόν τήν τούς τάς καί δέ γάρ ἀλλά οὖν τε ἤ ὡς ὅτι ἵνα '
    + 'ἐν εἰς ἐκ ἀπό διά κατά μετά πρός ἐπί ὑπό περί παρά ἐγώ σύ ἡμεῖς ὑμεῖς αὐτός αὐτοῦ αὐτῷ αὐτόν '
    + 'οὗτος ἐμοῦ μου σου ἡμῶν ὑμῶν ἡμῖν ὑμῖν θεός θεοῦ θεῷ θεόν κύριος κυρίου κυρίῳ κύριον ἄνθρωπος '
    + 'ἀνθρώπου λόγος λόγου υἱός υἱοῦ πατήρ πατρός πνεῦμα πνεύματος οὐρανός οὐρανοῦ οὐρανοῖς βασιλεία '
    + 'βασιλείας γῆ γῆς ἡμέρα ἡμέρας κόσμος κόσμου χάρις χάριτος ἀγάπη ἀγάπης πίστις πίστεως ζωή ζωήν '
    + 'ζωῆς ὄνομα ὀνόματος ἁμαρτία ἁμαρτίας ἁμαρτιῶν ἐστιν εἰμί ἦν ἔχει λέγει εἶπεν ποιεῖ ἐγένετο '
    + 'ἔρχεται οἶδα γινώσκει ἀγαπᾷ πιστεύει δίδωσιν').split(' ');
  // Five options for a Greek blank: the answer plus four decoys drawn from other words
  // in the passage and the lexeme pool, ranked so they share the target's ending (its
  // case/number inflection) — last two letters first, then last letter — with similar
  // length as a tie-break. Diacritics are folded for matching (via norm) but the
  // original accented form is shown.
  buildGreekOptions = (vi, correct, seed) => {
    const cg = this.norm(correct); const seen = new Set([cg]); const cand = [];
    const add = (w) => { const g = this.norm(w); if (!g || seen.has(g)) return; seen.add(g); cand.push({ text: w, g }); };
    (this.state.passage.words || []).forEach((w) => { if (w.vi !== vi) add(w.text); });
    this.GREEK_POOL.forEach(add);
    const ce2 = cg.slice(-2), ce1 = cg.slice(-1), cl = cg.length; const r = this.rng(seed);
    const tier = (g) => (g.length >= 2 && ce2 && g.slice(-2) === ce2) ? 2 : (g.slice(-1) === ce1 ? 1 : 0);
    cand.forEach((c) => { c.t = tier(c.g); c.k = r(); });
    cand.sort((a, b) => b.t - a.t || Math.abs(a.g.length - cl) - Math.abs(b.g.length - cl) || a.k - b.k);
    const all = [correct, ...cand.slice(0, 4).map((c) => c.text)];
    const r2 = this.rng(seed ^ 0x9e37);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1));[all[i], all[j]] = [all[j], all[i]]; }
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
  // The tray only exposes words the current verse (the one holding the next empty
  // slot) and the verse after it still need, so an all-blank chapter stays
  // manageable. Tiles are fungible by text (case-insensitive): a word is offered as
  // long as some unfilled slot in the window needs it, and ANY unused tile of that
  // text satisfies it — so a duplicate word from a different position is never
  // stranded out of the visible window.
  trayWindow = () => {
    const st = this.state; const p = st.passage; if (!p || !st.bank) return [];
    const firstSlot = st.blankList.find((vi) => st.bankFill[vi] == null);
    if (firstSlot == null) return [];
    const v0 = p.words[firstSlot].v;
    const need = {};
    st.blankList.forEach((vi) => {
      if (st.bankFill[vi] != null) return;
      if (p.words[vi].v !== v0 && p.words[vi].v !== v0 + 1) return;
      const n = this.norm(p.words[vi].text); need[n] = (need[n] || 0) + 1;
    });
    const used = new Set(Object.values(st.bankFill).filter((x) => x != null));
    const shown = {}; const out = [];
    st.bank.order.forEach((id) => {
      if (used.has(id)) return;
      const n = this.norm(st.bank.items[id].text);
      if (!need[n] || (shown[n] || 0) >= need[n]) return;
      shown[n] = (shown[n] || 0) + 1;
      out.push({ text: st.bank.items[id].text, onClick: this.tapGuard('tray' + id, () => this.placeBank(id)) });
    });
    return out;
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
    const optBtn = { padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: this.scriptFont(), fontSize: '18px', cursor: 'pointer', touchAction: 'manipulation' };
    const wrongOpt = { borderColor: 'var(--bad)', background: 'var(--accent-soft)', color: 'var(--bad)' };
    const out = { isBank: st.mode === 'bank', bankTray: false, bankMc: false, bankItems: [], bankEmpty: true, bankOptions: [], optionsLoading: false, bankActiveLabel: '', bankStatus: '', bankAtStart: true, bankAtEnd: true, bankPrev: this.bankPrev, bankNext: this.bankNext, bankTrayBtn: { padding: '7px 13px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontFamily: this.scriptFont(), fontSize: '17px', cursor: 'pointer', touchAction: 'manipulation' } };
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
