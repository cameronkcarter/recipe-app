// Profile: picture, name, stats, their recipes, and a History calendar of what they cooked.
// #/me is you — or, when logged out, the Log in screen ("Who's cooking?") with New profile sign-up.
// #/u/<id> is anyone's profile. No passwords yet: logging in means picking your profile.
App.views = App.views || {};
App.views.profile = (root, { id } = {}) => {
  const U = App.util, S = App.store;
  const FOODS = ['avo', 'squash', 'onion', 'garlic', 'tomato', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berries', 'carrot', 'mushroom', 'broccoli', 'corn',
    'eggplant', 'bellpep', 'chili', 'spud', 'potato', 'pumpkin', 'egg', 'cheese', 'bread', 'toast', 'cookie', 'cake', 'muffin', 'pancake', 'friedegg', 'pot', 'ip', 'noodle', 'rice', 'tofu', 'dough'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let draft = null;   // picture being edited (or the new profile being made): Save / Create keeps it
  let join = 0;       // sign-up step: 0 = not signing up, 1 = name, 2 = picture
  let page = 0;       // History: 0 = the latest weeks, 1 = the weeks before…
  let sel = null;     // History: the day you tapped

  function render() {
    const me = S.me();
    if (!id && !me) { root.innerHTML = join ? joinHtml() : loginHtml(); return; }
    const saved = id ? S.profile(id) : me;
    if (!saved) { root.innerHTML = `<div class="empty"><p>Profile not found.</p><a href="#/me">Back to your profile</a></div>`; return; }
    const mine = saved.id === me?.id;
    const p = mine && draft ? draft : saved;
    const log = S.cooksBy(p.id);
    const month = U.todayStr().slice(0, 7);
    const recipes = S.recipes().filter(r => r.author === p.id);
    if (!sel) sel = log.length ? log[0].date : mine ? U.todayStr() : null;

    root.innerHTML = `
      <header class="topbar">
        ${mine ? '<span class="title-sm"></span>' : `<a class="icon-btn" href="#/me" aria-label="Back">${App.glyph('back')}</a><span class="title-sm"></span>`}
        ${mine ? `<button class="btn small" data-act="logout">${App.glyph('logout')}Log out</button>` : ''}
      </header>

      <div class="prof-head">
        ${mine ? `<button class="avatar-btn" data-act="edit" aria-label="Change picture">${U.avatarHtml(p, 'xl')}<span class="badge">${App.glyph('pencil')}</span></button>` : U.avatarHtml(p, 'xl')}
        <h1>${U.esc(p.name)}</h1>
      </div>
      ${mine && draft ? `<div class="card icon-picker prof-edit">
        <input class="input" data-pf="name" value="${U.esc(draft.name)}" aria-label="Name" autocomplete="off">
        ${pictureHtml(draft)}
        <div class="edit-actions"><button class="btn small" data-act="cancel-edit">Cancel</button><button class="btn primary small" data-act="save-edit">Save</button></div>
      </div>` : ''}

      <div class="stats two">
        <div class="card stat"><div class="n">${log.length}</div><div class="l">meals cooked</div></div>
        <div class="card stat"><div class="n">${log.filter(l => l.date.startsWith(month)).length}</div><div class="l">this month</div></div>
      </div>

      <div class="section-label"><span class="lab">${App.icon('book')}${mine ? 'Your recipes' : `${U.esc(U.firstName(p))}'s recipes`}<span class="count">${recipes.length}</span></span></div>
      ${recipes.length ? `<div class="recipe-grid">${recipes.map(App.ui.recipeCard).join('')}</div>`
        : `<div class="muted">No recipes yet.</div>`}

      <div class="section-label"><span class="lab">${App.icon('cal')}History</span></div>
      <div class="card history">${historyHtml(log, mine)}</div>`;
  }

  // Logged out: pick your profile to log in, or make a new one.
  function loginHtml() {
    return `<header class="topbar"><h1>Log in</h1></header>
      <div class="card login">
        <div class="login-hero">${App.icon('pot')}</div>
        <h2>Who's cooking?</h2>
        <div class="who-grid">
          ${S.profiles().map(q => `<button class="who-tile" data-login="${U.esc(q.id)}">${U.avatarHtml(q, 'lg')}<span>${U.esc(q.name)}</span></button>`).join('')}
          <button class="who-tile new" data-act="join"><span class="avatar lg plus">${App.glyph('plus')}</span><span>New profile</span></button>
        </div>
      </div>`;
  }

  // New profile, two quick steps: your name, then your picture.
  function joinHtml() {
    const dots = `<div class="steps-dots"><i class="${join === 1 ? 'on' : ''}"></i><i class="${join === 2 ? 'on' : ''}"></i></div>`;
    return `<header class="topbar"><button class="icon-btn" data-act="join-back" aria-label="Back">${App.glyph('back')}</button><span class="title-sm">New profile</span></header>
      <div class="card login join">
        ${dots}
        ${U.avatarHtml(draft, 'xl')}
        ${join === 1 ? `<h2>What's your name?</h2>
          <form class="join-form" data-form="join-name">
            <input class="input" name="name" value="${U.esc(draft.name)}" placeholder="Your name" autocomplete="name" aria-label="Your name" enterkeyhint="next">
            <div class="join-err" role="alert"></div>
            <button class="btn primary block">Next</button>
          </form>`
        : `<h2>Hi, ${U.esc(U.firstName(draft))}! Pick your picture</h2>
          <div class="icon-picker">${pictureHtml(draft)}</div>
          <button class="btn primary block" data-act="create">Create profile</button>`}
      </div>`;
  }

  // Food and color choices for a profile picture.
  const pictureHtml = p => `
    <div class="swatches">${App.BLOB_COLORS.map(c => `<button class="sw ${c === p.color ? 'on' : ''}" data-color="${c}" style="--sw:${c}" aria-label="Color"></button>`).join('')}</div>
    ${FOODS.map(f => `<button data-avatar="${f}" class="${f === p.avatar ? 'on' : ''}" style="--blob:${p.color}" aria-label="${f}">${App.icon(f)}</button>`).join('')}`;

  // After logging in (or signing up), go back to what you were doing, if something sent you here.
  function loggedIn(pid) {
    S.setMe(pid);
    draft = null; join = 0; sel = null; page = 0;
    App.refreshNav?.();
    const back = App.session.afterLogin;
    delete App.session.afterLogin;
    if (back && back !== location.hash) location.hash = back; else render();
  }

  // History: a few weeks of days (as many as fit the screen), every day numbered.
  // A day they cooked gets that recipe's icon stamped on it; tap it to see what was cooked. Arrows page back in time.
  // On your own profile every day can be tapped, so you can log something you cooked then, or remove a wrong entry.
  function historyHtml(log, mine) {
    const byDay = {};
    for (const l of log) (byDay[l.date] ||= []).push(l);
    const weeks = Math.max(5, Math.floor((Math.min(root.clientWidth || 400, 640) - 32 - 64) / 37));
    const today = U.parseDate(U.todayStr());
    const start = new Date(today); start.setDate(start.getDate() - start.getDay() - (weeks - 1 + page * weeks) * 7);
    const end = new Date(start); end.setDate(start.getDate() + weeks * 7 - 1);
    // You can page back up to a year (or to your first entry, if that's older).
    const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1);
    const first = log.length ? U.parseDate(log[log.length - 1].date) : today;
    const oldest = mine && yearAgo < first ? yearAgo : first;
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const lastDay = end > today ? today : end;
    const range = start.getMonth() === lastDay.getMonth() ? `${MON[start.getMonth()]} ${start.getFullYear()}`
      : `${MON[start.getMonth()]} – ${MON[lastDay.getMonth()]} ${lastDay.getFullYear()}`;

    const cols = [];
    for (let w = 0; w < weeks; w++) {
      const days = [];
      let label = '';
      for (let d = 0; d < 7; d++) {
        const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
        const k = U.dateStr(day), n = day.getDate();
        if (n === 1 || (w === 0 && d === 0)) label = MON[day.getMonth()];
        if (day > today) { days.push('<div class="day future"></div>'); continue; }
        const cooked = byDay[k];
        const cls = `day ${k === U.todayStr() ? 'today' : ''} ${day.getMonth() % 2 ? 'alt' : ''} ${k === sel ? 'sel' : ''}`;
        if (!cooked) { days.push(mine ? `<button class="${cls} open" data-day="${k}" aria-label="${U.fmtDate(k)}"><span>${n}</span></button>` : `<div class="${cls}"><span>${n}</span></div>`); continue; }
        const r = S.recipe(cooked[0].recipeId);
        const tilt = ((n * 37) % 17) - 8; // each stamp lands a little crooked
        days.push(`<button class="${cls} stamped" data-day="${k}" aria-label="${U.fmtDate(k)}">
          <span class="stamp" style="--blob:${U.esc(r ? U.recipeBlob(r) : '#ccc')};rotate:${tilt}deg">${App.icon(r ? U.recipeIcon(r) : 'cloche')}</span>
          ${cooked.length > 1 ? `<b>${cooked.length}</b>` : ''}</button>`);
      }
      cols.push(`<div class="wk"><div class="mo">${label}</div>${days.join('')}</div>`);
    }

    const picked = (sel && byDay[sel]) || [];
    return `<div class="hist-nav">
        <button class="icon-btn sm" data-act="older" aria-label="Earlier weeks" ${start <= oldest ? 'disabled' : ''}>${App.glyph('back')}</button>
        <span>${range}</span>
        <button class="icon-btn sm flip" data-act="newer" aria-label="Later weeks" ${page ? '' : 'disabled'}>${App.glyph('back')}</button>
      </div>
      <div class="stamp-cal">
        <div class="wk dow"><div class="mo"></div>${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div class="day">${d}</div>`).join('')}</div>
        ${cols.join('')}</div>
      ${sel && (picked.length || mine) ? `<div class="day-title">${U.fmtDate(sel)}</div>
        ${picked.length ? `<ul class="log-list">${picked.map(l => historyRow(l, mine)).join('')}</ul>` : `<div class="muted day-none">Nothing cooked this day.</div>`}
        ${mine ? addHtml() : ''}` : ''}`;
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
    else if (d.act === 'logout') { S.setMe(null); draft = null; sel = null; page = 0; App.refreshNav?.(); render(); window.scrollTo(0, 0); }
    else if (d.act === 'join') { draft = { name: '', avatar: pick(FOODS.slice(0, 15)), color: pick(App.BLOB_COLORS) }; join = 1; render(); root.querySelector('[name=name]')?.focus(); }
    else if (d.act === 'join-back') { if (join === 2) join = 1; else { join = 0; draft = null; } render(); }
    else if (d.act === 'create') loggedIn(S.addProfile(draft.name.trim(), draft.avatar, draft.color));
    else if (d.act === 'edit') { draft = draft ? null : { ...S.me() }; render(); }
    else if (d.act === 'cancel-edit') { draft = null; render(); }
    else if (d.act === 'save-edit') {
      const { id: pid, ...rest } = draft;
      rest.name = rest.name.trim() || S.me().name;
      S.updateProfile(pid, rest); draft = null; App.refreshNav?.(); render();
    }
    else if (d.act === 'older') { page++; render(); }
    else if (d.act === 'newer') { page = Math.max(0, page - 1); render(); }
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
    } else if (form === 'join-name') {
      const name = e.target.querySelector('[name=name]').value.trim();
      const taken = S.profiles().some(q => q.name.toLowerCase() === name.toLowerCase());
      const err = !name ? 'Type your name first.' : taken ? 'That name is taken. Log in instead, or add your last name.' : '';
      if (err) { e.target.querySelector('.join-err').textContent = err; return; }
      draft.name = name; join = 2; render();
    }
  };
  root.oninput = e => {
    if (e.target.dataset.pf === 'name' && draft) draft.name = e.target.value;
    if (e.target.name === 'name' && join === 1) { draft.name = e.target.value; e.target.form.querySelector('.join-err').textContent = ''; }
  };

  render();
};
