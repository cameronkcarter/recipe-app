// Inline edit mode for the recipe page. No pop-ups: steps look the same as when cooking, but
//   • each ingredient is a bubble — drag it onto another step, tap its words to type
//   • drag a step (by its number, or press-and-hold anywhere on it) to move it up or down
//   • tap the action word to pick another; tap note / time to type; tap heat to cycle
// Changes stay on a working copy until Done (Cancel discards them).
window.App = window.App || {};
App.edit = (() => {
  const U = App.util, S = App.store;
  const save = r => S.upsertRecipe(r);
  let active = null; // the step being worked on shows its extra controls
  const ing = (r, id) => r.ingredients.find(x => x.id === id);

  // Typing boxes are sized to their text so they read like normal words.
  const ctx = document.createElement('canvas').getContext('2d');
  function autosize(el) {
    ctx.font = getComputedStyle(el).font;
    el.style.width = Math.ceil(ctx.measureText(el.value || el.placeholder).width + 8) + 'px';
  }
  const autosizeAll = root => root.querySelectorAll('.inl').forEach(autosize);
  const inl = (attrs, value, ph, cls = '') =>
    `<input class="inl ${cls}" ${attrs} value="${U.esc(value ?? '')}" placeholder="${U.esc(ph)}" autocomplete="off">`;

  const verbOptions = sel => [...new Set(App.VERBS.map(v => v.group))].map(g =>
    `<optgroup label="${g}">${App.VERBS.filter(v => v.group === g)
      .map(v => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${v.label}</option>`).join('')}</optgroup>`).join('');

  // ---------- Rendering ----------
  function stepHtml(r, s, i, chefCls) {
    const v = App.verb(s.verb);
    const usedBefore = new Set(r.steps.slice(0, i).flatMap(x => (x.uses || []).map(u => u.ing)));
    const bubbles = (s.uses || []).map((u, k) => {
      const g = ing(r, u.ing);
      if (!g) return '';
      const first = !usedBefore.has(g.id);
      const amt = first && g.qty != null ? U.fmtAmount(g.qty, U.normUnit(g.unit)) : '';
      return `<li class="bubble" data-ing="${g.id}" style="--i:${(i + k) % 5}">
        ${U.ingIconHtml(g)}
        ${first ? inl(`data-amt="${g.id}" inputmode="decimal" aria-label="Amount"`, amt, 'amt', 'amt' + (amt ? '' : ' empty')) : ''}
        ${inl(`data-name="${g.id}" aria-label="Ingredient"`, g.name, 'name', 'nm')}
        ${inl(`data-unote="${g.id}" aria-label="Note"`, u.note, '+ note', 'un' + (u.note ? '' : ' empty'))}
        <button class="x" data-rm-use="${g.id}" aria-label="Remove ${U.esc(g.name)}">✕</button>
      </li>`;
    }).join('');
    return `<div class="card step edit ${chefCls} ${s.id === active ? 'active' : ''}" data-step="${s.id}">
      <div class="num step-handle ${chefCls}" title="Drag to move">${i + 1}</div>
      <div class="body">
        <div class="s-grid">
          <label class="s-verb verb-pick ${v.label.length > 7 ? 'long' : ''}"><span class="vi">${v.icon}</span><span class="vl">${U.esc(v.label)}</span>
            <select data-verb="${s.id}" aria-label="Action">${verbOptions(s.verb)}</select></label>
          <div class="s-what">
            ${bubbles ? `<ul class="s-ings">${bubbles}</ul>` : ''}
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
  // Returns a cleanup function.
  function bind(root, r, rerender) {
    const commit = (redraw = false) => { if (redraw) rerender(); }; // saved on Done
    const handlers = [];
    const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); handlers.push([target, type, fn, opts]); };

    on(root, 'input', e => { if (e.target.classList.contains('inl')) autosize(e.target); });
    on(root, 'change', e => {
      const t = e.target, d = t.dataset;
      if (d.verb) { r.steps.find(s => s.id === d.verb).verb = t.value; commit(true); }
      else if (d.amt) { setAmount(ing(r, d.amt), t.value); commit(); }
      else if (d.name) {
        const g = ing(r, d.name);
        if (t.value.trim()) g.name = t.value.trim();
        root.querySelectorAll(`[data-name="${d.name}"]`).forEach(x => { if (x !== t) { x.value = g.name; autosize(x); } });
        commit();
      }
      else if (d.unote) {
        const st = r.steps.find(s => s.id === t.closest('[data-step]').dataset.step);
        st.uses.find(u => u.ing === d.unote).note = t.value.trim() || undefined;
        commit();
      }
      else if (d.text) { r.steps.find(s => s.id === d.text).text = t.value.trim() || undefined; commit(); }
      else if (d.time) {
        const n = parseFloat(t.value.replace(/[^\d.]/g, ''));
        r.steps.find(s => s.id === d.time).time = n > 0 ? n : undefined;
        t.value = n > 0 ? '⏲ ' + n + ' min' : ''; autosize(t); commit();
      }
      else if (d.addIng && t.value.trim()) { addIngredientToStep(r, d.addIng, t.value); commit(true); }
    });
    on(root, 'keydown', e => {
      if (e.key === 'Enter' && e.target.classList.contains('inl')) { e.preventDefault(); e.target.blur(); }
    });
    on(root, 'click', e => {
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
    bindDrag(root, r, commit, on);
    return () => handlers.forEach(([t, type, fn, opts]) => t.removeEventListener(type, fn, opts));
  }

  // ---------- Dragging ----------
  // Ingredient bubbles: drag onto another step (or "+ Add step"). A tap still edits the word.
  // Steps: drag by the number right away, or press-and-hold anywhere on the step (on touch).
  function bindDrag(root, r, commit, on) {
    let pending = null, drag = null, holdTimer = null;

    const isControl = el => el.closest('select, button, .add-ing, .s-meta, .verb-pick');
    const startDrag = (p, e) => {
      const el = p.el, rect = el.getBoundingClientRect();
      const ghost = el.cloneNode(true);
      ghost.classList.add(p.kind === 'ing' ? 'bubble-ghost' : 'step-ghost');
      ghost.classList.remove('active');
      ghost.style.width = rect.width + 'px';
      document.body.appendChild(ghost);
      el.classList.add(p.kind === 'ing' ? 'dragging' : 'placeholder');
      document.body.classList.add('dragging-now');
      document.activeElement?.blur?.();
      drag = { ...p, ghost, dx: p.x - rect.left, dy: p.y - rect.top, over: null };
      place(e.clientX, e.clientY);
      navigator.vibrate?.(15);
    };
    const place = (x, y) => { drag.ghost.style.transform = `translate(${x - drag.dx}px, ${y - drag.dy}px)`; };
    const under = (x, y) => {
      drag.ghost.style.visibility = 'hidden';
      const el = document.elementFromPoint(x, y);
      drag.ghost.style.visibility = '';
      return el;
    };

    on(root, 'pointerdown', e => {
      if (e.button > 0 || drag) return;
      const bubble = e.target.closest('.step.edit .bubble');
      const card = e.target.closest('.step.edit');
      if (!card || e.target.closest('.x, .step-x')) return;
      if (bubble) {
        if (e.target === document.activeElement) return;      // already typing in it
        e.preventDefault();                                     // don't focus yet — might be a drag
        pending = { kind: 'ing', el: bubble, from: card.dataset.step, ingId: bubble.dataset.ing, x: e.clientX, y: e.clientY, tapTarget: e.target };
      } else if (e.target.closest('.step-handle')) {
        e.preventDefault();
        pending = { kind: 'step', el: card, x: e.clientX, y: e.clientY, now: true };
      } else if (!isControl(e.target) && !e.target.closest('input')) {
        pending = { kind: 'step', el: card, x: e.clientX, y: e.clientY, now: e.pointerType === 'mouse' };
        if (e.pointerType !== 'mouse') holdTimer = setTimeout(() => { if (pending) startDrag(pending, e); }, 350);
      }
    });

    on(window, 'pointermove', e => {
      if (pending && !drag) {
        const moved = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
        if (pending.kind === 'step' && !pending.now) { if (moved > 8) { clearTimeout(holdTimer); pending = null; } return; } // scrolling
        if (moved > 5) startDrag(pending, e);
        return;
      }
      if (!drag) return;
      e.preventDefault();
      place(e.clientX, e.clientY);
      if (drag.kind === 'ing') {
        const el = under(e.clientX, e.clientY);
        const tgt = el && (el.closest('.step.edit') || el.closest('[data-act="add-step"]'));
        if (tgt !== drag.over) { drag.over?.classList.remove('drop'); drag.over = tgt; tgt?.classList.add('drop'); }
      } else {
        // slide the step's empty slot to where it would land
        const cards = [...root.querySelectorAll('.step.edit:not(.placeholder)')];
        const before = cards.find(c => { const b = c.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
        const list = drag.el.parentNode;
        if (before) { if (drag.el.nextElementSibling !== before) list.insertBefore(drag.el, before); }
        else if (list.lastElementChild !== drag.el) list.appendChild(drag.el);
      }
      const edge = 80;
      if (e.clientY < edge) window.scrollBy(0, -14); else if (e.clientY > innerHeight - edge) window.scrollBy(0, 14);
    }, { passive: false });

    // stop the page scrolling while something is being dragged (touch)
    on(window, 'touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });

    const end = () => {
      clearTimeout(holdTimer);
      const p = pending; pending = null;
      if (!drag) {
        // a tap on a bubble's word → start typing in it
        if (p?.kind === 'ing' && p.tapTarget.matches('input')) { p.tapTarget.focus(); p.tapTarget.select(); }
        return;
      }
      const d = drag; drag = null;
      d.ghost.remove();
      document.body.classList.remove('dragging-now');
      if (d.kind === 'ing') {
        d.el.classList.remove('dragging'); d.over?.classList.remove('drop');
        if (d.over) {
          const to = d.over.dataset.act === 'add-step' ? newStep(r).id : d.over.dataset.step;
          moveUse(r, d.from, to, d.ingId);
        }
      } else {
        d.el.classList.remove('placeholder');
        const order = [...root.querySelectorAll('.step.edit')].map(c => c.dataset.step);
        active = d.el.dataset.step;
        moveStep(r, active, order.indexOf(active));
      }
      commit(true);
    };
    on(window, 'pointerup', end);
    on(window, 'pointercancel', end);
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
