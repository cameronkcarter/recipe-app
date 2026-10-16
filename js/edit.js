// Inline edit mode for the recipe page. No pop-ups: steps look the same as when cooking,
// but the words are tappable —
//   • action word → pick another        • step number → move the step
//   • amount / name / note / time → type • heat → tap to cycle
//   • drag an ingredient's icon onto another step to move it there
// Every change saves right away.
window.App = window.App || {};
App.edit = (() => {
  const U = App.util, S = App.store;
  const save = r => S.upsertRecipe(r);
  let active = null; // the step being worked on shows its extra controls
  const ing = (r, id) => r.ingredients.find(x => x.id === id);
  const size = v => Math.max(2, String(v || '').length + 1);
  const ctx = document.createElement('canvas').getContext('2d');
  function autosize(el) {
    const cs = getComputedStyle(el);
    ctx.font = cs.font;
    el.style.width = Math.ceil(ctx.measureText(el.value || el.placeholder).width + 8) + 'px';
  }
  const autosizeAll = root => root.querySelectorAll('.inl').forEach(autosize);
  const inl = (attrs, value, ph, cls = '') =>
    `<input class="inl ${cls}" ${attrs} value="${U.esc(value ?? '')}" placeholder="${U.esc(ph)}" size="${size(value || ph)}" autocomplete="off">`;

  const verbOptions = sel => [...new Set(App.VERBS.map(v => v.group))].map(g =>
    `<optgroup label="${g}">${App.VERBS.filter(v => v.group === g)
      .map(v => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${v.label}</option>`).join('')}</optgroup>`).join('');

  // ---------- Rendering ----------
  function stepHtml(r, s, i, chefCls) {
    const v = App.verb(s.verb);
    const usedBefore = new Set(r.steps.slice(0, i).flatMap(x => (x.uses || []).map(u => u.ing)));
    const items = (s.uses || []).map(u => {
      const g = ing(r, u.ing);
      if (!g) return '';
      const first = !usedBefore.has(g.id);
      const amt = first && g.qty != null ? U.fmtAmount(g.qty, U.normUnit(g.unit)) : '';
      return `<li class="ing-item" data-ing="${g.id}">
        <span class="grip" title="Drag to another step">${U.ingIconHtml(g)}</span>
        ${first ? inl(`data-amt="${g.id}" inputmode="decimal" aria-label="Amount"`, amt, 'amt', 'amt') : ''}
        ${inl(`data-name="${g.id}" aria-label="Ingredient"`, g.name, 'name', 'nm')}
        ${u.note ? `<span class="un">· ${U.esc(u.note)}</span>` : ''}
        <button class="x" data-rm-use="${g.id}" aria-label="Remove ${U.esc(g.name)}">✕</button>
      </li>`;
    }).join('');
    const positions = r.steps.map((_, k) => `<option value="${k}" ${k === i ? 'selected' : ''}>${k + 1}</option>`).join('');
    return `<div class="card step edit ${chefCls} ${s.id === active ? 'active' : ''}" data-step="${s.id}">
      <label class="num num-pick ${chefCls}" aria-label="Step number">${i + 1}<select data-pos="${s.id}">${positions}</select></label>
      <div class="body">
        <div class="s-grid">
          <label class="s-verb verb-pick"><span class="vi">${v.icon}</span><span class="vl">${U.esc(v.label)}</span>
            <select data-verb="${s.id}" aria-label="Action">${verbOptions(s.verb)}</select></label>
          <div class="s-what">
            ${items ? `<ul class="s-ings">${items}</ul>` : ''}
            ${inl(`data-add-ing="${s.id}" aria-label="Add ingredient" enterkeyhint="done"`, '', '+ ingredient', 'add-ing')}
            <div class="s-meta">
              ${inl(`data-text="${s.id}" aria-label="Note"`, s.text, '+ note', 'note' + (s.text ? '' : ' empty'))}
              ${inl(`data-time="${s.id}" inputmode="numeric" aria-label="Minutes"`, s.time ? '⏲ ' + s.time + ' min' : '', '⏲ + time', 'time' + (s.time ? '' : ' empty'))}
              <button class="heat-btn ${s.heat ? '' : 'off empty'}" data-heat="${s.id}">🔥 ${s.heat ? U.HEAT[s.heat].toLowerCase() : 'no'} heat</button>
            </div>
          </div>
        </div>
      </div>
      <button class="step-x" data-rm-step="${s.id}" aria-label="Delete step">✕</button>
    </div>`;
  }

  function ingRowHtml(r, g) {
    const amt = g.qty != null ? U.fmtAmount(g.qty, U.normUnit(g.unit)) : '';
    return `<li class="ing-item">${U.ingIconHtml(g)}
      ${inl(`data-amt="${g.id}" inputmode="decimal" aria-label="Amount"`, amt, 'amt', 'amt')}
      ${inl(`data-name="${g.id}" aria-label="Ingredient"`, g.name, 'name', 'nm')}
      <button class="x" data-rm-ing="${g.id}" aria-label="Delete ${U.esc(g.name)}">✕</button></li>`;
  }

  // ---------- Changes ----------
  function setAmount(g, v) {
    v = v.trim();
    if (!v) { g.qty = null; g.unit = ''; return; }
    const p = U.parseIngredientLine(v + ' x');
    g.qty = p?.qty ?? U.parseQty(v);
    g.unit = p?.unit || '';
  }
  function addIngredientToStep(r, stepId, text) {
    const p = U.parseIngredientLine(text);
    if (!p) return;
    const s = r.steps.find(x => x.id === stepId);
    let g = r.ingredients.find(x => x.name.toLowerCase() === p.name.toLowerCase());
    if (!g) {
      g = p;
      const firstTop = r.ingredients.findIndex(x => x.group);
      if (firstTop < 0) r.ingredients.push(g); else r.ingredients.splice(firstTop, 0, g);
    }
    s.uses ||= [];
    if (!s.uses.some(u => u.ing === g.id)) s.uses.push({ ing: g.id });
  }
  // Removing an ingredient from its last step removes it from the recipe too.
  function removeUse(r, stepId, ingId) {
    const s = r.steps.find(x => x.id === stepId);
    s.uses = (s.uses || []).filter(u => u.ing !== ingId);
    if (!r.steps.some(x => (x.uses || []).some(u => u.ing === ingId))) removeIngredient(r, ingId);
  }
  function removeIngredient(r, id) {
    r.ingredients = r.ingredients.filter(x => x.id !== id);
    r.steps.forEach(s => { s.uses = (s.uses || []).filter(u => u.ing !== id); });
  }
  function moveUse(r, fromId, toId, ingId) {
    const from = r.steps.find(x => x.id === fromId), to = r.steps.find(x => x.id === toId);
    const use = (from.uses || []).find(u => u.ing === ingId);
    if (!use || !to || from === to) return;
    from.uses = from.uses.filter(u => u !== use);
    to.uses ||= [];
    if (!to.uses.some(u => u.ing === ingId)) to.uses.push(use);
  }
  // Pin every step's "waits for" list first, so moving/deleting doesn't silently change it.
  const pinDeps = r => r.steps.forEach((s, k) => { s.after = U.stepDeps(r, k); });
  function moveStep(r, id, to) {
    pinDeps(r);
    const from = r.steps.findIndex(s => s.id === id);
    const [s] = r.steps.splice(from, 1);
    r.steps.splice(to, 0, s);
  }
  function deleteStep(r, id) {
    pinDeps(r);
    const gone = r.steps.find(s => s.id === id);
    r.steps = r.steps.filter(s => s !== gone);
    r.steps.forEach(s => { if (s.after.includes(id)) s.after = [...new Set(s.after.filter(x => x !== id).concat(gone.after))]; });
  }
  function newStep(r) {
    const prev = r.steps[r.steps.length - 1];
    const s = { id: U.uid('s'), verb: 'add', uses: [], after: prev ? [prev.id] : [] };
    active = s.id;
    if (isCustomSplit(r)) s.chef = 'A';
    r.steps.push(s);
    return s;
  }

  // ---------- Events ----------
  // Returns a cleanup function (drag listeners live on window).
  function bind(root, r, rerender) {
    const commit = (redraw = false) => { save(r); if (redraw) rerender(); };
    const handlers = [];
    const on = (type, fn) => { root.addEventListener(type, fn); handlers.push([type, fn]); };

    on('input', e => {
      const t = e.target;
      if (t.classList.contains('inl')) autosize(t);
    });
    on('change', e => {
      const t = e.target, d = t.dataset;
      if (d.verb) { r.steps.find(s => s.id === d.verb).verb = t.value; commit(true); }
      else if (d.pos) { moveStep(r, d.pos, +t.value); commit(true); }
      else if (d.amt) { setAmount(ing(r, d.amt), t.value); commit(); }
      else if (d.name) {
        const g = ing(r, d.name);
        if (t.value.trim()) g.name = t.value.trim();
        root.querySelectorAll('[data-name="' + d.name + '"]').forEach(x => { if (x !== t) { x.value = g.name; autosize(x); } });
        commit();
      }
      else if (d.text) { r.steps.find(s => s.id === d.text).text = t.value.trim() || undefined; commit(); }
      else if (d.time) { const n = parseFloat(t.value.replace(/[^d.]/g, '')); r.steps.find(s => s.id === d.time).time = n > 0 ? n : undefined; t.value = n > 0 ? '⏲ ' + n + ' min' : ''; autosize(t); commit(); }
      else if (d.addIng && t.value.trim()) { addIngredientToStep(r, d.addIng, t.value); commit(true); }
    });
    on('keydown', e => {
      if (e.key === 'Enter' && e.target.classList.contains('inl')) { e.preventDefault(); e.target.blur(); }
    });
    on('click', e => {
      const card = e.target.closest('.step.edit');
      if (card && card.dataset.step !== active) {
        active = card.dataset.step;
        root.querySelectorAll('.step.edit.active').forEach(x => x.classList.remove('active'));
        card.classList.add('active');
      }
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      if (d.heat) { const s = r.steps.find(x => x.id === d.heat); s.heat = ((s.heat || 0) + 1) % 4 || undefined; commit(true); }
      else if (d.rmUse) { removeUse(r, t.closest('[data-step]').dataset.step, d.rmUse); commit(true); }
      else if (d.rmIng) { removeIngredient(r, d.rmIng); commit(true); }
      else if (d.rmStep) {
        const s = r.steps.find(x => x.id === d.rmStep);
        if ((s.uses || []).length && !confirm('Delete this step?')) return;
        deleteStep(r, d.rmStep); commit(true);
      }
    });
    const unDrag = bindDrag(root, r, commit);
    return () => { handlers.forEach(([t, fn]) => root.removeEventListener(t, fn)); unDrag(); };
  }

  // Drag an ingredient (by its icon) onto another step, or onto "+ Add step" to start a new one.
  function bindDrag(root, r, commit) {
    let drag = null;
    const targetAt = (x, y) => {
      drag.ghost.style.display = 'none';
      const el = document.elementFromPoint(x, y);
      drag.ghost.style.display = '';
      return el && (el.closest('.step.edit') || el.closest('[data-act="add-step"]'));
    };
    const onMove = e => {
      if (!drag) return;
      e.preventDefault();
      drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px)`;
      const tgt = targetAt(e.clientX, e.clientY);
      if (tgt !== drag.over) { drag.over?.classList.remove('drop'); drag.over = tgt; tgt?.classList.add('drop'); }
      // scroll when dragging near the top or bottom edge
      const edge = 70;
      if (e.clientY < edge) window.scrollBy(0, -12); else if (e.clientY > innerHeight - edge) window.scrollBy(0, 12);
    };
    const onUp = () => {
      if (!drag) return;
      const { over, ingId, from } = drag;
      drag.ghost.remove(); drag.item.classList.remove('dragging'); over?.classList.remove('drop');
      document.body.classList.remove('dragging-ing');
      drag = null;
      if (!over) return;
      const to = over.dataset.act === 'add-step' ? newStep(r).id : over.dataset.step;
      moveUse(r, from, to, ingId);
      commit(true);
    };
    const onDown = e => {
      const grip = e.target.closest('.grip');
      if (!grip || e.button > 0) return;
      const item = grip.closest('.ing-item'), step = grip.closest('[data-step]');
      if (!item || !step) return;
      e.preventDefault();
      const rect = item.getBoundingClientRect();
      const ghost = item.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.width = rect.width + 'px';
      ghost.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      document.body.appendChild(ghost);
      item.classList.add('dragging');
      document.body.classList.add('dragging-ing');
      drag = { item, ghost, ingId: item.dataset.ing, from: step.dataset.step, dx: e.clientX - rect.left, dy: e.clientY - rect.top, over: null };
      navigator.vibrate?.(15);
    };
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      drag?.ghost.remove();
    };
  }

  // ---------- Co-op ----------
  // First manual change freezes the current split, so only the tapped step moves.
  function swapChef(r, stepId) {
    if (!isCustomSplit(r)) {
      const duo = U.schedule(r, 2);
      r.steps.forEach(s => { s.chef = duo.byId[s.id].chef; });
    }
    const s = r.steps.find(x => x.id === stepId);
    s.chef = s.chef === 'A' ? 'B' : 'A';
    save(r);
  }
  function isCustomSplit(r) { return r.steps.some(s => s.chef === 'A' || s.chef === 'B'); }
  function autoSplit(r) { r.steps.forEach(s => delete s.chef); save(r); }

  return { autosizeAll, stepHtml, ingRowHtml, bind, newStep, swapChef, autoSplit, isCustomSplit };
})();
