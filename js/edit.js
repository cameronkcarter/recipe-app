// Edit panels used by the recipe page's edit mode: step, ingredient, paste list.
// Every change is applied to the recipe and saved right away — there's no separate "save".
window.App = window.App || {};
App.edit = (() => {
  const U = App.util, S = App.store;
  const save = r => S.upsertRecipe(r);

  const verbOptions = sel => [...new Set(App.VERBS.map(v => v.group))].map(g =>
    `<optgroup label="${g}">${App.VERBS.filter(v => v.group === g)
      .map(v => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}</optgroup>`).join('');

  // ---------- Step ----------
  function stepSheet(r, id, onClose) {
    const s = () => r.steps.find(x => x.id === id);
    const idx = () => r.steps.findIndex(x => x.id === id);

    let moreOpen = false;
    App.ui.sheet('<div class="es"></div>', (el, close) => {
      const box = el.querySelector('.es');
      const draw = () => {
        const st = s(), i = idx();
        const used = (st.uses || []).map(u => u.ing);
        const deps = U.stepDeps(r, i);
        const oven = App.verb(st.verb).group === 'Oven';
        box.innerHTML = `
          <div class="sheet-head"><h3>Step ${i + 1}</h3><button class="btn small primary" data-close>Done</button></div>
          <select class="input verb-select" data-f="verb" aria-label="Action">${verbOptions(st.verb)}</select>

          <div class="mini">Ingredients</div>
          <div class="chips">${r.ingredients.map(ing => `<button class="chip ${used.includes(ing.id) ? 'on' : ''}" data-use="${ing.id}">${U.ingIcon(ing.name) || ''} ${U.esc(ing.name)}</button>`).join('')
            }</div>
          <input class="input new-ing" data-newing placeholder="+ New ingredient, e.g. 1 tbsp butter" aria-label="New ingredient">

          <div class="mini">Note</div>
          <input class="input" data-f="text" value="${U.esc(st.text || '')}" placeholder="large pot · until golden">

          <div class="es-row">
            <div><div class="mini">Time</div><input class="input" type="number" min="0" inputmode="numeric" data-f="time" value="${st.time ?? ''}" placeholder="min"></div>
            ${oven ? `<div><div class="mini">Oven</div><input class="input" data-f="temp" value="${U.esc(st.temp || '')}" placeholder="400°F"></div>` : ''}
          </div>
          <div class="mini">Heat</div>
          <div class="seg">${U.HEAT.map((h, n) => `<button data-heat="${n}" class="${(st.heat || 0) === n ? 'on' : ''}">${n ? h : 'Off'}</button>`).join('')}</div>

          <details class="es-more" ${moreOpen ? "open" : ""}>
            <summary>More</summary>
            ${(st.uses || []).length ? `<div class="mini">Amount · note per ingredient</div>` : ""}
            ${(st.uses || []).map(u => {
              const ing = r.ingredients.find(x => x.id === u.ing);
              if (!ing) return '';
              const amt = u.qty != null ? U.fmtQty(u.qty) + (u.unit && u.unit !== ing.unit ? ' ' + u.unit : '') : '';
              return `<div class="use-row"><span>${U.esc(ing.name)}</span>
                <input data-amt="${ing.id}" value="${U.esc(amt)}" placeholder="${U.esc(U.fmtAmount(ing.qty, U.normUnit(ing.unit)) || 'amt')}" aria-label="Amount for ${U.esc(ing.name)}">
                <input data-unote="${ing.id}" value="${U.esc(u.note || '')}" placeholder="note" aria-label="Note for ${U.esc(ing.name)}"></div>`;
            }).join('')}
            <div class="mini">Details</div>
            <textarea class="input" rows="3" data-f="detail" placeholder="Extra instructions (hidden until tapped)">${U.esc(st.detail || '')}</textarea>
            ${i > 0 ? `<div class="mini">Waits for</div>
              <div class="chips">${r.steps.slice(0, i).map((p, j) => `<button class="chip ${deps.includes(p.id) ? 'on' : ''}" data-dep="${p.id}">${j + 1} · ${App.verb(p.verb).label}</button>`).join('')}</div>` : ''}
          </details>

          <div class="es-foot">
            ${i < r.steps.length - 1 ? `<button class="btn small" data-act="merge">⤓ Merge with next</button>` : '<span></span>'}
            <button class="btn small danger" data-act="delete">Delete step</button>
          </div>`;
      };

      // Typing a new ingredient + Enter adds it to the recipe and to this step.
      box.addEventListener('toggle', e => { if (e.target.classList.contains('es-more')) moreOpen = e.target.open; }, true);
      box.onkeydown = e => {
        if (e.key !== 'Enter' || e.target.dataset.newing == null) return;
        e.preventDefault();
        const p = U.parseIngredientLine(e.target.value);
        if (!p) return;
        const firstTop = r.ingredients.findIndex(i => i.group);
        if (firstTop < 0) r.ingredients.push(p); else r.ingredients.splice(firstTop, 0, p);
        (s().uses ||= []).push({ ing: p.id });
        save(r); draw();
        box.querySelector('[data-newing]').focus();
      };
      box.oninput = e => {
        const t = e.target, st = s();
        if (t.dataset.f) {
          const f = t.dataset.f;
          if (f === 'time') st.time = t.value === '' ? undefined : +t.value;
          else st[f] = t.value || undefined;
          save(r);
          if (f === 'verb') draw();
        } else if (t.dataset.amt) {
          const u = st.uses.find(x => x.ing === t.dataset.amt);
          const v = t.value.trim();
          if (!v) { delete u.qty; delete u.unit; }
          else { const p = U.parseIngredientLine(v + ' x'); u.qty = p?.qty ?? U.parseQty(v); u.unit = p?.unit || undefined; }
          save(r);
        } else if (t.dataset.unote) {
          st.uses.find(x => x.ing === t.dataset.unote).note = t.value.trim() || undefined;
          save(r);
        }
      };
      box.onclick = e => {
        const t = e.target.closest('button');
        if (!t) return;
        const st = s(), i = idx();
        if (t.dataset.use) {
          st.uses ||= [];
          const k = st.uses.findIndex(u => u.ing === t.dataset.use);
          if (k > -1) st.uses.splice(k, 1); else st.uses.push({ ing: t.dataset.use });
        } else if (t.dataset.heat) {
          st.heat = +t.dataset.heat || undefined;
        } else if (t.dataset.dep) {
          const deps = U.stepDeps(r, i);
          const k = deps.indexOf(t.dataset.dep);
          if (k > -1) deps.splice(k, 1); else deps.push(t.dataset.dep);
          st.after = deps;
        } else if (t.dataset.act === 'merge') {
          mergeWithNext(r, i);
        } else if (t.dataset.act === 'delete') {
          if (!confirm('Delete this step?')) return;
          deleteStep(r, i); save(r); close(); return;
        } else return;
        save(r); draw();
      };
      draw();
    }, onClose);
  }

  function mergeWithNext(r, i) {
    const a = r.steps[i], b = r.steps[i + 1];
    for (const u of b.uses || []) if (!(a.uses ||= []).some(x => x.ing === u.ing)) a.uses.push(u);
    a.text = [a.text, b.text].filter(Boolean).join(', ') || undefined;
    a.detail = [a.detail, b.detail].filter(Boolean).join(' ') || undefined;
    a.time = a.time || b.time ? (+a.time || 0) + (+b.time || 0) : undefined;
    a.heat = a.heat || b.heat;
    a.temp = a.temp || b.temp;
    a.after = [...new Set([...U.stepDeps(r, i), ...U.stepDeps(r, i + 1)])].filter(x => x !== a.id);
    r.steps.splice(i + 1, 1);
    // anything that waited for the removed step now waits for the merged one
    r.steps.forEach(s => {
      if (Array.isArray(s.after) && s.after.includes(b.id)) s.after = [...new Set(s.after.map(x => x === b.id ? a.id : x))].filter(x => x !== s.id);
    });
  }

  function deleteStep(r, i) {
    const gone = r.steps[i];
    const goneDeps = U.stepDeps(r, i);
    // explicit "after" lists keep their order, implicit ones (previous step) need to be pinned first
    r.steps.forEach((s, j) => { s.after = U.stepDeps(r, j); });
    r.steps.splice(i, 1);
    r.steps.forEach(s => {
      if (s.after.includes(gone.id)) s.after = [...new Set(s.after.filter(x => x !== gone.id).concat(goneDeps))];
    });
    r.notes = (r.notes || []).filter(n => n.target !== 'step:' + gone.id);
  }

  // ---------- Ingredient ----------
  function ingredientSheet(r, id, onClose) {
    const ing = r.ingredients.find(x => x.id === id);
    App.ui.sheet(`
      <div class="sheet-head"><h3>Ingredient</h3><button class="btn small primary" data-close>Done</button></div>
      <div class="es-ing">
        <input class="input" data-f="qty" value="${ing.qty != null ? U.esc(U.fmtQty(ing.qty)) : ''}" placeholder="qty" inputmode="decimal" aria-label="Quantity">
        <input class="input" data-f="unit" value="${U.esc(ing.unit || '')}" placeholder="unit" list="units" aria-label="Unit">
        <input class="input" data-f="name" value="${U.esc(ing.name)}" placeholder="name" aria-label="Name">
      </div>
      <datalist id="units">${U.UNITS.map(u => `<option value="${u}">`).join('')}</datalist>
      <input class="input" data-f="note" value="${U.esc(ing.note || '')}" placeholder="note (optional)" style="margin-top:8px" aria-label="Note">
      <label class="toggle"><input type="checkbox" data-f="topping" ${ing.group ? 'checked' : ''}> Topping</label>
      <div class="es-foot"><span></span><button class="btn small danger" data-act="delete">Delete</button></div>`,
      (el, close) => {
        if (!ing.name) el.querySelector('[data-f=name]').focus();
        el.oninput = e => {
          const f = e.target.dataset.f;
          if (!f) return;
          if (f === 'qty') ing.qty = U.parseQty(e.target.value);
          else if (f === 'unit') ing.unit = U.normUnit(e.target.value);
          else if (f === 'topping') { if (e.target.checked) ing.group = 'Toppings'; else delete ing.group; }
          else ing[f] = e.target.value.trim() || (f === 'name' ? '' : undefined);
          save(r);
        };
        el.querySelector('[data-act=delete]').onclick = () => { removeIngredient(r, id); save(r); close(); };
      },
      () => { if (!ing.name) removeIngredient(r, id); sortToppingsLast(r); save(r); onClose && onClose(); });
  }

  function removeIngredient(r, id) {
    r.ingredients = r.ingredients.filter(x => x.id !== id);
    r.steps.forEach(s => { s.uses = (s.uses || []).filter(u => u.ing !== id); });
    r.notes = (r.notes || []).filter(n => n.target !== 'ing:' + id);
  }
  const sortToppingsLast = r => { r.ingredients = [...r.ingredients.filter(i => !i.group), ...r.ingredients.filter(i => i.group)]; };

  function pasteSheet(r, onClose) {
    App.ui.sheet(`
      <div class="sheet-head"><h3>Paste ingredients</h3><button class="btn small" data-close>Cancel</button></div>
      <textarea class="input" rows="9" placeholder="One per line&#10;2 tbsp olive oil&#10;1 onion, diced"></textarea>
      <button class="btn primary block" data-add style="margin-top:10px">Add</button>`,
      (el, close) => {
        el.querySelector('textarea').focus();
        el.querySelector('[data-add]').onclick = () => {
          let group;
          for (const line of el.querySelector('textarea').value.split('\n')) {
            const l = line.trim();
            if (!l) continue;
            if (/:$/.test(l)) { group = /topping|serv|garnish/i.test(l) ? 'Toppings' : undefined; continue; }
            const p = U.parseIngredientLine(l);
            if (p) { if (group) p.group = group; r.ingredients.push(p); }
          }
          sortToppingsLast(r); save(r); close();
        };
      }, onClose);
  }

  // ---------- Co-op ----------
  // First manual change freezes the current split, so only the tapped step moves.
  function swapChef(r, stepId) {
    if (!r.steps.some(s => s.chef === 'A' || s.chef === 'B')) {
      const duo = U.schedule(r, 2);
      r.steps.forEach(s => { s.chef = duo.byId[s.id].chef; });
    }
    const s = r.steps.find(x => x.id === stepId);
    s.chef = s.chef === 'A' ? 'B' : 'A';
    save(r);
  }
  const isCustomSplit = r => r.steps.some(s => s.chef === 'A' || s.chef === 'B');
  function autoSplit(r) { r.steps.forEach(s => delete s.chef); save(r); }

  function newStep(r) {
    const prev = r.steps[r.steps.length - 1];
    const s = { id: U.uid('s'), verb: 'add', uses: [], after: prev ? [prev.id] : [] };
    if (isCustomSplit(r)) s.chef = 'A';
    r.steps.push(s); save(r);
    return s.id;
  }
  function newIngredient(r) {
    const ing = { id: U.uid('i'), qty: null, unit: '', name: '' };
    const firstTop = r.ingredients.findIndex(i => i.group);
    if (firstTop < 0) r.ingredients.push(ing); else r.ingredients.splice(firstTop, 0, ing);
    return ing.id;
  }

  return { stepSheet, ingredientSheet, pasteSheet, swapChef, autoSplit, isCustomSplit, newStep, newIngredient };
})();
