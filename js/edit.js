// Inline edit mode for the recipe page. No pop-ups: steps look the same as when cooking, but
//   • each ingredient is a bubble — drag it onto another step, tap its words to type
//   • drag a step (by its number, or press-and-hold anywhere on it) to move it up or down
//   • tap the action to pick another from an icon menu; tap note / time to type; tap heat to cycle
//   • typing an ingredient suggests matches (with icons), this recipe's own ingredients first
//   • the + between steps adds a step right there
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
  const autosizeAll = root => root.querySelectorAll('input.inl:not(.add-ing)').forEach(autosize);
  const inl = (attrs, value, ph, cls = '') =>
    `<input class="inl ${cls}" ${attrs} value="${U.esc(value ?? '')}" placeholder="${U.esc(ph)}" autocomplete="off">`;

  // The action menu: every action as an icon with its word, in small groups.
  const verbMenuHtml = sel => [...new Set(App.VERBS.map(v => v.group))].map(g =>
    `<div class="pop-head">${g}</div><div class="acts">${App.VERBS.filter(v => v.group === g)
      .map(v => `<button class="act ${v.id === sel ? 'on' : ''}" data-pick="${v.id}">${App.icon(v.icon)}${v.label}</button>`).join('')}</div>`).join('');

  // ---------- Rendering ----------
  // chef: "A"/"B" when co-op is on, so the step shows a tag you can tap to switch chefs.
  function stepHtml(r, s, i, chefCls, chef) {
    const v = App.verb(s.verb);
    const usedBefore = new Set(r.steps.slice(0, i).flatMap(x => (x.uses || []).map(u => u.ing)));
    const bubbles = (s.uses || []).map((u, k) => {
      if (u.from) return App.ui.mixtureHtml(r, u.from, `<button class="x" data-rm-from="${u.from}" aria-label="Remove">${App.glyph('x')}</button>`);
      const g = ing(r, u.ing);
      if (!g) return '';
      const first = !usedBefore.has(g.id);
      const amt = first && (g.qty != null || g.unit) ? U.fmtAmount(g.qty, U.normUnit(g.unit)) : '';
      return `<li class="bubble" data-ing="${g.id}" style="--i:${(i + k) % 5}">
        ${U.ingIconHtml(g)}
        ${first ? inl(`data-amt="${g.id}" inputmode="decimal" aria-label="Amount"`, amt, 'amt', 'amt' + (amt ? '' : ' empty')) : ''}
        ${inl(`data-name="${g.id}" aria-label="Ingredient"`, g.name, 'name', 'nm')}
        <span class="inl un ${u.note ? '' : 'empty'}" contenteditable="true" role="textbox" data-unote="${g.id}" data-ph="+ prep" aria-label="How it's prepped (diced, drained…)">${U.esc(u.note || '')}</span>
        <button class="x" data-rm-use="${g.id}" aria-label="Remove ${U.esc(g.name)}">${App.glyph('x')}</button>
      </li>`;
    }).join('');
    return `<div class="card step edit ${chefCls} ${s.id === active ? 'active' : ''}" data-step="${s.id}">
      <div class="num step-handle ${chefCls}" title="Drag to move">${i + 1}</div>
      ${chef ? `<button class="chef-pill pill-${chef}" data-chef-swap="${s.id}" aria-label="Chef ${chef} — tap to switch">${chef}</button>` : ''}
      <div class="body">
        <div class="s-grid">
          <button type="button" class="s-verb verb-pick ${v.label.length > 7 ? 'long' : ''}" data-pick-verb="${s.id}" aria-label="Action: ${U.esc(v.label)}. Tap to change"><span class="vi">${App.icon(v.icon)}</span><span class="vl">${U.esc(v.label)}</span></button>
          <div class="s-what">
            ${bubbles ? `<ul class="s-ings">${bubbles}</ul>` : ''}
            ${inl(`data-add-ing="${s.id}" aria-label="Add an ingredient (optional)" enterkeyhint="done"`, '', s.uses?.length ? '+ ingredient' : '+ ingredient, or leave empty', 'add-ing')}
            <div class="s-meta">
              <label class="opt ${s.time ? '' : 'empty'}">${App.icon('clock')}${inl(`data-time="${s.id}" inputmode="numeric" aria-label="Minutes"`, s.time ? s.time + ' min' : '', 'time', 'time')}</label>
              <button class="opt heat-btn ${s.heat ? '' : 'off empty'}" data-heat="${s.id}">${App.icon('flame')}${s.heat ? U.HEAT[s.heat].toLowerCase() + ' heat' : 'heat'}</button>
              <label class="opt wide ${s.text ? '' : 'empty'}">${App.glyph('pencil')}${inl(`data-text="${s.id}" aria-label="Note for this step (until…, then…)"`, s.text, 'note (until…, then…)', 'note')}</label>
              ${(s.uses || []).length > 1 || s.makes ? `<label class="opt wide ${s.makes ? '' : 'empty'}">${App.icon('bowl')}${inl(`data-makes="${s.id}" aria-label="What this step makes, to use in a later step"`, s.makes, 'makes… (spice mix, sauce)', 'note')}</label>` : ''}
            </div>
          </div>
        </div>
      </div>
      <button class="step-x" data-rm-step="${s.id}" aria-label="Delete step">${App.glyph('x')}</button>
    </div>`;
  }

  function ingRowHtml(r, g) {
    const amt = g.qty != null || g.unit ? U.fmtAmount(g.qty, U.normUnit(g.unit)) : '';
    return `<li class="ing-item" data-ing-row="${g.id}"><button type="button" class="ico-pick" data-ing-icon="${g.id}" aria-label="Change the icon for ${U.esc(g.name)}">${U.ingIconHtml(g)}</button>
      ${inl(`data-amt="${g.id}" inputmode="decimal" aria-label="Amount"`, amt, 'amt', 'amt')}
      ${inl(`data-name="${g.id}" aria-label="Ingredient"`, g.name, 'name', 'nm')}
      <span class="ing-grip" aria-label="Drag to move ${U.esc(g.name)}" title="Drag to move">${App.glyph('grip')}</span>
      <button class="x" data-rm-ing="${g.id}" aria-label="Delete ${U.esc(g.name)}">${App.glyph('x')}</button></li>`;
  }

  // The ingredient icon menu: "Automatic" (follow the name) first, then every icon in small groups.
  function ingIconMenu(r, g, anchor, done) {
    const cur = U.iconName(g.icon);
    const auto = U.ingIcon(g.name);
    const html = `<button class="sug ${cur ? '' : 'on'}" data-pick="">${auto ? `<span class="ing-ico">${App.icon(auto)}</span>` : '<span class="ing-ico letter">A</span>'}Automatic<small>from the name</small></button>` +
      App.ING_ICON_GROUPS.map(([label, ics]) => `<div class="pop-head">${label}</div><div class="ico-grid">${ics.map(ic => `<button class="ico ${ic === cur ? 'on' : ''}" data-pick="${ic}" aria-label="${ic}">${App.icon(ic)}</button>`).join('')}</div>`).join('');
    App.ui.popover(anchor, html, ic => { if (ic) g.icon = ic; else delete g.icon; done(); });
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
    const st = r.steps.find(x => x.id === stepId), mix = U.findMixture(r, r.steps.indexOf(st), p.name);
    if (mix) return U.useMixture(r, st, mix.id);
    p.name = U.canonName(p.name);
    const s = r.steps.find(x => x.id === stepId);
    let g = U.findIngredient(r.ingredients, p.name);
    if (g && g.qty == null && !g.unit && (p.qty != null || p.unit)) { g.qty = p.qty; g.unit = p.unit; } // typed an amount it didn't have yet
    if (!g) {
      g = p;
      const firstTop = r.ingredients.findIndex(x => x.group);
      if (firstTop < 0) r.ingredients.push(g); else r.ingredients.splice(firstTop, 0, g);
    }
    s.uses ||= [];
    if (!s.uses.some(u => u.ing === g.id)) s.uses.push(p.note && g !== p ? { ing: g.id, note: p.note } : { ing: g.id });
  }
  // The ingredient list (edit mode) can take ingredients before any step uses them.
  function addIngredientToList(r, text) {
    const p = U.parseIngredientLine(text);
    if (!p) return;
    p.name = U.canonName(p.name);
    const g = U.findIngredient(r.ingredients, p.name);
    if (g) { if (p.qty != null || p.unit) { g.qty = p.qty; g.unit = p.unit; } if (p.note) g.note = p.note; return; }
    const firstTop = r.ingredients.findIndex(x => x.group);
    if (firstTop < 0) r.ingredients.push(p); else r.ingredients.splice(firstTop, 0, p);
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
  // A new step at position `at` (default: the end). It follows the step before it, and the step after it
  // now waits for it instead. A step added at the very start doesn't hold anything up (it can run alongside).
  function newStep(r, at = r.steps.length) {
    const prev = r.steps[at - 1], next = r.steps[at];
    const s = { id: U.uid('s'), verb: 'add', uses: [], after: prev ? [prev.id] : [] };
    if (prev && next && Array.isArray(next.after) && next.after.includes(prev.id)) next.after = next.after.map(x => x === prev.id ? s.id : x);
    active = s.id;
    if (isCustomSplit(r)) s.chef = 'A';
    r.steps.splice(at, 0, s);
    return s;
  }

  // ---------- Events ----------
  // Returns a cleanup function.
  function bind(root, r, rerender) {
    const commit = (redraw = false) => { if (redraw) rerender(); }; // saved on Done
    const handlers = [];
    const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); handlers.push([target, type, fn, opts]); };

    // notes are editable text (they wrap); kept on the working copy as you type
    const setNote = t => {
      const st = r.steps.find(s => s.id === t.closest('[data-step]').dataset.step);
      st.uses.find(u => u.ing === t.dataset.unote).note = t.textContent.trim() || undefined;
    };
    on(root, 'input', e => {
      if (e.target.matches('input.inl:not(.add-ing)')) autosize(e.target);
      const box = e.target;
      if (box.matches('[data-add-ing], [data-add-list]')) {
        const at = box.dataset.addIng ? r.steps.findIndex(x => x.id === box.dataset.addIng) : 0;
        const html = App.ui.ingSuggestions(r.ingredients, box.value, box.dataset.addIng ? U.mixtures(r, at) : []);
        const pick = v => {
          box.value = '';
          if (v.startsWith('@from:')) U.useMixture(r, r.steps.find(x => x.id === box.dataset.addIng), v.slice(6));
          else if (box.dataset.addIng) addIngredientToStep(r, box.dataset.addIng, v); else addIngredientToList(r, v);
          const sel = box.dataset.addIng ? `[data-add-ing="${box.dataset.addIng}"]` : '[data-add-list]';
          commit(true);
          root.querySelector(sel)?.focus();
        };
        if (!html) return App.ui.closePopover();
        box._pickFn = pick;
        if (box._pop?.el.isConnected) box._pop.update(html);
        else box._pop = App.ui.popover(box, html, v => box._pickFn(v));
      }
      else if (e.target.dataset?.unote != null) setNote(e.target);
    });
    on(root, 'focusout', e => {
      if (e.target.dataset?.unote == null) return;
      setNote(e.target);
      e.target.classList.toggle('empty', !e.target.textContent.trim());
    });
    on(root, 'change', e => {
      const t = e.target, d = t.dataset;
      if (d.verb) { r.steps.find(s => s.id === d.verb).verb = t.value; commit(true); }
      else if (d.amt) { setAmount(ing(r, d.amt), t.value); commit(true); } // the ingredient list shows it too
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
      else if (d.makes) { r.steps.find(s => s.id === d.makes).makes = t.value.trim() || undefined; commit(true); }
      else if (d.text) { r.steps.find(s => s.id === d.text).text = t.value.trim() || undefined; commit(); }
      else if (d.time) {
        const n = parseFloat(t.value.replace(/[^\d.]/g, ''));
        r.steps.find(s => s.id === d.time).time = n > 0 ? n : undefined;
        t.value = n > 0 ? n + ' min' : ''; autosize(t); commit();
      }
      else if ((d.addIng || 'addList' in d) && !t.value.trim()) App.ui.closePopover();
      else if (d.addIng && t.value.trim()) { App.ui.closePopover(); addIngredientToStep(r, d.addIng, t.value); commit(true); }
      else if ('addList' in d && t.value.trim()) { App.ui.closePopover(); addIngredientToList(r, t.value); commit(true); root.querySelector('[data-add-list]')?.focus(); }
    });
    on(root, 'keydown', e => {
      if (e.key !== 'Enter' || !e.target.classList.contains('inl')) return;
      e.preventDefault();
      if (e.target.matches('[data-add-ing], [data-add-list]') && App.ui.pickFirst()) return; // finish the suggested word
      e.target.blur();
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
      if (d.ingIcon) { const g = ing(r, d.ingIcon); if (g) ingIconMenu(r, g, t, () => commit(true)); }
      else if (d.pickVerb) {
        const s = r.steps.find(x => x.id === d.pickVerb);
        App.ui.popover(t, verbMenuHtml(App.verb(s.verb).id), v => { s.verb = v; commit(true); });
      }
      else if (d.heat) { const s = r.steps.find(x => x.id === d.heat); s.heat = ((s.heat || 0) + 1) % 4 || undefined; commit(true); }
      else if (d.rmFrom) { const st = r.steps.find(x => x.id === t.closest('[data-step]').dataset.step); st.uses = st.uses.filter(u => u.from !== d.rmFrom); commit(true); }
      else if (d.rmUse) { removeUse(r, t.closest('[data-step]').dataset.step, d.rmUse); commit(true); }
      else if (d.chefSwap) { swapChef(r, d.chefSwap, false); commit(true); }
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

    let ingDrag = null;
    on(root, 'pointerdown', e => {
      const grip = e.target.closest('.ing-grip');
      if (!grip || e.button > 0) return;
      e.preventDefault(); e.stopPropagation();
      const row = grip.closest('[data-ing-row]');
      ingDrag = { row, list: row.parentNode };
      row.classList.add('lifted');
      document.body.classList.add('dragging-now');
    }, true);
    on(window, 'pointermove', e => {
      if (!ingDrag) return;
      const rows = [...ingDrag.list.querySelectorAll('[data-ing-row]')].filter(x => x !== ingDrag.row);
      const before = rows.find(x => { const b = x.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
      if (before) { if (ingDrag.row.nextElementSibling !== before) ingDrag.list.insertBefore(ingDrag.row, before); }
      else { const last = rows[rows.length - 1]; if (last && last.nextElementSibling !== ingDrag.row) last.after(ingDrag.row); }
      const edge = 80;
      if (e.clientY < edge) window.scrollBy(0, -12); else if (e.clientY > innerHeight - edge) window.scrollBy(0, 12);
    });
    const dropIng = () => {
      if (!ingDrag) return;
      const order = [...ingDrag.list.querySelectorAll('[data-ing-row]')].map(x => x.dataset.ingRow);
      ingDrag.row.classList.remove('lifted');
      document.body.classList.remove('dragging-now');
      ingDrag = null;
      const was = r.ingredients.map(g => g.id).join();
      r.ingredients = [...order.map(id => ing(r, id)).filter(Boolean), ...r.ingredients.filter(g => !order.includes(g.id))];
      if (r.ingredients.map(g => g.id).join() !== was) r.ingOrder = 'mine';
      commit(true);
    };
    on(window, 'pointerup', dropIng);
    on(window, 'pointercancel', dropIng);

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
        if (p?.kind === 'ing' && p.tapTarget.closest('.ing-ico')) { const g = ing(r, p.ingId); if (g) ingIconMenu(r, g, p.tapTarget.closest('.ing-ico'), () => commit(true)); }
        else if (p?.kind === 'ing' && p.tapTarget.matches('input')) { p.tapTarget.focus(); p.tapTarget.select(); }
        else if (p?.kind === 'ing' && p.tapTarget.isContentEditable) {
          p.tapTarget.focus();
          const sel = getSelection(); sel.selectAllChildren(p.tapTarget); sel.collapseToEnd(); // cursor at the end
        }
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
  // persist=false in edit mode: the change stays on the working copy until Done.
  function swapChef(r, stepId, persist = true) {
    if (!isCustomSplit(r)) {
      const duo = U.schedule(r, 2);
      r.steps.forEach(s => { s.chef = duo.byId[s.id].chef; });
    }
    const s = r.steps.find(x => x.id === stepId);
    s.chef = s.chef === 'A' ? 'B' : 'A';
    if (persist) save(r);
  }
  function isCustomSplit(r) { return r.steps.some(s => s.chef === 'A' || s.chef === 'B'); }
  function autoSplit(r, persist = true) { r.steps.forEach(s => delete s.chef); if (persist) save(r); }

  return { autosizeAll, stepHtml, ingRowHtml, bind, newStep, swapChef, autoSplit, isCustomSplit };
})();
