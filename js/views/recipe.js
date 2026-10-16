// Recipe page. Same screen for cooking and editing: ✏️ turns it into edit mode,
// where tapping a step or ingredient opens a small panel to fix it.
App.views = App.views || {};
App.session = App.session || { servings: {}, mode: 'solo', ingOpen: false };

App.views.recipe = (root, { id, edit = false }) => {
  const U = App.util, S = App.store, ui = App.ui, E = App.edit;
  const r = S.recipe(id);
  if (!r) { root.innerHTML = `<div class="empty"><p>Recipe not found.</p><a href="#/">Back to recipes</a></div>`; return; }
  r.notes ||= [];
  const enc = encodeURIComponent(r.id);

  const servings = () => edit ? (r.servings || 1) : (App.session.servings[r.id] || r.servings || 1);
  const scale = () => servings() / (r.servings || 1);

  function render() {
    const coop = App.session.mode === 'coop';
    const solo = U.schedule(r, 1), duo = U.schedule(r, 2);
    const sc = scale();
    const ingOpen = !!App.session.ingOpen;
    const imported = edit && App.session.justImported === r.id;

    let lastGroup = '';
    const ingHtml = r.ingredients.map(ing => {
      const head = (ing.group || '') !== lastGroup && ing.group ? `<li class="group-head">${U.esc(ing.group)}</li>` : '';
      lastGroup = ing.group || '';
      const amt = ing.qty != null ? U.fmtAmount(ing.qty * sc, U.normUnit(ing.unit)) : '';
      return `${head}<li ${edit ? `class="tap" data-ing="${ing.id}"` : ''}>${U.ingIconHtml(ing)}<span class="qty">${U.esc(amt) || '—'}</span>
        <span class="nm">${U.esc(ing.name)}${ing.note ? ` <span class="extra">· ${U.esc(ing.note)}</span>` : ''}</span>${edit ? '<span class="chev">›</span>' : ''}</li>`;
    }).join('');

    const stepHtml = r.steps.map((s, i) => {
      const chef = duo.byId[s.id].chef;
      const chefCls = coop ? 'chef-' + chef : '';
      let wait = '';
      if (coop) {
        const other = U.stepDeps(r, i).filter(d => duo.byId[d] && duo.byId[d].chef !== chef);
        if (other.length) wait = `<span class="s-wait">⏸ after ${other.map(d => '#' + (r.steps.findIndex(x => x.id === d) + 1)).join(', ')}</span>`;
      }
      const num = coop
        ? `<button class="num ${chefCls}" data-swap="${s.id}" aria-label="Step ${i + 1}: Chef ${chef}. Tap to switch chef">${i + 1}</button>`
        : `<div class="num">${i + 1}</div>`;
      return `<div class="card step ${chefCls} ${edit ? 'tap' : ''}" ${edit ? `data-step="${s.id}"` : ''}>
        ${num}
        <div class="body">
          ${ui.step(r, s, sc, { extra: wait })}
          ${!edit && s.detail ? `<details class="detail"><summary>more</summary>${U.esc(s.detail)}</details>` : ''}
        </div>
        ${edit ? `<div class="reorder">
          <button data-move="-1" data-id="${s.id}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button data-move="1" data-id="${s.id}" aria-label="Move down" ${i === r.steps.length - 1 ? 'disabled' : ''}>▼</button></div>` : ''}
      </div>`;
    }).join('');

    root.innerHTML = `
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Back">←</a>
        <span class="title-sm"></span>
        ${edit ? `<a class="btn primary small" href="#/r/${enc}">Done</a>`
               : `<a class="icon-btn" href="#/edit/${enc}" aria-label="Edit">✏️</a>`}
      </header>
      ${imported ? `<div class="import-banner">Imported. Tap anything to fix it.</div>` : ''}
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
          ? `<span class="a">● A</span> <span class="b">● B</span> · ~${U.fmtMins(duo.total)} <span class="muted">· tap a number to swap</span>
             ${E.isCustomSplit(r) ? `<button class="link" data-act="auto">↺ Auto-split</button>` : ''}`
          : `⏱ ~${U.fmtMins(solo.total)}`}
      </div>

      <div class="section-label">
        <button class="ing-toggle" data-act="toggle-ings" aria-expanded="${ingOpen}">${ingOpen ? '▾' : '▸'} Ingredients <span class="count">${r.ingredients.length}</span></button>
        ${edit ? `<span class="row-btns"><button class="btn small" data-act="paste">📋 Paste</button><button class="btn small" data-act="add-ing">+ Add</button></span>`
               : `<button class="btn small" data-act="to-list">🛒 Add to list</button>`}
      </div>
      ${ingOpen ? (r.ingredients.length ? `<ul class="card ing-list">${ingHtml}</ul>` : `<div class="muted">No ingredients yet.</div>`) : ''}

      <div class="section-label">Steps</div>
      <div class="steps">${stepHtml || (edit ? '' : '<div class="muted">No steps yet.</div>')}</div>
      ${edit ? `<button class="btn block" data-act="add-step" style="margin-top:10px">+ Add step</button>` : ''}

      ${edit ? `
        <div class="section-label">More</div>
        <label class="field"><span>Source link</span><input class="input" data-f="source" value="${U.esc(r.source || '')}" placeholder="https://"></label>
        <label class="field"><span>Tags</span><input class="input" data-f="tags" value="${U.esc((r.tags || []).join(', '))}" placeholder="vegan, quick"></label>
        <button class="btn danger block" data-act="delete" style="margin-top:20px">Delete recipe</button>`
      : `
        <button class="btn small" data-act="log" style="margin-top:28px">✅ Cooked it today</button>`}`;
  }

  root.oninput = e => {
    const f = e.target.dataset.f;
    if (!f) return;
    if (f === 'tags') r.tags = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
    else r[f] = e.target.value;
    S.upsertRecipe(r);
  };

  root.onclick = e => {
    const t = e.target.closest('button, [data-step], [data-ing]');
    if (!t) return;
    const d = t.dataset;
    if (d.mode) { App.session.mode = d.mode; render(); }
    else if (d.serv) {
      if (edit) { r.servings = Math.max(1, (r.servings || 1) + +d.serv); S.upsertRecipe(r); }
      else App.session.servings[r.id] = Math.max(1, servings() + +d.serv);
      render();
    }
    else if (d.swap) { E.swapChef(r, d.swap); render(); }
    else if (d.move) {
      const i = r.steps.findIndex(s => s.id === d.id), j = i + +d.move;
      // pin the "waits for" lists first so moving a step doesn't silently change what it waits on
      r.steps.forEach((s, k) => { s.after = U.stepDeps(r, k); });
      [r.steps[i], r.steps[j]] = [r.steps[j], r.steps[i]];
      S.upsertRecipe(r); render();
    }
    else if (d.step) E.stepSheet(r, d.step, render);
    else if (d.ing) E.ingredientSheet(r, d.ing, render);
    else if (d.act === 'auto') { E.autoSplit(r); render(); }
    else if (d.act === 'add-step') E.stepSheet(r, E.newStep(r), render);
    else if (d.act === 'add-ing') E.ingredientSheet(r, E.newIngredient(r), render);
    else if (d.act === 'paste') E.pasteSheet(r, render);
    else if (d.act === 'delete') {
      if (confirm(`Delete “${r.title || 'this recipe'}”?`)) { S.deleteRecipe(r.id); location.hash = '#/'; }
    }
    else if (d.act === 'toggle-ings') { App.session.ingOpen = !App.session.ingOpen; render(); }
    else if (d.act === 'log') { S.logCook(r.id, App.session.mode); t.textContent = '✓ Logged'; }
    else if (d.act === 'to-list') {
      const list = S.state.list;
      const ex = list.recipes.find(x => x.id === r.id);
      if (ex) ex.servings = servings(); else list.recipes.push({ id: r.id, servings: servings() });
      S.save();
      t.textContent = '✓ Added';
      setTimeout(() => { t.textContent = '🛒 Add to list'; }, 1400);
    }
  };

  render();
  if (edit && !r.title) root.querySelector('.title-input')?.focus();
  ui.keepAwake(!edit); // keep the phone screen on while cooking
  return () => {
    ui.keepAwake(false);
    if (edit && App.session.justImported === r.id) delete App.session.justImported;
    if (edit && !r.title.trim() && !r.ingredients.length && !r.steps.length) S.deleteRecipe(r.id); // abandoned blank recipe
  };
};
