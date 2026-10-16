// Recipe page. Same screen for cooking and editing: ✏️ switches to edit mode, where the
// words on each step can be tapped and changed in place (see js/edit.js).
App.views = App.views || {};
App.session = App.session || { servings: {}, mode: 'solo', ingOpen: false };

App.views.recipe = (root, { id, edit = false }) => {
  const U = App.util, S = App.store, ui = App.ui, E = App.edit;
  const stored = S.recipe(id);
  // Edit mode changes a copy: Done saves it, Cancel throws it away.
  const r = edit && stored ? JSON.parse(JSON.stringify(stored)) : stored;
  if (!r) { root.innerHTML = `<div class="empty"><p>Recipe not found.</p><a href="#/">Back to recipes</a></div>`; return; }
  const enc = encodeURIComponent(r.id);

  // "Cooked it" logs today once; after that it shows as done with an Undo.
  const todaysCook = () => S.cooksFor(r.id).find(l => l.date === U.todayStr());
  const cookedHtml = () => todaysCook()
    ? `<div class="cooked done-state"><span>✓ Cooked today</span><button class="link" data-act="unlog">Undo</button></div>`
    : `<div class="cooked"><button class="cook-btn" data-act="log">✅ Cooked it</button></div>`;

  // Steps swiped off as done while cooking. Lives only while the recipe is open.
  const done = new Set();
  const servings = () => edit ? (r.servings || 1) : (App.session.servings[r.id] || r.servings || 1);
  const scale = () => servings() / (r.servings || 1);

  function render() {
    const y = window.scrollY;
    const coop = App.session.mode === 'coop';
    const solo = U.schedule(r, 1), duo = U.schedule(r, 2);
    const sc = scale();
    const ingOpen = !!App.session.ingOpen;
    const imported = edit && App.session.justImported === r.id;

    let lastGroup = '';
    const ingHtml = r.ingredients.map(g => {
      const head = (g.group || '') !== lastGroup && g.group ? `<li class="group-head">${U.esc(g.group)}</li>` : '';
      lastGroup = g.group || '';
      if (edit) return head + E.ingRowHtml(r, g);
      const amt = g.qty != null ? U.fmtAmount(g.qty * sc, U.normUnit(g.unit)) : '';
      return `${head}<li>${U.ingIconHtml(g)}<span class="qty">${U.esc(amt) || '—'}</span>
        <span class="nm">${U.esc(g.name)}${g.note ? ` <span class="extra">· ${U.esc(g.note)}</span>` : ''}</span></li>`;
    }).join('');

    const stepHtml = r.steps.map((s, i) => {
      const chef = duo.byId[s.id].chef;
      const chefCls = coop ? 'chef-' + chef : '';
      if (edit) return E.stepHtml(r, s, i, chefCls);
      const isDone = done.has(s.id), label = isDone ? '✓' : i + 1;
      const num = coop
        ? `<button class="num ${chefCls}" data-swap="${s.id}" aria-label="Step ${i + 1}: Chef ${chef}. Tap to switch chef">${label}</button>`
        : `<div class="num">${label}</div>`;
      return `<div class="card step swipe ${chefCls} ${isDone ? 'done' : ''}" data-sid="${s.id}" aria-label="Step ${i + 1}${isDone ? ', done' : ''}">
        ${num}
        <div class="body">
          ${ui.step(r, s, sc)}
        </div>
      </div>`;
    }).join('');

    root.innerHTML = `
      <header class="topbar">
        ${edit ? `<a class="btn small" href="#/r/${enc}" data-cancel>Cancel</a>` : `<a class="icon-btn" href="#/" aria-label="Back">←</a>`}
        <span class="title-sm"></span>
        ${edit ? `<a class="btn primary small" href="#/r/${enc}" data-done>Done</a>`
               : `<a class="icon-btn" href="#/edit/${enc}" aria-label="Edit">✏️</a>`}
      </header>
      ${imported ? `<div class="import-banner">Imported. Tap any word to fix it.</div>` : ''}
      <div class="hero">
        ${edit
          ? `<input class="emoji-input" data-f="emoji" value="${U.esc(r.emoji || '🍽️')}" aria-label="Icon">
             <input class="title-input" data-f="title" value="${U.esc(r.title)}" placeholder="Recipe name" aria-label="Recipe name">`
          : `<div class="emoji">${U.esc(r.emoji || '🍽️')}</div><h2>${U.esc(r.title || 'Untitled')}</h2>`}
      </div>

      <div class="meta-row">
        <div class="seg">
          <button data-mode="solo" class="${coop ? '' : 'on'}">👤 Solo</button>
          <button data-mode="coop" class="${coop ? 'on' : ''}">👥 Co-op</button>
        </div>
        <div class="stepper" aria-label="Servings">
          <button data-serv="-1" aria-label="Fewer servings">−</button>
          <span class="val">🍽 ${servings()}</span>
          <button data-serv="1" aria-label="More servings">+</button>
        </div>
      </div>
      <div class="coop-line">
        ${coop
          ? `<span class="a">● A</span> <span class="b">● B</span> · ~${U.fmtMins(duo.total)}${edit ? '' : ' <span class="muted">· tap a number to swap</span>'}
             ${E.isCustomSplit(r) ? `<button class="link" data-act="auto">↺ Auto-split</button>` : ''}`
          : `⏱ ~${U.fmtMins(solo.total)}`}
      </div>

      <div class="section-label">
        <button class="ing-toggle" data-act="toggle-ings" aria-expanded="${ingOpen}">${ingOpen ? '▾' : '▸'} Ingredients <span class="count">${r.ingredients.length}</span></button>
        ${edit ? '' : `<button class="btn small" data-act="to-list">🛒 Add to list</button>`}
      </div>
      ${ingOpen ? (r.ingredients.length ? `<ul class="card ing-list ${edit ? 'edit' : ''}">${ingHtml}</ul>` : `<div class="muted">No ingredients yet.</div>`) : ''}

      <div class="section-label">Steps <span class="hint">${edit ? 'drag to move · tap to change' : 'swipe when done'}</span></div>
      <div class="steps">${stepHtml || (edit ? '' : '<div class="muted">No steps yet.</div>')}</div>
      ${edit ? `<button class="btn block add-step" data-act="add-step">+ Add step</button>` : ''}

      ${edit ? `
        <div class="section-label">More</div>
        <label class="field"><span>Source link</span><input class="input" data-f="source" value="${U.esc(r.source || '')}" placeholder="https://"></label>
        <label class="field"><span>Tags</span><input class="input" data-f="tags" value="${U.esc((r.tags || []).join(', '))}" placeholder="vegan, quick"></label>
        <button class="btn danger block" data-act="delete" style="margin-top:20px">Delete recipe</button>`
      : cookedHtml()}`;
    if (edit) E.autosizeAll(root);
    window.scrollTo(0, y);
  }

  // Title, icon, source, tags
  root.oninput = e => {
    const f = e.target.dataset.f;
    if (!f) return;
    if (f === 'tags') r.tags = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
    else r[f] = e.target.value;
    if (!edit) S.upsertRecipe(r);
  };

  root.onclick = e => {
    // Done: let the bubbles settle into place, then switch back to the cooking view
    const done = e.target.closest('[data-done]');
    if (done) { e.preventDefault(); S.upsertRecipe(r); root.classList.add('settling'); setTimeout(() => { root.classList.remove('settling'); location.hash = done.getAttribute('href'); }, 260); return; }
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.mode) { App.session.mode = d.mode; render(); }
    else if (d.serv) {
      if (edit) r.servings = Math.max(1, (r.servings || 1) + +d.serv);
      else App.session.servings[r.id] = Math.max(1, servings() + +d.serv);
      render();
    }
    else if (d.swap) { E.swapChef(r, d.swap); render(); }
    else if (d.act === 'auto') { E.autoSplit(r); render(); }
    else if (d.act === 'add-step') { E.newStep(r); render(); root.querySelector('.step.edit:last-child [data-add-ing]')?.focus(); }
    else if (d.act === 'delete') {
      if (confirm(`Delete “${r.title || 'this recipe'}”?`)) { S.deleteRecipe(r.id); location.hash = '#/'; }
    }
    else if (d.act === 'toggle-ings') { App.session.ingOpen = !App.session.ingOpen; render(); }
    else if (d.act === 'log') { if (!todaysCook()) { S.logCook(r.id, App.session.mode); navigator.vibrate?.(15); } render(); }
    else if (d.act === 'unlog') { const c = todaysCook(); if (c) S.deleteLog(c.id); render(); }
    else if (d.act === 'to-list') {
      const list = S.state.list;
      const ex = list.recipes.find(x => x.id === r.id);
      if (ex) ex.servings = servings(); else list.recipes.push({ id: r.id, servings: servings() });
      S.save();
      t.textContent = '✓ Added';
      setTimeout(() => { t.textContent = '🛒 Add to list'; }, 1400);
    }
  };

  const unbind = edit ? E.bind(root, r, render) : bindSwipe();

  // Swipe a step either way to mark it done; swipe again to unmark. Vertical scrolling is left alone.
  function bindSwipe() {
    let g = null, swallowClick = false;
    const down = e => {
      const card = e.target.closest('.step.swipe');
      if (!card || e.button > 0) return;
      g = { card, x: e.clientX, y: e.clientY, dx: 0, horiz: null };
    };
    const move = e => {
      if (!g) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (g.horiz === null && Math.hypot(dx, dy) > 8) g.horiz = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (!g.horiz) return;
      g.dx = dx;
      g.card.style.transition = 'none';
      g.card.style.transform = `translateX(${Math.max(-90, Math.min(90, dx))}px)`;
      g.card.classList.toggle('will-toggle', Math.abs(dx) > 60);
    };
    const up = () => {
      if (!g) return;
      const { card, dx, horiz } = g; g = null;
      card.style.transition = ''; card.style.transform = '';
      card.classList.remove('will-toggle');
      if (!horiz) return;
      swallowClick = true; setTimeout(() => { swallowClick = false; }, 50); // a swipe isn't a tap
      const id = card.dataset.sid;
      if (Math.abs(dx) > 60) {
        if (done.has(id)) done.delete(id); else { done.add(id); navigator.vibrate?.(10); }
        render();
      }
    };
    const click = e => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } };
    root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    root.addEventListener('click', click, true);
    return () => {
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      root.removeEventListener('click', click, true);
    };
  }
  render();
  if (edit && !r.title) root.querySelector('.title-input')?.focus();
  // bubbles wiggle when edit mode opens, so it's obvious they can be moved
  if (edit) { root.classList.add('wiggle'); setTimeout(() => root.classList.remove('wiggle'), 1300); }
  ui.keepAwake(!edit); // keep the phone screen on while cooking
  return () => {
    unbind?.();
    root.classList.remove('wiggle', 'settling');
    ui.keepAwake(false);
    if (edit && App.session.justImported === r.id) delete App.session.justImported;
    const saved = S.recipe(id);
    if (edit && saved && !saved.title.trim() && !saved.ingredients.length && !saved.steps.length) S.deleteRecipe(id); // abandoned blank recipe
  };
};
