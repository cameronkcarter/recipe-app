// Shared UI pieces: bottom sheet, timers, screen wake lock, step rendering, notes.
window.App = window.App || {};
App.ui = {};
(() => {
  const U = App.util;

  // ---------- Bottom sheet ----------
  App.ui.sheet = (html, onMount, onClose) => {
    const back = document.createElement('div');
    back.className = 'sheet-back';
    back.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
    let closed = false;
    const close = () => { if (closed) return; closed = true; back.remove(); onClose && onClose(); };
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    document.body.appendChild(back);
    onMount && onMount(back.querySelector('.sheet'), close);
    return close;
  };

  // ---------- Recipe card (recipe book, search, someone's recipes) ----------
  // Photo (or the drawn cover: its color, dots, and its icon on a plate) and name; along the bottom, time on the right and — on someone else's recipe — the heart
  // (save it to your recipe book) with the cook's first name. Saved recipes are tinted rose, yours stay plain.
  // extra: optional html under the name (a "Missing 2" line in What can I make?)
  App.ui.recipeCard = (r, extra) => {
    const S = App.store, tags = U.tagIcons(r);
    const mine = r.author && r.author === S.me()?.id;
    const saved = !mine && S.isSaved(r.id);
    const by = mine ? null : S.profile(r.author);
    return `<a class="card recipe-card ${saved ? 'saved' : ''}" href="#/r/${U.recipeKey(r)}">
      ${App.photos.coverHtml(r, 'card')}
      ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag-ico" title="${t.label}">${App.icon(t.icon)}</span>`).join('')}</div>` : ''}
      <div class="name">${U.esc(r.title)}</div>${typeof extra === 'string' ? extra : ''}
      <div class="meta">${mine ? '<span></span>' : `<span class="who">${App.ui.heart(r.id)}${by ? `<span class="cook">${U.esc(U.firstName(by))}</span>` : ''}</span>`}
        <span class="time">${App.icon('clock')}${U.fmtMinsShort(U.schedule(r).total)}</span></div></a>`;
  };
  // Filled when it's in your recipe book. Works inside a card link (see the click handler in app.js).
  App.ui.heart = id => {
    const on = App.store.isSaved(id);
    return `<span class="heart ${on ? 'on' : ''}" role="button" tabindex="0" data-heart="${U.esc(id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from your recipes' : 'Save to your recipes'}">${on ? App.icon('heart') : App.glyph('heart')}</span>`;
  };

  // A small app-style menu that opens under (or above) something you tapped. Tapping an item with
  // data-pick calls onPick(value); tapping outside closes it. Items keep the keyboard open while typing.
  let openPop = null;
  App.ui.popover = (anchor, html, onPick) => {
    openPop?.close();
    const el = document.createElement('div');
    el.className = 'pop card';
    el.innerHTML = html;
    document.body.appendChild(el);
    const place = () => {
      const a = anchor.getBoundingClientRect(), h = el.offsetHeight, w = el.offsetWidth;
      const below = a.bottom + 6 + h < window.innerHeight - 70 || a.top < h + 16;
      el.style.top = (window.scrollY + (below ? a.bottom + 6 : a.top - h - 6)) + 'px';
      el.style.left = Math.max(8, Math.min(window.scrollX + a.left, window.scrollX + document.documentElement.clientWidth - w - 8)) + 'px';
    };
    place();
    const outside = e => { if (!el.contains(e.target) && e.target !== anchor) close(); };
    const close = () => { el.remove(); document.removeEventListener('pointerdown', outside, true); if (openPop?.el === el) openPop = null; };
    el.addEventListener('pointerdown', e => e.preventDefault()); // don't take focus from a box you're typing in
    el.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) { close(); onPick(b.dataset.pick); } });
    document.addEventListener('pointerdown', outside, true);
    openPop = { el, close, update(h) { if (!h) return close(); el.innerHTML = h; place(); } };
    return openPop;
  };
  App.ui.closePopover = () => openPop?.close();
  // Enter in a box with suggestions open picks the first one (finishing the word you were typing).
  App.ui.pickFirst = () => { const b = openPop?.el.querySelector('[data-pick]'); if (!b) return false; b.click(); return true; };

  // Ingredient suggestions for what's typed so far ("2 cups ri" → rice, ricotta…): the recipe's own
  // ingredients first (also by kind — "cheese" offers its parmesan), an exact match on top, and the amount kept.
  const PRETTY = { berr: 'berries', strawberr: 'strawberries', 'thai chil': 'thai chiles', gruy: 'gruyère cheese', grape: 'grapes' };
  const known = () => App.ui._known ||= [...new Set(App.ING_ICONS.map(([k]) => PRETTY[k] || k)
    .filter(k => k.length > 3 && !/^(nut|oat|bean|tofu|ice cube|baking)$/.test(k)))];
  App.ui.ingSuggestions = (ings, text, mixes = []) => {
    const p = U.parseIngredientLine(text);
    const frag = (p?.name || '').toLowerCase().trim();
    if (frag.length < 2) return null;
    const prefix = text.slice(0, Math.max(0, text.toLowerCase().lastIndexOf(frag)));
    const kind = frag.length >= 3 && !frag.includes(' ') ? U.ingIcon(frag) : null;
    const starts = n => { n = n.toLowerCase(); return n.startsWith(frag) || n.split(/\s+/).some(w => w.startsWith(frag)); };
    const mine = ings.filter(g => starts(g.name) || (kind && U.ingIcon(g.name) === kind)).map(g => ({ name: g.name, mine: true }));
    const more = known().filter(n => starts(n) && !mine.some(m => m.name.toLowerCase() === n))
      .sort((x, y) => (!x.startsWith(frag)) - (!y.startsWith(frag)) || x.length - y.length).map(name => ({ name }));
    const list = [...mine, ...more].slice(0, 7).sort((a, b) => (b.name.toLowerCase() === frag) - (a.name.toLowerCase() === frag));
    const mx = mixes.filter(m => starts(m.name) || (frag.length >= 3 && 'mixture'.startsWith(frag)));
    if (!list.length && !mx.length) return null;
    return mx.map(m => `<button class="sug" data-pick="@from:${m.id}"><span class="ing-ico">${App.icon(U.mixIcon(m.name))}</span>${U.esc(m.name)}<small>from step ${m.n}</small></button>`).join('') +
      list.map(x => `<button class="sug" data-pick="${U.esc(prefix + x.name)}">${U.ingIconHtml({ name: x.name })}${U.esc(x.name)}${x.mine ? '<small>in recipe</small>' : ''}</button>`).join('');
  };

  // A short message above the bottom bar, with an optional Undo. Disappears after a few seconds.
  let toastTimer = null;
  App.ui.toast = (text, undo) => {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${U.esc(text)}</span>${undo ? '<button>Undo</button>' : ''}`;
    if (undo) el.querySelector('button').onclick = () => { el.remove(); undo(); };
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 5000);
  };

  // ---------- Page header + account ----------
  // Every page's header ends with the account button: "Log in" when logged out, your picture when logged in.
  // { account: false } leaves the account button off (recipe pages: back, share and edit are enough).
  App.ui.topbar = (left, right = '', { account = true } = {}) => {
    const me = App.store.me();
    return `<header class="topbar">${left}${right}
      ${!account ? '' : me ? `<button class="acct" data-acct aria-label="Your account">${U.avatarHtml(me)}</button>`
        : `<button class="btn small primary" data-acct>Log in</button>`}</header>`;
  };

  // The account panel. Logged in: your name and picture (tap to change), night mode, Log out.
  // Logged out: Log in (pick your profile — no passwords yet) or Sign up (name + picture).
  const FOODS = ['avo', 'squash', 'onion', 'garlic', 'tomato', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berries', 'carrot', 'mushroom', 'broccoli', 'corn',
    'eggplant', 'bellpep', 'chili', 'spud', 'potato', 'pumpkin', 'egg', 'cheese', 'bread', 'toast', 'cookie', 'cake', 'muffin', 'pancake', 'friedegg', 'pot', 'ip', 'noodle', 'rice', 'tofu', 'dough'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  App.account = () => {
    const S = App.store;
    let mode = S.me() ? 'me' : 'login'; // me | edit | login | signup
    let draft = null;
    const pictureHtml = p => `<div class="icon-picker acct-pics">
      <div class="swatches">${App.BLOB_COLORS.map(c => `<button type="button" class="sw ${c === p.color ? 'on' : ''}" data-color="${c}" style="--sw:${c}" aria-label="Color"></button>`).join('')}</div>
      ${FOODS.map(f => `<button type="button" data-avatar="${f}" class="${f === p.avatar ? 'on' : ''}" style="--blob:${p.color}" aria-label="${f}">${App.icon(f)}</button>`).join('')}</div>`;
    const themeRow = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      return `<button class="acct-row" data-theme-toggle>${App.icon(dark ? 'sun' : 'moon')}<span>${dark ? 'Day mode' : 'Night mode'}</span></button>`;
    };
    // Sue, the helper: All tips / Check-in only / Off on this device.
    const sueRow = () => `<div class="acct-row sue-row">${App.icon('sue')}<span>Sue<small>${App.sue.modeHint()}</small></span>${App.sue.modeHtml()}</div>`;
    const html = () => {
      const me = S.me();
      if (mode === 'me') return `
        <div class="acct-head">${U.avatarHtml(me, 'lg')}<div><h3>${U.esc(me.name)}</h3><button class="link" data-go="edit">Change name or picture</button></div></div>
        ${themeRow()}
        ${sueRow()}
        <button class="acct-row" data-go="logout">${App.glyph('logout')}<span>Log out</span></button>`;
      if (mode === 'edit' || mode === 'signup') return `
        <div class="sheet-head"><h3>${mode === 'edit' ? 'Your profile' : 'Sign up'}</h3><button class="btn small" data-go="${mode === 'edit' ? 'me' : 'login'}">Cancel</button></div>
        <form class="acct-form" data-form="${mode}">
          <div class="acct-head">${U.avatarHtml(draft, 'lg')}<input class="input" name="name" value="${U.esc(draft.name)}" placeholder="Your name" aria-label="Your name" autocomplete="name"></div>
          <div class="join-err" role="alert"></div>
          ${pictureHtml(draft)}
          <button class="btn primary block">${mode === 'edit' ? 'Save' : 'Create account'}</button>
        </form>`;
      return `
        <div class="sheet-head"><h3>Log in</h3><button class="btn small" data-close>Close</button></div>
        <div class="acct-list">${S.profiles().map(p => `<button class="acct-row" data-login="${U.esc(p.id)}">${U.avatarHtml(p)}<span>${U.esc(p.name)}</span></button>`).join('')}</div>
        <div class="acct-new"><span class="muted">New here?</span><button class="btn small" data-go="signup">Sign up</button></div>
        ${themeRow()}
        ${sueRow()}`;
    };
    const done = () => { App.refreshNav?.(); App.rerender?.(); };
    App.ui.sheet(`<div class="acct-panel">${html()}</div>`, (el, close) => {
      const box = el.querySelector('.acct-panel');
      const paint = () => { box.innerHTML = html(); };
      el.addEventListener('click', e => {
        const t = e.target.closest('[data-go], [data-login], [data-avatar], [data-color], [data-theme-toggle], [data-sue-mode]');
        if (!t) return;
        const d = t.dataset;
        if (d.sueMode) { App.sue.setMode(d.sueMode); paint(); App.rerender?.(); return; }
        if (d.login) { S.setMe(d.login); close(); done(); return; }
        if (d.go === 'logout') { S.setMe(null); close(); done(); return; }
        if ('themeToggle' in d) { App.toggleTheme(); paint(); return; }
        if (d.go) {
          mode = d.go;
          draft = mode === 'edit' ? { ...S.me() } : mode === 'signup' ? { name: '', avatar: pick(FOODS.slice(0, 15)), color: pick(App.BLOB_COLORS) } : null;
          paint(); box.querySelector('[name=name]')?.focus(); return;
        }
        draft.name = box.querySelector('[name=name]')?.value ?? draft.name;
        if (d.avatar) draft.avatar = d.avatar;
        if (d.color) draft.color = d.color;
        paint();
      });
      el.addEventListener('submit', e => {
        e.preventDefault();
        const name = box.querySelector('[name=name]').value.trim();
        const taken = S.profiles().some(p => p.name.toLowerCase() === name.toLowerCase() && p.id !== S.me()?.id);
        const err = !name ? 'Type your name first.' : taken ? 'That name is taken. Log in instead, or add your last name.' : '';
        if (err) { box.querySelector('.join-err').textContent = err; return; }
        if (mode === 'edit') S.updateProfile(S.me().id, { name, avatar: draft.avatar, color: draft.color });
        else S.setMe(S.addProfile(name, draft.avatar, draft.color));
        close(); done();
      });
    });
  };

  // ---------- Step rendering ----------
  // Amount shown for an ingredient inside a step: the step's portion if set, else the full amount.
  App.ui.useAmount = (use, ing, scale) => {
    const qty = use.qty != null ? use.qty : ing.qty;
    const unit = use.qty != null ? (use.unit ?? ing.unit) : ing.unit;
    return qty != null || unit ? U.fmtAmount(qty == null ? null : qty * scale, U.normUnit(unit)) : '';
  };

  // Tap an ingredient or an amount to see it in other units and any swaps (js/kitchen.js).
  App.ui.knAttrs = (ing, qty, unit) => `class="kn" tabindex="0" data-kn-name="${U.esc(ing.name || '')}" data-kn-ico="${U.esc(ing.icon || '')}"${qty != null ? ` data-kn-q="${+qty}"` : ''} data-kn-u="${U.esc(unit || '')}"`;

  // Two columns: the action on the left, what it uses on the right.
  // Time / heat / temp sit underneath as a quiet note line.
  App.ui.step = (recipe, step, scale = 1, opts = {}) => {
    const v = App.verb(step.verb);
    // Only show an amount the first time an ingredient appears (or when the step uses a set portion).
    const idx = recipe.steps.indexOf(step);
    const usedBefore = new Set(recipe.steps.slice(0, Math.max(0, idx)).flatMap(s => (s.uses || []).map(u => u.ing)));
    const items = (step.uses || []).map(use => {
      if (use.from) return App.ui.mixtureHtml(recipe, use.from);
      const ing = recipe.ingredients.find(i => i.id === use.ing);
      if (!ing) return '';
      const amt = use.qty != null || !usedBefore.has(ing.id) ? App.ui.useAmount(use, ing, scale) : '';
      const q = amt ? (use.qty != null ? use.qty : ing.qty) : null, un = amt ? (use.qty != null ? (use.unit ?? ing.unit) : ing.unit) : '';
      return `<li ${App.ui.knAttrs(ing, q == null ? null : q * scale, un)}>${U.ingIconHtml(ing)}<span>${amt ? `<b>${U.esc(amt)}</b> ` : ''}${U.esc(ing.name)}${use.note ? ` <span class="un">· ${U.esc(use.note)}</span>` : ''}</span></li>`;
    }).join('');
    return `<div class="s-grid">
      <div class="s-verb ${v.label.length > 7 ? 'long' : ''}"><span class="vi">${App.icon(v.icon)}</span><span class="vl">${U.esc(v.label)}</span></div>
      <div class="s-what">${items ? `<ul class="s-ings">${items}</ul>` : ''}${App.ui.stepMeta(step, recipe, { ...opts, solo: !items })}</div>
    </div>`;
  };

  // One line under the ingredients: time first, then its cue, then heat —
  // "5 min · until softened · medium heat", each with its little icon.
  // Servings next to the stepper: gray at the recipe's own number, green with an up arrow when
  // you've made more, red with a down arrow when you've made less.
  App.ui.servState = (n, std) => n > std ? 'up' : n < std ? 'down' : 'same';
  App.ui.servInner = (n, std) => {
    const st = App.ui.servState(n, std);
    return `${st === 'same' ? App.icon('cloche') : App.glyph(st, 'serv-arrow')}${n}`;
  };

  // A mixture used in a step: a bowl, its name, and which step made it.
  App.ui.mixtureHtml = (recipe, fromId, extra = '') => {
    const src = recipe.steps.find(s => s.id === fromId);
    if (!src) return '';
    return `<li class="mix-use"><span class="ing-ico">${App.icon(U.mixIcon(src.makes))}</span><span><b class="mix-nm">${U.esc(src.makes || 'mixture')}</b> <span class="un">from step ${recipe.steps.indexOf(src) + 1}</span></span>${extra}</li>`;
  };

  App.ui.stepMeta = (step, recipe, opts = {}) => {
    const out = [];
    if (step.makes) out.push(`<span class="m makes">${App.icon(U.mixIcon(step.makes))}makes ${U.esc(step.makes)}</span>`);
    if (step.time) {
      const v = App.verb(step.verb);
      out.push(`<button class="s-timer" data-action="timer" data-mins="${+step.time}" data-label="${U.esc(v.label + (recipe ? ' · ' + recipe.title : ''))}" title="Start a ${U.esc(U.fmtMins(+step.time))} timer">${App.icon('clock')}${U.esc(U.fmtMins(+step.time))}</button>`);
    }
    if (step.text) out.push(`<span class="s-text">${App.ui.timeLinks(step.text, step, recipe)}</span>`);
    if (step.heat) out.push(`<span class="m">${App.icon('flame')}${U.HEAT[step.heat].toLowerCase()} heat</span>`);
    if (step.temp) out.push(`<span class="m kn" tabindex="0" data-kn-temp="${U.esc(step.temp)}">${App.icon('thermo')}${U.esc(step.temp)}</span>`);
    if (opts.extra) out.push(opts.extra);
    return out.length ? `<div class="s-meta ${opts.solo ? 'solo' : ''}">${out.join('<span class="dot">·</span>')}</div>` : '';
  };

  // Times written in a step's note ("about 5 minutes", "1 to 2 hours") become tap-to-start timers too.
  // A range starts at the low end, so you check early. The step's own time is already a button.
  App.ui.timeLinks = (text, step, recipe) => {
    const v = App.verb(step?.verb);
    const re = /\b(\d+(?:\.\d+)?)(\s*(?:[-–]|to)\s*\d+(?:\.\d+)?)?\s*(minutes?|mins?|hours?|hrs?)\b/gi;
    let out = '', at = 0, m;
    while ((m = re.exec(text))) {
      const mins = Math.round(+m[1] * (/^h/i.test(m[3]) ? 60 : 1));
      out += U.esc(text.slice(at, m.index));
      out += mins > 0 && mins <= 24 * 60 && mins !== +step?.time
        ? `<button class="s-timer in-text" data-action="timer" data-mins="${mins}" data-label="${U.esc(v.label + (recipe ? ' · ' + recipe.title : ''))}" title="Start a ${U.esc(U.fmtMins(mins))} timer">${U.esc(m[0])}</button>`
        : U.esc(m[0]);
      at = m.index + m[0].length;
    }
    return out + U.esc(text.slice(at));
  };

  // ---------- Timers ----------
  // Saved on this device, so a timer keeps going if the page reloads or you come back to the app.
  // An ended timer stays (ringing) until you tap OK.
  const TKEY = 'recipeapp.timers';
  const timers = (() => { try { return (JSON.parse(localStorage.getItem(TKEY)) || []).filter(t => t && t.id && +t.end && Date.now() - t.end < 6 * 3600e3); } catch (e) { return []; } })();
  const saveTimers = () => { try { localStorage.setItem(TKEY, JSON.stringify(timers.map(({ id, label, end }) => ({ id, label, end })))); } catch (e) { /* private mode */ } };
  let tickHandle = null, audioCtx = null, baseTitle = null;
  const host = () => {
    let el = document.getElementById('timers');
    if (!el) { el = document.createElement('div'); el.id = 'timers'; el.className = 'timers'; document.body.appendChild(el); }
    return el;
  };
  const beep = () => {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(.25, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .4);
      o.start(); o.stop(audioCtx.currentTime + .4);
    } catch (e) { /* no audio */ }
  };
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const render = () => {
    host().innerHTML = timers.map(t => {
      const left = (t.end - Date.now()) / 1000;
      return `<div class="timer-pill ${left <= 0 ? 'ring' : ''}" data-id="${t.id}">${App.icon('clock')}${U.esc(t.label)}
        <span class="t">${left <= 0 ? 'Done!' : fmt(left)}</span>
        ${left > 0 ? `<button data-timer="add" data-id="${t.id}">+1</button>` : ''}
        <button data-timer="stop" data-id="${t.id}">${left <= 0 ? 'OK' : App.glyph('x')}</button></div>`;
    }).join('');
  };
  const tick = () => {
    const now = Date.now();
    for (const t of timers) {
      if (t.end <= now && now - (t.lastBeep || 0) > 1500) { t.lastBeep = now; beep(); navigator.vibrate?.(300); }
    }
    render();
    // A finished timer shows in the browser tab's title too, for when you're in another tab.
    const ringing = timers.filter(t => t.end <= now).length;
    if (ringing) { baseTitle ??= document.title; document.title = `Timer done · ${baseTitle}`; }
    else if (baseTitle != null) { document.title = baseTitle; baseTitle = null; }
    if (!timers.length) { clearInterval(tickHandle); tickHandle = null; }
  };
  App.ui.startTimer = (label, mins) => {
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch (e) {}
    timers.push({ id: U.uid('t'), label, end: Date.now() + mins * 60000 });
    saveTimers();
    render();
    tickHandle ||= setInterval(tick, 500);
  };
  if (timers.length) { tickHandle = setInterval(tick, 500); setTimeout(render); }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-timer]');
    if (!b) return;
    const i = timers.findIndex(t => t.id === b.dataset.id);
    if (i < 0) return;
    if (b.dataset.timer === 'stop') timers.splice(i, 1);
    else timers[i].end += 60000;
    saveTimers();
    tick();
  });

  // ---------- Keep screen awake while cooking ----------
  let lock = null;
  App.ui.keepAwake = async on => {
    App.ui.wantAwake = on;
    try {
      if (on && 'wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => lock = null); }
      if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) { /* not supported / not allowed */ }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && App.ui.wantAwake) App.ui.keepAwake(true);
  });
})();
