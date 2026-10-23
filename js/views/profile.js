// Profile: picture, name, stats, their recipes, and a History calendar of what they cooked.
// #/me is you. Logged out, it's the same page left blank, with Log in (pick your profile) and
// Make a profile (fill in the blank page). #/u/<id> is anyone's profile. No passwords yet.
App.views = App.views || {};
App.views.profile = (root, { id } = {}) => {
  const U = App.util, S = App.store;
  const FOODS = ['avo', 'squash', 'onion', 'garlic', 'tomato', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berries', 'carrot', 'mushroom', 'broccoli', 'corn',
    'eggplant', 'bellpep', 'chili', 'spud', 'potato', 'pumpkin', 'egg', 'cheese', 'bread', 'toast', 'cookie', 'cake', 'muffin', 'pancake', 'friedegg', 'pot', 'ip', 'noodle', 'rice', 'tofu', 'dough'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let draft = null;     // picture being edited, or the new profile being made: Save / Create keeps it
  let joining = false;  // logged out: filling in the blank profile
  let picking = false;  // logged out: the "Log in as" list is open
  let shown = 3;        // History: how many months are showing (newest first)
  let sel = null;       // History: the day you tapped

  function render() {
    const me = S.me();
    const guest = !id && !me;
    const saved = guest ? null : id ? S.profile(id) : me;
    if (!guest && !saved) { root.innerHTML = `<div class="empty"><p>Profile not found.</p><a href="#/me">Back to your profile</a></div>`; return; }
    const mine = !guest && saved.id === me?.id;
    const p = draft || saved;
    const log = guest ? [] : S.cooksBy(p.id);
    const recipes = guest ? [] : S.recipes().filter(r => r.author === p.id);
    if (!sel && !guest) sel = log.length ? log[0].date : mine ? U.todayStr() : null;
    const dash = n => guest ? '–' : n;

    root.innerHTML = `
      <header class="topbar">
        ${mine || guest ? '<span class="title-sm"></span>' : `<a class="icon-btn" href="#/me" aria-label="Back">${App.glyph('back')}</a><span class="title-sm"></span>`}
        ${mine ? `<button class="btn small" data-act="logout">${App.glyph('logout')}Log out</button>` : ''}
        ${guest && !joining ? `<button class="btn small primary" data-act="login" aria-expanded="${picking}">Log in</button>` : ''}
      </header>

      <div class="prof-head">
        ${mine ? `<button class="avatar-btn" data-act="edit" aria-label="Change picture">${U.avatarHtml(p, 'xl')}<span class="badge">${App.glyph('pencil')}</span></button>`
          : p ? U.avatarHtml(p, 'xl') : `<span class="avatar xl ghost">${App.icon('person')}</span>`}
        <h1 class="${p?.name ? '' : 'blank'}">${p?.name ? U.esc(p.name) : guest ? 'Not logged in' : ''}</h1>
        ${guest && !joining && !picking ? `<p class="muted">Log in to keep track of what you cook.</p>
          <button class="btn primary" data-act="join">${App.glyph('plus')}Make a profile</button>` : ''}
      </div>
      ${guest && picking ? loginListHtml() : ''}
      ${guest && joining ? `<form class="card icon-picker prof-edit" data-form="join">
        <input class="input" data-pf="name" value="${U.esc(draft.name)}" placeholder="Your name" aria-label="Your name" autocomplete="name">
        <div class="join-err" role="alert"></div>
        ${pictureHtml(draft)}
        <div class="edit-actions"><button type="button" class="btn small" data-act="cancel-join">Cancel</button><button class="btn primary small">Create profile</button></div>
      </form>` : ''}
      ${mine && draft ? `<div class="card icon-picker prof-edit">
        <input class="input" data-pf="name" value="${U.esc(draft.name)}" aria-label="Name" autocomplete="off">
        ${pictureHtml(draft)}
        <div class="edit-actions"><button class="btn small" data-act="cancel-edit">Cancel</button><button class="btn primary small" data-act="save-edit">Save</button></div>
      </div>` : ''}

      <div class="stats two ${guest ? 'blank' : ''}">
        <div class="card stat"><div class="n">${dash(log.length)}</div><div class="l">meals cooked</div></div>
        <div class="card stat"><div class="n">${dash(recipes.length)}</div><div class="l">recipes</div></div>
      </div>

      <h2 class="sec">${mine || guest ? 'Your recipes' : `${U.esc(U.firstName(p))}'s recipes`}</h2>
      ${recipes.length ? `<div class="recipe-grid">${recipes.map(App.ui.recipeCard).join('')}</div>`
        : `<div class="muted">${guest ? 'Your recipes will show up here.' : 'No recipes yet.'}</div>`}

      <h2 class="sec">History</h2>
      <div class="card history ${guest ? 'blank' : ''}">${historyHtml(log, mine)}</div>`;
  }

  // Logged out → Log in: pick your profile (or make one).
  function loginListHtml() {
    return `<div class="card who-list">
      <div class="who-title">Log in as</div>
      ${S.profiles().map(q => `<button class="who" data-login="${U.esc(q.id)}">${U.avatarHtml(q)}<span>${U.esc(q.name)}</span></button>`).join('')}
      <button class="who" data-act="join"><span class="avatar plus">${App.glyph('plus')}</span><span>Make a profile</span></button>
    </div>`;
  }

  // Food and color choices for a profile picture.
  const pictureHtml = p => `
    <div class="swatches">${App.BLOB_COLORS.map(c => `<button type="button" class="sw ${c === p.color ? 'on' : ''}" data-color="${c}" style="--sw:${c}" aria-label="Color"></button>`).join('')}</div>
    ${FOODS.map(f => `<button type="button" data-avatar="${f}" class="${f === p.avatar ? 'on' : ''}" style="--blob:${p.color}" aria-label="${f}">${App.icon(f)}</button>`).join('')}`;

  // After logging in (or signing up), go back to what you were doing, if something sent you here.
  function loggedIn(pid) {
    S.setMe(pid);
    draft = null; joining = picking = false; sel = null; shown = 3;
    App.refreshNav?.();
    const back = App.session.afterLogin;
    delete App.session.afterLogin;
    if (back && back !== location.hash) location.hash = back; else { render(); window.scrollTo(0, 0); }
  }

  // History: an ordinary month calendar, newest month on top; older months continue below
  // ("Show earlier months" adds more). A day they cooked gets that recipe's icon stamped on it;
  // tap it to see what was cooked. On your own profile any past day can be tapped, to log something
  // you cooked then or remove a wrong entry. Each month has its own soft color.
  function historyHtml(log, mine) {
    const byDay = {};
    for (const l of log) (byDay[l.date] ||= []).push(l);
    const today = U.parseDate(U.todayStr());
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MC = ['#5AAADB', '#E88AA8', '#82C25E', '#9B7BD4', '#F6C945', '#3BAA9C', '#F27B5B', '#5AAADB', '#F2A33A', '#9B7BD4', '#82C25E', '#E88AA8'];
    // How far back you can go: a year for your own calendar, or to the first cook if that's older.
    const first = log.length ? U.parseDate(log[log.length - 1].date) : today;
    const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1);
    const oldest = mine && yearAgo < first ? yearAgo : first;
    const total = (today.getFullYear() - oldest.getFullYear()) * 12 + today.getMonth() - oldest.getMonth() + 1;
    const count = Math.min(shown, total);

    const out = [];
    for (let i = 0; i < count; i++) {
      const m = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mc = MC[m.getMonth()];
      const cells = [];
      for (let b = 0; b < m.getDay(); b++) cells.push('<div class="day blank"></div>');
      const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let n = 1; n <= days; n++) {
        const day = new Date(m.getFullYear(), m.getMonth(), n), k = U.dateStr(day);
        if (day > today) { cells.push(`<div class="day future"><span>${n}</span></div>`); continue; }
        const cooked = byDay[k];
        const cls = `day ${k === U.todayStr() ? 'today' : ''} ${k === sel ? 'sel' : ''}`;
        if (!cooked) { cells.push(mine ? `<button class="${cls} open" data-day="${k}" aria-label="${U.fmtDate(k)}"><span>${n}</span></button>` : `<div class="${cls}"><span>${n}</span></div>`); continue; }
        const r = S.recipe(cooked[0].recipeId);
        const tilt = ((n * 37) % 17) - 8; // each stamp lands a little crooked
        cells.push(`<button class="${cls} stamped" data-day="${k}" aria-label="${U.fmtDate(k)}">
          <span class="stamp" style="--blob:${U.esc(r ? U.recipeBlob(r) : '#ccc')};rotate:${tilt}deg">${App.icon(r ? U.recipeIcon(r) : 'cloche')}</span>
          ${cooked.length > 1 ? `<b>${cooked.length}</b>` : ''}</button>`);
      }
      // What was cooked on the tapped day shows right under its month.
      const picked = sel && sel.startsWith(U.dateStr(m).slice(0, 7)) ? byDay[sel] || [] : null;
      out.push(`<section class="month" style="--mc:${mc}">
        <h3>${MONTHS[m.getMonth()]}${m.getFullYear() !== today.getFullYear() ? ' ' + m.getFullYear() : ''}</h3>
        <div class="cal-grid">${cells.join('')}</div>
        ${picked && (picked.length || mine) ? `<div class="day-detail">
          <div class="day-title">${U.fmtDate(sel)}</div>
          ${picked.length ? `<ul class="log-list">${picked.map(l => historyRow(l, mine)).join('')}</ul>` : `<div class="muted day-none">Nothing cooked this day.</div>`}
          ${mine ? addHtml() : ''}</div>` : ''}
      </section>`);
    }
    return `<div class="cal-dow">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<span>${d}</span>`).join('')}</div>
      ${out.join('')}
      ${count < total ? `<button class="btn small block" data-act="older">Show earlier months</button>` : ''}`;
  }

  // Log a recipe on the picked day.
  function addHtml() {
    const list = [...S.recipes()].sort((a, b) => a.title.localeCompare(b.title));
    return `<form class="day-add" data-form="log">
      <select class="input" name="recipe" aria-label="Recipe you cooked" required>
        <option value="">I cooked…</option>${list.map(r => `<option value="${U.esc(r.id)}">${U.esc(r.title)}</option>`).join('')}</select>
      <button class="btn primary small">${App.glyph('plus')}Add</button></form>`;
  }

  const historyRow = (l, mine) => {
    const r = S.recipe(l.recipeId);
    return `<li><span class="e">${App.icon(r ? U.recipeIcon(r) : 'cloche')}</span>
      <span class="t">${r ? `<a href="#/r/${encodeURIComponent(r.id)}">${U.esc(r.title)}</a>` : '<i>Deleted recipe</i>'}
      ${l.mode === 'coop' ? `<div class="d">${App.icon('people')}co-op</div>` : ''}</span>
      ${mine ? `<button class="x" data-del="${l.id}" aria-label="Remove entry">${App.glyph('x')}</button>` : ''}</li>`;
  };

  root.onclick = e => {
    const t = e.target.closest('[data-act], [data-login], [data-del], [data-avatar], [data-color], [data-day]');
    if (!t) return;
    const d = t.dataset;
    if (d.login) loggedIn(d.login);
    else if (d.act === 'login') { picking = !picking; render(); }
    else if (d.act === 'logout') { S.setMe(null); draft = null; sel = null; shown = 3; App.refreshNav?.(); render(); window.scrollTo(0, 0); }
    else if (d.act === 'join') { draft = { name: '', avatar: pick(FOODS.slice(0, 15)), color: pick(App.BLOB_COLORS) }; joining = true; picking = false; render(); root.querySelector('[data-pf=name]')?.focus(); }
    else if (d.act === 'cancel-join') { draft = null; joining = false; render(); }
    else if (d.act === 'edit') { draft = draft ? null : { ...S.me() }; render(); }
    else if (d.act === 'cancel-edit') { draft = null; render(); }
    else if (d.act === 'save-edit') {
      const { id: pid, ...rest } = draft;
      rest.name = rest.name.trim() || S.me().name;
      S.updateProfile(pid, rest); draft = null; App.refreshNav?.(); render();
    }
    else if (d.act === 'older') { shown += 3; render(); }
    else if (d.day) { sel = d.day; render(); }
    else if (d.avatar) { draft.avatar = d.avatar; render(); }
    else if (d.color) { draft.color = d.color; render(); }
    else if (d.del) { if (confirm('Remove this entry?')) { S.deleteLog(d.del); render(); } }
  };
  root.onsubmit = e => {
    e.preventDefault();
    const form = e.target.dataset.form;
    if (form === 'log') {
      const rid = e.target.querySelector('[name=recipe]').value;
      if (rid) { S.logCook(rid, 'solo', sel); navigator.vibrate?.(15); render(); }
    } else if (form === 'join') {
      const name = draft.name.trim();
      const taken = S.profiles().some(q => q.name.toLowerCase() === name.toLowerCase());
      const err = !name ? 'Type your name first.' : taken ? 'That name is taken. Log in instead, or add your last name.' : '';
      if (err) { e.target.querySelector('.join-err').textContent = err; e.target.querySelector('[data-pf=name]').focus(); return; }
      loggedIn(S.addProfile(name, draft.avatar, draft.color));
    }
  };
  // Typing a name fills it in on the profile right away.
  root.oninput = e => {
    if (e.target.dataset.pf !== 'name' || !draft) return;
    draft.name = e.target.value;
    const h = root.querySelector('.prof-head h1');
    if (joining && h) { h.textContent = draft.name.trim() || 'Not logged in'; h.classList.toggle('blank', !draft.name.trim()); }
    const err = root.querySelector('.join-err');
    if (err) err.textContent = '';
  };

  render();
};
