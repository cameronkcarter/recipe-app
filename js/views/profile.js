// Profile: picture, name, stats, a stamp calendar of what they cooked, and their recipes.
// #/me is whoever this device is "logged in" as; #/u/<id> is anyone's profile.
// No real accounts yet: "Log out" opens a menu to log in as someone else or make a new profile.
App.views = App.views || {};
App.views.profile = (root, { id } = {}) => {
  const U = App.util, S = App.store;
  let menu = false, adding = false, editing = false;

  function render() {
    const me = S.me();
    const p = id ? S.profile(id) : me;
    if (!p) { root.innerHTML = `<div class="empty"><p>Profile not found.</p><a href="#/me">Back to your profile</a></div>`; return; }
    const mine = p.id === me?.id;
    const log = S.cooksBy(p.id);
    const month = U.todayStr().slice(0, 7);
    const recipes = S.recipes().filter(r => r.author === p.id);

    root.innerHTML = `
      <header class="topbar">
        ${mine ? '<span class="title-sm"></span>' : `<a class="icon-btn" href="#/me" aria-label="Back">${App.glyph('back')}</a><span class="title-sm"></span>`}
        ${mine ? `<div class="who-menu">
          <button class="btn small" data-act="menu" aria-expanded="${menu}">${App.glyph('logout')}Log out</button>
          ${menu ? menuHtml(me) : ''}</div>` : ''}
      </header>

      <div class="prof-head">
        ${mine ? `<button class="avatar-btn" data-act="edit" aria-label="Change picture">${U.avatarHtml(p, 'xl')}<span class="badge">${App.glyph('pencil')}</span></button>` : U.avatarHtml(p, 'xl')}
        <h1>${U.esc(p.name)}</h1>
      </div>
      ${mine && editing ? editorHtml(p) : ''}

      <div class="stats">
        <div class="card stat"><div class="n">${log.length}</div><div class="l">meals cooked</div></div>
        <div class="card stat"><div class="n">${log.filter(l => l.date.startsWith(month)).length}</div><div class="l">this month</div></div>
        <div class="card stat"><div class="n">${recipes.length}</div><div class="l">recipes</div></div>
      </div>

      <div class="section-label"><span class="lab">${App.icon('cal')}Cook log</span></div>
      <div class="card stamp-wrap">${calendarHtml(log)}</div>

      <div class="section-label"><span class="lab">${App.icon('book')}${mine ? 'Your recipes' : `${U.esc(U.firstName(p))}'s recipes`}</span></div>
      ${recipes.length ? `<div class="recipe-grid">${recipes.map(App.ui.recipeCard).join('')}</div>`
        : `<div class="muted">No recipes yet.</div>`}

      ${mine && log.length ? `<div class="section-label">History</div>
        <ul class="card log-list">${log.map(historyRow).join('')}</ul>` : ''}`;

    // The calendar opens on the latest weeks; scroll left for older ones.
    const cal = root.querySelector('.stamp-cal');
    if (cal) cal.scrollLeft = cal.scrollWidth;
  }

  // "Log out" menu: log in as anyone else, or make a new profile.
  function menuHtml(me) {
    return `<div class="card who-list" role="menu">
      <div class="who-title">Log in as</div>
      ${S.profiles().map(q => `<button class="who ${q.id === me.id ? 'on' : ''}" data-login="${U.esc(q.id)}" role="menuitem">${U.avatarHtml(q)}<span>${U.esc(q.name)}</span>${q.id === me.id ? App.glyph('check') : ''}</button>`).join('')}
      ${adding
        ? `<form class="who-new" data-form="new"><input class="input" name="name" placeholder="Name" autocomplete="off" aria-label="Name"><button class="btn primary small">Add</button></form>`
        : `<button class="who" data-act="new" role="menuitem"><span class="avatar plus">${App.glyph('plus')}</span><span>New profile</span></button>`}
    </div>`;
  }

  // Your picture: tap it to change the name, the food, and the color.
  function editorHtml(p) {
    const foods = [...new Set(['avo', 'squash', 'onion', 'garlic', 'tomato', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berries', 'carrot', 'mushroom', 'broccoli', 'corn',
      'eggplant', 'bellpep', 'chili', 'spud', 'potato', 'pumpkin', 'egg', 'cheese', 'bread', 'toast', 'cookie', 'cake', 'muffin', 'pancake', 'friedegg', 'pot', 'ip', 'noodle', 'rice', 'tofu', 'dough'])];
    return `<div class="card icon-picker prof-edit">
      <input class="input" data-pf="name" value="${U.esc(p.name)}" aria-label="Name" autocomplete="off">
      <div class="swatches">${App.BLOB_COLORS.map(c => `<button class="sw ${c === p.color ? 'on' : ''}" data-color="${c}" style="--sw:${c}" aria-label="Color"></button>`).join('')}</div>
      ${foods.map(f => `<button data-avatar="${f}" class="${f === p.avatar ? 'on' : ''}" style="--blob:${p.color}" aria-label="${f}">${App.icon(f)}</button>`).join('')}
    </div>`;
  }

  // Stamp calendar: one column per week, a row per weekday, every day numbered.
  // A day you cooked gets that recipe's icon stamped on it. Scrolls sideways for older months.
  function calendarHtml(log) {
    const byDay = {};
    for (const l of log) (byDay[l.date] ||= []).push(l);
    const today = U.parseDate(U.todayStr());
    const oldest = log.length ? U.parseDate(log[log.length - 1].date) : today;
    const weeks = Math.max(26, Math.ceil((today - oldest) / 864e5 / 7) + 2);
    const start = new Date(today); start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const cols = [];
    for (let w = 0; w < weeks; w++) {
      const days = [];
      let label = '';
      for (let d = 0; d < 7; d++) {
        const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
        const k = U.dateStr(day), n = day.getDate();
        if (n === 1) label = MON[day.getMonth()];
        if (day > today) { days.push('<div class="day future"></div>'); continue; }
        const cooked = byDay[k];
        const cls = `day ${k === U.todayStr() ? 'today' : ''} ${day.getMonth() % 2 ? 'alt' : ''}`;
        if (!cooked) { days.push(`<div class="${cls}"><span>${n}</span></div>`); continue; }
        const r = S.recipe(cooked[0].recipeId);
        const tilt = ((n * 37) % 17) - 8; // each stamp lands a little crooked
        days.push(`<a class="${cls} stamped" ${r ? `href="#/r/${encodeURIComponent(r.id)}"` : ''} title="${U.esc(cooked.map(c => S.recipe(c.recipeId)?.title || 'Deleted recipe').join(', '))} · ${U.fmtDate(k)}">
          <span class="stamp" style="--blob:${U.esc(r ? U.recipeBlob(r) : '#ccc')};rotate:${tilt}deg">${App.icon(r ? U.recipeIcon(r) : 'cloche')}</span>
          ${cooked.length > 1 ? `<b>${cooked.length}</b>` : ''}</a>`);
      }
      cols.push(`<div class="wk"><div class="mo">${label}</div>${days.join('')}</div>`);
    }
    return `<div class="stamp-cal">
      <div class="wk dow"><div class="mo"></div>${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div class="day">${d}</div>`).join('')}</div>
      ${cols.join('')}</div>`;
  }

  const historyRow = l => {
    const r = S.recipe(l.recipeId);
    return `<li><span class="e">${App.icon(r ? U.recipeIcon(r) : 'cloche')}</span>
      <span class="t">${r ? `<a href="#/r/${encodeURIComponent(r.id)}">${U.esc(r.title)}</a>` : '<i>Deleted recipe</i>'}
      <div class="d">${U.fmtDate(l.date)}${l.mode === 'coop' ? ` · ${App.icon('people')}co-op` : ''}</div></span>
      <button class="x" data-del="${l.id}" aria-label="Remove entry">${App.glyph('x')}</button></li>`;
  };

  root.onclick = e => {
    const t = e.target.closest('[data-act], [data-login], [data-del], [data-avatar], [data-color]');
    if (!t) { if (menu && !e.target.closest('.who-menu')) { menu = adding = false; render(); } return; }
    const d = t.dataset;
    if (d.act === 'menu') { menu = !menu; adding = false; render(); }
    else if (d.act === 'new') { adding = true; render(); root.querySelector('.who-new input')?.focus(); }
    else if (d.act === 'edit') { editing = !editing; render(); }
    else if (d.login) { S.setMe(d.login); menu = adding = false; App.refreshNav?.(); render(); }
    else if (d.avatar) { S.updateProfile(S.me().id, { avatar: d.avatar }); App.refreshNav?.(); render(); }
    else if (d.color) { S.updateProfile(S.me().id, { color: d.color }); App.refreshNav?.(); render(); }
    else if (d.del) { if (confirm('Remove this entry?')) { S.deleteLog(d.del); render(); } }
  };
  root.onsubmit = e => {
    e.preventDefault();
    const name = e.target.querySelector('[name=name]').value.trim();
    if (!name) return;
    S.setMe(S.addProfile(name));
    menu = adding = false; editing = true; // straight to picking their picture
    App.refreshNav?.(); render();
  };
  root.onchange = e => {
    if (e.target.dataset.pf !== 'name') return;
    const name = e.target.value.trim();
    if (name) { S.updateProfile(S.me().id, { name }); render(); }
  };

  render();
};
