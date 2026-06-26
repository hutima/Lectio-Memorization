  // ============================================================================
  // gamify.js — gentle gamification (class-body fragment; see core.js). Turns the
  // progress the app already keeps (practice history, streak, learned passages,
  // memorized verses) into experience points, a level + scriptural title, badges,
  // and the celebratory banners that appear on the first practice of a new day or
  // when a streak / level / badge milestone is reached.
  //
  // Everything here is DERIVED from the existing localStorage keys (history /
  // streak / progress / seen) — no new persisted counter — so a returning user is
  // scored from their real history and an import/restore stays consistent. The one
  // exception is `celebrate`, a transient bit of UI state set by markPracticed.
  // This file is a CLASS-BODY FRAGMENT — build.mjs concatenates it. See core.js.
  // ============================================================================

  // Cumulative XP thresholds, each with a scriptural title. Level = index + 1; the
  // gap to the next `min` drives the progress bar. Early levels come quickly so a
  // new memorizer sees movement in their first week, then the curve widens.
  GAME_LEVELS = [
    { min: 0, title: 'Seedling' },
    { min: 40, title: 'Hearer' },
    { min: 120, title: 'Sower' },
    { min: 260, title: 'Reader' },
    { min: 480, title: 'Scribe' },
    { min: 800, title: 'Student of the Word' },
    { min: 1250, title: 'Disciple' },
    { min: 1900, title: 'Steward' },
    { min: 2800, title: 'Teacher' },
    { min: 4000, title: 'Herald' },
    { min: 5600, title: 'Living Epistle' },
  ];

  // Badges — each a pure test over the derived stat object `g`. Memorized-verse
  // badges only light up where a full canon scan is available (the Progress view
  // passes verseStatus data); the rest read the light fields and so can also fire
  // a celebration the instant they're earned. Order = display order.
  GAME_BADGES = [
    { id: 'firstlight', icon: '✦', name: 'First Light', desc: 'Practised for the very first time', test: (g) => g.practices >= 1 },
    { id: 'streak3', icon: '🔥', name: 'Kindling', desc: 'Kept a 3-day streak', test: (g) => g.best >= 3 },
    { id: 'streak7', icon: '🔥', name: 'Faithful', desc: 'Kept a 7-day streak', test: (g) => g.best >= 7 },
    { id: 'streak30', icon: '☀️', name: 'Steadfast', desc: 'Kept a 30-day streak', test: (g) => g.best >= 30 },
    { id: 'streak100', icon: '👑', name: 'Devoted', desc: 'Kept a 100-day streak', test: (g) => g.best >= 100 },
    { id: 'learn1', icon: '📖', name: 'Treasured', desc: 'Learned your first passage', test: (g) => g.learned >= 1 },
    { id: 'learn5', icon: '📚', name: 'Well-Read', desc: 'Learned 5 passages', test: (g) => g.learned >= 5 },
    { id: 'learn20', icon: '🏛️', name: 'Living Library', desc: 'Learned 20 passages', test: (g) => g.learned >= 20 },
    { id: 'mem10', icon: '🌱', name: 'Hidden Word', desc: 'Memorized 10 verses', test: (g) => g.memorized >= 10 },
    { id: 'mem50', icon: '🌿', name: 'Flourishing', desc: 'Memorized 50 verses', test: (g) => g.memorized >= 50 },
    { id: 'mem150', icon: '🌾', name: 'Storehouse', desc: 'Memorized 150 verses', test: (g) => g.memorized >= 150 },
    { id: 'days30', icon: '📅', name: 'Habit of Grace', desc: 'Practised on 30 different days', test: (g) => g.days >= 30 },
    { id: 'practice250', icon: '⛰️', name: 'Persevering', desc: 'Logged 250 practice sessions', test: (g) => g.practices >= 250 },
  ];
  // Streak lengths worth a banner of their own.
  GAME_STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365];

  // The derived stat object. `data` is an optional verseStatus() result (passed in
  // the Progress view); without it, memorized/seen verse counts read 0 — fine for
  // the home banner and celebration, which don't depend on a full canon scan.
  gamify = (data) => {
    const hist = this.state.history || {};
    let practices = 0, days = 0;
    for (const k in hist) { const v = hist[k] || 0; if (v > 0) { practices += v; days++; } }
    const prog = this.state.progress || {};
    const learned = Object.keys(prog).filter((k) => { const p = prog[k]; return p.learned || (p.best || 0) >= this.MASTERY || (p.known || 0) >= this.MASTERY; }).length;
    const st = this.state.streak || { count: 0, best: 0 };
    const memorized = data ? data.doneN : 0;
    const seen = data ? data.seenN : 0;
    // XP: a point for every practice, a generous bonus per passage learned, and a
    // standing reward for the best streak ever reached (so a long streak keeps its
    // value even after a missed day resets the running count).
    const xp = practices * 8 + learned * 60 + (st.best || 0) * 12;
    const L = this.GAME_LEVELS; let li = 0;
    for (let i = 0; i < L.length; i++) if (xp >= L[i].min) li = i;
    const cur = L[li], nxt = L[li + 1] || null;
    const into = xp - cur.min;
    const span = nxt ? nxt.min - cur.min : Math.max(1, into);
    return {
      xp, practices, days, learned,
      count: st.count || 0, best: st.best || 0,
      memorized, seen,
      level: li + 1, title: cur.title, nextTitle: nxt ? nxt.title : null,
      into, span, pct: nxt ? Math.max(0, Math.min(1, into / span)) : 1,
      toNext: nxt ? nxt.min - xp : 0,
    };
  };
  // The set of badge ids earned for a given stat object — used both to render the
  // grid and to diff before/after a practice so a freshly earned badge celebrates.
  gamifyBadgeIds = (g) => this.GAME_BADGES.filter((b) => b.test(g)).map((b) => b.id);

  // ---------- celebration (transient banner) ----------
  // Called by markPracticed once the new history/streak state has settled. Compares
  // the snapshot taken before the practice against the now-current stats and, if a
  // milestone was crossed, sets `celebrate` so the home + practice views show a
  // dismissible banner. Priority: level-up > streak milestone > new badge > the
  // plain "first practice of the day" note.
  maybeCelebrate = (before, firstToday, advanced) => {
    const after = this.gamify();
    let payload = null;
    if (after.level > before.level) {
      payload = { icon: '⭐', title: 'Level ' + after.level + ' — ' + after.title, sub: 'A new title. Keep hiding his word in your heart.' };
    } else if (advanced && this.GAME_STREAK_MILESTONES.indexOf(after.count) !== -1) {
      payload = { icon: '🔥', title: after.count + '-day streak!', sub: firstToday ? 'First practice of the day. Well done — don’t break the chain.' : 'Well done — don’t break the chain.' };
    } else {
      const fresh = this.gamifyBadgeIds(after).filter((id) => before._badges.indexOf(id) === -1);
      if (fresh.length) {
        const b = this.GAME_BADGES.find((x) => x.id === fresh[0]);
        payload = { icon: b.icon, title: 'Badge earned · ' + b.name, sub: b.desc + '.' };
      } else if (firstToday) {
        payload = { icon: '🌅', title: 'First practice of the day', sub: (after.count || 1) + '-day streak going. Grace to you.' };
      }
    }
    if (payload) { payload.xp = after.xp; this.setState({ celebrate: payload }); }
  };
  dismissCelebrate = () => this.setState({ celebrate: null });

  // ---------- shared styling ----------
  // A small circular level chip (the number on an accent disc).
  levelChip = (level, size) => React.createElement('span', {
    style: { width: size + 'px', height: size + 'px', borderRadius: '50%', background: 'var(--accent)', color: '#fbf8f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontFamily: "'Gentium Book Plus',serif", fontWeight: 700, fontSize: Math.round(size * 0.42) + 'px', lineHeight: 1 },
  }, level);
  // The XP progress track, filled to g.pct.
  xpBar = (g, key) => {
    const h = React.createElement;
    return h('div', { key, style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
      h('div', { key: 'tr', style: { height: '8px', borderRadius: '5px', background: 'var(--surface2)', border: '1px solid var(--line)', overflow: 'hidden' } },
        h('div', { style: { width: Math.round(g.pct * 100) + '%', height: '100%', background: 'var(--accent)', borderRadius: '5px', transition: 'width .3s ease' } })),
      h('div', { key: 'lb', style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' } }, [
        h('span', { key: 'x' }, g.xp.toLocaleString() + ' XP'),
        h('span', { key: 'n' }, g.nextTitle ? g.toNext.toLocaleString() + ' XP to ' + g.nextTitle : 'Highest title reached'),
      ]),
    ]);
  };

  // ---------- home banner ----------
  // A compact card at the top of the home screen: level + title, XP bar, the streak
  // flame, and a daily nudge. Always shown (it's the at-a-glance reward state).
  renderHomeBanner = () => {
    const h = React.createElement; const g = this.gamify();
    const today = new Date().toISOString().slice(0, 10);
    const doneToday = (this.state.streak || {}).last === today;
    const flame = h('span', { key: 'fl', style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 700, color: g.count > 0 ? 'var(--accent)' : 'var(--muted)', whiteSpace: 'nowrap' } },
      h('span', { style: { fontSize: '15px', filter: g.count > 0 ? 'none' : 'grayscale(1)', opacity: g.count > 0 ? 1 : 0.6 } }, '🔥'),
      (g.count || 0) + '-day');
    const top = h('div', { key: 'top', style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
      this.levelChip(g.level, 40),
      h('div', { key: 'tt', style: { flex: 1, minWidth: 0 } }, [
        h('div', { key: 'a', style: { fontSize: '11px', color: 'var(--muted)', letterSpacing: '.5px', textTransform: 'uppercase' } }, 'Level ' + g.level),
        h('div', { key: 'b', style: { fontFamily: "'Gentium Book Plus',serif", fontWeight: 700, fontSize: '19px', lineHeight: 1.1 } }, g.title),
      ]),
      flame,
    ]);
    const nudge = h('div', { key: 'nudge', style: { fontSize: '12px', color: doneToday ? 'var(--accent)' : 'var(--muted)', fontWeight: doneToday ? 600 : 400 } },
      doneToday ? '✓ You’ve practised today — streak safe.' : 'Practise once today to keep your streak.');
    return h('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: '12px' } }, [top, this.xpBar(g, 'xpb'), nudge]);
  };

  // ---------- celebration banner ----------
  // The dismissible accent banner shown after a milestone practice. Rendered in both
  // the home and practice views; returns null when there's nothing to celebrate.
  renderCelebrate = () => {
    const c = this.state.celebrate; if (!c) return null;
    const h = React.createElement;
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: '13px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: '14px', padding: '13px 15px' } }, [
      h('span', { key: 'ic', style: { fontSize: '26px', flex: 'none', lineHeight: 1 } }, c.icon),
      h('div', { key: 'tx', style: { flex: 1, minWidth: 0 } }, [
        h('div', { key: 't', style: { fontWeight: 700, fontSize: '15px', color: 'var(--text)' } }, c.title),
        h('div', { key: 's', style: { fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.45, marginTop: '2px' } }, c.sub),
      ]),
      h('button', { key: 'x', onClick: this.dismissCelebrate, 'aria-label': 'Dismiss', style: { flex: 'none', width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', fontSize: '15px', cursor: 'pointer', touchAction: 'manipulation', lineHeight: 1 } }, '✕'),
    ]);
  };

  // ---------- Progress-view cards (level + badges) ----------
  // The fuller reward card on the Progress screen: level chip, title, XP bar, and a
  // line of headline numbers. `g` already carries memorized/seen from verseStatus.
  renderLevelCard = (g) => {
    const h = React.createElement;
    const stat = (value, label) => h('div', { key: label, style: { display: 'flex', flexDirection: 'column', gap: '1px' } }, [
      h('div', { key: 'v', style: { fontFamily: "'Gentium Book Plus',serif", fontWeight: 700, fontSize: '20px', color: 'var(--text)', lineHeight: 1.1 } }, value),
      h('div', { key: 'l', style: { fontSize: '11px', color: 'var(--muted)' } }, label),
    ]);
    return this.card([
      h('div', { key: 'top', style: { display: 'flex', alignItems: 'center', gap: '13px' } }, [
        this.levelChip(g.level, 46),
        h('div', { key: 'tt', style: { flex: 1, minWidth: 0 } }, [
          h('div', { key: 'a', style: { fontSize: '11px', color: 'var(--muted)', letterSpacing: '.5px', textTransform: 'uppercase' } }, 'Level ' + g.level + ' · ' + g.xp.toLocaleString() + ' XP'),
          h('div', { key: 'b', style: { fontFamily: "'Gentium Book Plus',serif", fontWeight: 700, fontSize: '23px', lineHeight: 1.1 } }, g.title),
        ]),
      ]),
      this.xpBar(g, 'xpb'),
      h('div', { key: 'stats', style: { display: 'flex', gap: '22px', flexWrap: 'wrap', paddingTop: '2px' } }, [
        stat(g.practices.toLocaleString(), g.practices === 1 ? 'practice' : 'practices'),
        stat(g.learned.toLocaleString(), 'learned'),
        stat(g.memorized.toLocaleString(), 'verses memorized'),
        stat(g.days.toLocaleString(), 'active days'),
      ]),
    ], 'levelcard');
  };
  // The badge wall: every badge, earned ones in accent and dimmed-until-earned ones
  // greyed, with a count of how many have been unlocked.
  renderBadges = (g) => {
    const h = React.createElement;
    const earnedIds = this.gamifyBadgeIds(g);
    const tiles = this.GAME_BADGES.map((b) => {
      const earned = earnedIds.indexOf(b.id) !== -1;
      return h('div', { key: b.id, title: b.desc + (earned ? '' : ' (locked)'), style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', textAlign: 'center', padding: '12px 8px', borderRadius: '13px', border: '1px solid ' + (earned ? 'var(--accent)' : 'var(--line)'), background: earned ? 'var(--accent-soft)' : 'var(--surface2)', opacity: earned ? 1 : 0.55 } }, [
        h('span', { key: 'ic', style: { fontSize: '26px', lineHeight: 1, filter: earned ? 'none' : 'grayscale(1)' } }, earned ? b.icon : '🔒'),
        h('div', { key: 'nm', style: { fontSize: '12px', fontWeight: 700, color: 'var(--text)' } }, b.name),
        h('div', { key: 'ds', style: { fontSize: '10.5px', color: 'var(--muted)', lineHeight: 1.35 } }, b.desc),
      ]);
    });
    return this.card([
      h('div', { key: 't', style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
        this.sectionTitle('BADGES'),
        h('span', { style: { fontSize: '12px', color: 'var(--muted)' } }, earnedIds.length + ' of ' + this.GAME_BADGES.length + ' earned')),
      h('div', { key: 'grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))', gap: '9px' } }, tiles),
    ], 'badgecard');
  };
