// Recipe detail: ingredients, symbol steps, servings scaling, co-op preview, notes.
App.views = App.views || {};
App.session = App.session || { servings: {}, mode: 'solo', ingOpen: false };

App.views.recipe = (root, { id }) => {
  const U = App.util, S = App.store, ui = App.ui;
  const r = S.recipe(id);
  if (!r) { root.innerHTML = `<div class="empty"><p>Recipe not found.</p><a href="#/">Back to recipes</a></div>`; return; }
  r.notes ||= [];

  const servings = () => App.session.servings[r.id] || r.servings || 1;
  const scale = () => servings() / (r.servings || 1);

  function render() {
    const coop = App.session.mode === 'coop';
    const solo = U.schedule(r, 1), duo = U.schedule(r, 2);
    const sc = scale();
    const ingOpen = !!App.session.ingOpen; // collapsed by default — steps already list ingredients

    // Ingredients, grouped (e.g. "Toppings")
    let lastGroup = null;
    const ingHtml = r.ingredients.map(ing => {
      let head = '';
      if ((ing.group || '') !== (lastGroup || '')) { head = ing.group ? `<li class="group-head">${U.esc(ing.group)}</li>` : ''; }
      lastGroup = ing.group || '';
      const amt = ing.qty != null ? U.fmtAmount(ing.qty * sc, U.normUnit(ing.unit)) : '';
      const notes = ui.notesFor(r, 'ing:' + ing.id);
      return `${head}<li>${U.ingIconHtml(ing)}<span class="qty">${U.esc(amt) || '—'}</span>
        <span class="nm">${U.esc(ing.name)}${ing.note ? ` <span class="extra">· ${U.esc(ing.note)}</span>` : ''}</span></li>
        ${notes ? `<li style="display:block;padding:0;border:none">${notes}</li>` : ''}`;
    }).join('');

    const stepHtml = r.steps.map((s, i) => {
      const sched = duo.byId[s.id];
      const chefCls = coop ? 'chef-' + sched.chef : '';
      let wait = '';
      if (coop) {
        const other = U.stepDeps(r, i).filter(d => duo.byId[d].chef !== sched.chef);
        if (other.length) wait = `<span class="s-wait">⏸ after ${other.map(d => '#' + (r.steps.findIndex(x => x.id === d) + 1)).join(', ')}</span>`;
      }
      return `<div class="card step ${chefCls}">
        <div class="num ${chefCls}">${i + 1}</div>
        <div class="body">
          ${ui.step(r, s, sc, { extra: wait })}
          ${s.detail ? `<details class="detail"><summary>more</summary>${U.esc(s.detail)}</details>` : ''}
          ${ui.notesFor(r, 'step:' + s.id)}
          ${(s.uses || []).filter(u => r.steps.findIndex(x => (x.uses || []).some(v => v.ing === u.ing)) === i).map(u => ui.notesFor(r, 'ing:' + u.ing)).join('')}
        </div></div>`;
    }).join('');

    root.innerHTML = `
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Back">←</a>
        <span class="title-sm"></span>
        <a class="icon-btn" href="#/edit/${encodeURIComponent(r.id)}" aria-label="Edit">✏️</a>
      </header>
      <div class="hero">
        <div class="emoji">${U.esc(r.emoji || '🍽️')}</div>
        <h2>${U.esc(r.title)}</h2>
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
      <div class="sub" style="color:var(--muted);font-size:.88rem;margin-top:10px">
        ${coop
          ? `<span style="color:var(--chef-a);font-weight:700">● Chef A</span> &nbsp;<span style="color:var(--chef-b);font-weight:700">● Chef B</span> &nbsp;· ⏱ ~${U.fmtMins(duo.total)} together <span style="opacity:.7">(vs ${U.fmtMins(solo.total)} solo)</span>`
          : `⏱ ~${U.fmtMins(solo.total)}`}
      </div>

      <div class="section-label">
        <button class="ing-toggle" data-action="toggle-ings" aria-expanded="${ingOpen}">${ingOpen ? '▾' : '▸'} Ingredients <span class="count">${r.ingredients.length}</span></button>
        <button class="btn small" data-action="to-list">🛒 Add to shopping list</button>
      </div>
      ${ingOpen ? `<ul class="card ing-list">${ingHtml}</ul>` : ''}

      <div class="section-label">Steps</div>
      <div class="steps">${stepHtml}</div>

      <div class="section-label">Notes <button class="btn small" data-action="add-note">+ Note</button></div>
      ${ui.notesFor(r, 'recipe') || `<div style="color:var(--muted);font-size:.9rem">Tweaks, swaps, and tips — yours or a friend's.</div>`}

      <div class="section-label">Cook log</div>
      <button class="btn small" data-action="log">✅ I cooked this today</button>
`;
  }

  root.onclick = e => {
    const t = e.target.closest('button, [data-action]');
    if (!t) return;
    if (t.dataset.mode) { App.session.mode = t.dataset.mode; render(); }
    else if (t.dataset.serv) {
      App.session.servings[r.id] = Math.max(1, servings() + +t.dataset.serv); render();
    }
    else if (t.dataset.action === 'del-note') {
      if (confirm('Delete this note?')) { r.notes = r.notes.filter(n => n.id !== t.dataset.id); S.upsertRecipe(r); render(); }
    }
    else if (t.dataset.action === 'add-note') noteSheet();
    else if (t.dataset.action === 'toggle-ings') { App.session.ingOpen = !App.session.ingOpen; render(); }
    else if (t.dataset.action === 'log') { S.logCook(r.id, App.session.mode); render(); }
    else if (t.dataset.action === 'to-list') {
      const list = S.state.list;
      const ex = list.recipes.find(x => x.id === r.id);
      if (ex) ex.servings = servings(); else list.recipes.push({ id: r.id, servings: servings() });
      S.save();
      t.textContent = '✓ Added';
      setTimeout(() => { t.textContent = '🛒 Add to shopping list'; }, 1400);
    }
  };

  function noteSheet() {
    const opts = [`<option value="recipe">Whole recipe</option>`,
      ...r.ingredients.map(i => `<option value="ing:${i.id}">Ingredient · ${U.esc(i.name)}</option>`),
      ...r.steps.map((s, i) => `<option value="step:${s.id}">Step ${i + 1} · ${U.esc(App.verb(s.verb).label)}</option>`)].join('');
    let type = 'tip';
    ui.sheet(`
      <h3>Add a note</h3>
      <label class="field"><span>About</span><select class="input" name="target">${opts}</select></label>
      <label class="field"><span>Type</span>
        <div class="row" style="flex-wrap:wrap">${App.NOTE_TYPES.map(t => `<button class="chip ${t.id === type ? 'on' : ''}" data-type="${t.id}">${t.icon} ${t.label}</button>`).join('')}</div></label>
      <label class="field"><span>Note</span><input class="input" name="text" placeholder="e.g. +1 tsp cumin, or swap broth for water"></label>
      <label class="field"><span>From</span><input class="input" name="author" value="${U.esc(localStorage.getItem('recipeapp.author') || 'Me')}"></label>
      <div class="row"><button class="btn" data-close style="flex:1">Cancel</button><button class="btn primary" data-save style="flex:2">Save note</button></div>`,
      (el, close) => {
        el.querySelector('[name=text]').focus();
        el.addEventListener('click', e => {
          const tb = e.target.closest('[data-type]');
          if (tb) { type = tb.dataset.type; el.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b === tb)); }
          if (e.target.closest('[data-save]')) {
            const text = el.querySelector('[name=text]').value.trim();
            if (!text) return el.querySelector('[name=text]').focus();
            const author = el.querySelector('[name=author]').value.trim() || 'Me';
            try { localStorage.setItem('recipeapp.author', author); } catch (err) {}
            r.notes.push({ id: U.uid('n'), type, target: el.querySelector('[name=target]').value, text, author, date: U.todayStr() });
            S.upsertRecipe(r); close(); render();
          }
        });
      });
  }

  render();
  // Keep the phone screen on while a recipe is open (you're probably cooking).
  ui.keepAwake(true);
  return () => ui.keepAwake(false);
};
