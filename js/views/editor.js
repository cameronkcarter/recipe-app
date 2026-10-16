// Add / edit a recipe.
App.views = App.views || {};

App.views.editor = (root, { id }) => {
  const U = App.util, S = App.store, ui = App.ui;
  const existing = id ? S.recipe(id) : null;
  if (id && !existing) { location.hash = '#/'; return; }

  // Working copy. Ingredients become a flat list with section headers ({head:'Toppings'}).
  const imported = !existing && App.session?.importDraft;
  if (imported) delete App.session.importDraft;
  const src = existing ? JSON.parse(JSON.stringify(existing)) : imported || {
    title: '', emoji: '🍽️', servings: 4, source: '', tags: [], ingredients: [], steps: [], notes: [],
  };
  const d = { ...src, tagsText: (src.tags || []).join(', '), rows: [] };
  let lastGroup = '';
  for (const ing of src.ingredients) {
    if ((ing.group || '') !== lastGroup) { d.rows.push({ head: ing.group || 'Main' }); lastGroup = ing.group || ''; }
    d.rows.push({ ...ing });
  }
  const ings = () => d.rows.filter(x => !x.head);

  const verbOptions = sel => {
    const groups = [...new Set(App.VERBS.map(v => v.group))];
    return groups.map(g => `<optgroup label="${g}">${App.VERBS.filter(v => v.group === g)
      .map(v => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}</optgroup>`).join('');
  };

  function stepHtml(s, i) {
    const usedIds = (s.uses || []).map(u => u.ing);
    const deps = Array.isArray(s.after) ? s.after : (i > 0 ? [d.steps[i - 1].id] : []);
    const ingChips = ings().map(ing => `<button class="chip ${usedIds.includes(ing.id) ? 'on' : ''}" data-act="use" data-step="${i}" data-ing="${ing.id}">${U.ingIcon(ing.name) || ''} ${U.esc(ing.name || '…')}</button>`).join('')
      || `<span style="color:var(--muted);font-size:.85rem">Add ingredients above first</span>`;
    const portions = (s.uses || []).map(u => {
      const ing = ings().find(x => x.id === u.ing);
      if (!ing) return '';
      return `<label>${U.esc(ing.name)}
        <input data-step="${i}" data-portion="${ing.id}" placeholder="all" aria-label="Amount" value="${u.qty != null ? U.esc(U.fmtQty(u.qty) + (u.unit != null && u.unit !== ing.unit ? ' ' + u.unit : '')) : ''}">
        <input data-step="${i}" data-usenote="${ing.id}" placeholder="note (minced)" aria-label="Note" value="${U.esc(u.note || '')}" style="width:110px"></label>`;
    }).join('');
    const depChips = d.steps.slice(0, i).map((p, j) => `<button class="chip ${deps.includes(p.id) ? 'on' : ''}" data-act="dep" data-step="${i}" data-dep="${p.id}">#${j + 1} ${App.verb(p.verb).icon}</button>`).join('');
    return `<div class="card ed-step">
      <div class="ed-step-head">
        <span class="num">${i + 1}</span>
        <select class="input" data-step="${i}" data-f="verb">${verbOptions(s.verb)}</select>
        <button class="icon-btn" data-act="up" data-step="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-act="down" data-step="${i}" aria-label="Move down" ${i === d.steps.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="rm" data-act="rm-step" data-step="${i}" aria-label="Delete step">✕</button>
      </div>
      <div class="mini">Ingredients</div>
      <div class="chips">${ingChips}</div>
      ${portions ? `<div class="portion">${portions}</div>` : ''}
      <div class="mini">Short note</div>
      <input class="input" data-step="${i}" data-f="text" value="${U.esc(s.text || '')}" placeholder="e.g. large pot · until golden">
      <div class="ed-row">
        <div><div class="mini">⏲️ Timed? (min)</div><input class="input" type="number" min="0" inputmode="numeric" data-step="${i}" data-f="time" value="${s.time ?? ''}" placeholder="only if timed"></div>
        <div><div class="mini">🌡️ Oven temp</div><input class="input" data-step="${i}" data-f="temp" value="${U.esc(s.temp || '')}" placeholder="e.g. 400°F"></div>
      </div>
      <div class="mini">🔥 Heat</div>
      <div class="seg">${U.HEAT.map((h, n) => `<button data-act="heat" data-step="${i}" data-heat="${n}" class="${(s.heat || 0) === n ? 'on' : ''}">${n ? h : 'Off'}</button>`).join('')}</div>
      <div class="mini">More detail (hidden unless tapped)</div>
      <input class="input" data-step="${i}" data-f="detail" value="${U.esc(s.detail || '')}" placeholder="optional">
      ${i > 0 ? `<div class="mini">👥 Must happen after</div><div class="chips">${depChips}</div>` : ''}
      <div class="mini">👥 Co-op chef</div>
      <div class="seg">${['auto', 'A', 'B'].map(c => `<button data-act="chef" data-step="${i}" data-chef="${c}" class="${(s.chef || 'auto') === c ? 'on' : ''}">${c === 'auto' ? 'Auto' : 'Chef ' + c}</button>`).join('')}</div>
    </div>`;
  }

  function render() {
    root.innerHTML = `
      <header class="topbar">
        <a class="icon-btn" href="${existing ? '#/r/' + encodeURIComponent(existing.id) : '#/'}" aria-label="Cancel">✕</a>
        <span class="title-sm">${existing ? 'Edit recipe' : imported ? 'Imported recipe' : 'New recipe'}</span>
        <button class="btn primary small" data-act="save">Save</button>
      </header>

      ${imported ? `<div class="import-banner">✨ Imported from the link. Give it a quick check — tap <b>Save</b> when it looks right.</div>` : ''}
      <div style="display:grid;grid-template-columns:70px 1fr;gap:8px">
        <label class="field"><span>Icon</span><input class="input" data-f="emoji" value="${U.esc(d.emoji || '')}" style="text-align:center;font-size:1.4rem;padding:6px"></label>
        <label class="field"><span>Name</span><input class="input" data-f="title" value="${U.esc(d.title)}" placeholder="e.g. Grandma's lasagna"></label>
      </div>
      <div style="display:grid;grid-template-columns:100px 1fr;gap:8px">
        <label class="field"><span>Servings</span><input class="input" type="number" min="1" data-f="servings" value="${d.servings || ''}"></label>
        <label class="field"><span>Tags</span><input class="input" data-f="tagsText" value="${U.esc(d.tagsText)}" placeholder="vegan, quick"></label>
      </div>
      <label class="field"><span>Source link (optional)</span><input class="input" data-f="source" value="${U.esc(d.source || '')}" placeholder="https://"></label>

      <div class="section-label">Ingredients <button class="btn small" data-act="paste">📋 Paste list</button></div>
      ${d.rows.map((row, i) => row.head != null
        ? `<div class="ed-ing" style="grid-template-columns:1fr 36px"><input class="input" data-row="${i}" data-f="head" value="${U.esc(row.head)}" style="font-weight:700"><button class="rm" data-act="rm-row" data-row="${i}" aria-label="Remove section">✕</button></div>`
        : `<div class="ed-ing">
            <input class="input" data-row="${i}" data-f="qty" value="${row.qty != null ? U.esc(U.fmtQty(row.qty)) : ''}" placeholder="qty" inputmode="decimal">
            <input class="input" data-row="${i}" data-f="unit" value="${U.esc(row.unit || '')}" placeholder="unit" list="units">
            <input class="input" data-row="${i}" data-f="name" value="${U.esc(row.name || '')}" placeholder="ingredient">
            <button class="rm" data-act="rm-row" data-row="${i}" aria-label="Remove ingredient">✕</button>
          </div>`).join('')}
      <datalist id="units">${U.UNITS.map(u => `<option value="${u}">`).join('')}</datalist>
      <div class="row" style="display:flex;gap:8px;margin-top:6px">
        <button class="btn small" data-act="add-ing">+ Ingredient</button>
        <button class="btn small" data-act="add-head">+ Section</button>
      </div>

      <div class="section-label">Steps</div>
      ${d.steps.map(stepHtml).join('') || `<div style="color:var(--muted);font-size:.9rem;margin-bottom:10px">One action per step: a verb, what it uses, and maybe a time.</div>`}
      <button class="btn block" data-act="add-step">+ Step</button>

      ${existing ? `<button class="btn danger block" data-act="delete" style="margin-top:30px">Delete recipe</button>` : ''}`;
  }

  // Text inputs update the draft without re-rendering (keeps focus).
  root.oninput = e => {
    const t = e.target, f = t.dataset.f;
    if (t.dataset.usenote != null) {
      const use = d.steps[+t.dataset.step].uses.find(u => u.ing === t.dataset.usenote);
      use.note = t.value.trim() || undefined;
      return;
    }
    if (t.dataset.portion != null) {
      const s = d.steps[+t.dataset.step];
      const use = s.uses.find(u => u.ing === t.dataset.portion);
      const v = t.value.trim();
      if (!v) { delete use.qty; delete use.unit; }
      else { const p = U.parseIngredientLine(v + ' x'); use.qty = p?.qty ?? U.parseQty(v); use.unit = p?.unit || undefined; }
      return;
    }
    if (!f) return;
    if (t.dataset.row != null) {
      const row = d.rows[+t.dataset.row];
      if (f === 'qty') row.qty = U.parseQty(t.value);
      else if (f === 'unit') row.unit = U.normUnit(t.value);
      else row[f] = t.value;
    } else if (t.dataset.step != null) {
      const s = d.steps[+t.dataset.step];
      if (f === 'time') s.time = t.value === '' ? null : +t.value;
      else s[f] = t.value;
    } else d[f] = t.value;
  };
  root.onchange = e => { if (e.target.dataset.f === 'verb') { root.oninput(e); render(); } };

  root.onclick = e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act, si = +t.dataset.step, s = d.steps[si];
    switch (act) {
      case 'add-ing': d.rows.push({ id: U.uid('i'), qty: null, unit: '', name: '' }); render(); focusLast('[data-f=qty]'); break;
      case 'add-head': d.rows.push({ head: 'Toppings' }); render(); focusLast('[data-f=head]'); break;
      case 'rm-row': d.rows.splice(+t.dataset.row, 1); render(); break;
      case 'add-step': {
        const prev = d.steps[d.steps.length - 1];
        d.steps.push({ id: U.uid('s'), verb: 'chop', uses: [], after: prev ? [prev.id] : [] });
        render(); root.querySelectorAll('.ed-step')[d.steps.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'rm-step': d.steps.splice(si, 1); render(); break;
      case 'up': case 'down': {
        const j = act === 'up' ? si - 1 : si + 1;
        [d.steps[si], d.steps[j]] = [d.steps[j], d.steps[si]];
        render(); break;
      }
      case 'use': {
        s.uses ||= [];
        const k = s.uses.findIndex(u => u.ing === t.dataset.ing);
        if (k > -1) s.uses.splice(k, 1); else s.uses.push({ ing: t.dataset.ing });
        render(); break;
      }
      case 'dep': {
        s.after = Array.isArray(s.after) ? s.after : (si > 0 ? [d.steps[si - 1].id] : []);
        const k = s.after.indexOf(t.dataset.dep);
        if (k > -1) s.after.splice(k, 1); else s.after.push(t.dataset.dep);
        render(); break;
      }
      case 'heat': s.heat = +t.dataset.heat || undefined; render(); break;
      case 'chef': s.chef = t.dataset.chef === 'auto' ? undefined : t.dataset.chef; render(); break;
      case 'paste': pasteSheet(); break;
      case 'save': save(); break;
      case 'delete':
        if (confirm(`Delete “${existing.title}”? This can't be undone.`)) { S.deleteRecipe(existing.id); location.hash = '#/'; }
        break;
    }
  };

  function focusLast(sel) { const els = root.querySelectorAll(sel); els[els.length - 1]?.focus(); }

  function pasteSheet() {
    ui.sheet(`<h3>📋 Paste ingredients</h3>
      <p style="color:var(--muted);font-size:.9rem;margin-top:-6px">One per line, copied from any recipe. Lines ending in “:” become sections.</p>
      <textarea class="input" rows="10" placeholder="2 tbsp olive oil&#10;1 onion, diced&#10;Toppings:&#10;1 avocado"></textarea>
      <div class="row" style="margin-top:12px"><button class="btn" data-close style="flex:1">Cancel</button><button class="btn primary" data-add style="flex:2">Add</button></div>`,
      (el, close) => {
        el.querySelector('textarea').focus();
        el.querySelector('[data-add]').onclick = () => {
          for (const line of el.querySelector('textarea').value.split('\n')) {
            const l = line.trim();
            if (!l) continue;
            if (/:$/.test(l) || /^for the /i.test(l)) { d.rows.push({ head: l.replace(/:$/, '').replace(/^for the /i, '') }); continue; }
            const p = U.parseIngredientLine(l);
            if (p) d.rows.push(p);
          }
          close(); render();
        };
      });
  }

  function save() {
    const title = d.title.trim();
    if (!title) { alert('Give the recipe a name first.'); root.querySelector('[data-f=title]').focus(); return; }
    // Rebuild ingredients with their section group.
    let group = '';
    const ingredients = [];
    d.rows.forEach((row, i) => {
      if (row.head != null) { group = /^main$/i.test(row.head.trim()) ? '' : row.head.trim(); return; }
      if (!String(row.name || '').trim()) return;
      const ing = { ...row, name: row.name.trim() };
      if (group) ing.group = group; else delete ing.group;
      ingredients.push(ing);
    });
    const ingIds = new Set(ingredients.map(x => x.id));
    const steps = d.steps.map((s, i) => {
      const earlier = new Set(d.steps.slice(0, i).map(x => x.id));
      const after = Array.isArray(s.after) ? s.after : (i > 0 ? [d.steps[i - 1].id] : []);
      return { ...s, uses: (s.uses || []).filter(u => ingIds.has(u.ing)), after: after.filter(x => earlier.has(x)) };
    });
    let rid = existing?.id;
    if (!rid) { rid = U.slug(title); let n = 2; while (S.recipe(rid)) rid = U.slug(title) + '-' + n++; }
    const recipe = {
      id: rid, title, emoji: d.emoji.trim() || '🍽️', servings: Math.max(1, +d.servings || 1),
      source: d.source.trim(), tags: d.tagsText.split(',').map(x => x.trim()).filter(Boolean),
      ingredients, steps, notes: d.notes || [],
    };
    S.upsertRecipe(recipe);
    location.hash = '#/r/' + encodeURIComponent(rid);
  }

  render();
};
