// New recipe, guided: 1 · the basics (name, how it's cooked, servings) → 2 · the steps, one at a time →
// 3 · review and save. Each step starts from a standard step ("Cook rice") or an action, then its
// ingredients: typed (with suggestions) or tapped from "Ready to add" — what earlier steps used, with
// what was done to it ("chopped", "browned"). An ingredient's amount is asked only the first time.
// Saving tidies the recipe like any other save (U.tidyRecipe) and opens it.
App.views = App.views || {};
App.views.builder = root => {
  const U = App.util, S = App.store;
  if (!S.me()) { location.replace('#/'); App.needLogin(); return; }

  const METHODS = [
    { id: 'instant pot', label: 'Instant Pot', icon: 'ip' }, { id: 'stovetop', label: 'Stovetop', icon: 'pan' }, { id: 'oven', label: 'Oven', icon: 'oven' },
    { id: 'slow cooker', label: 'Slow cooker', icon: 'pot' }, { id: 'none', label: 'No cooking', icon: 'bowl' },
  ];
  // The actions each way of cooking uses most; the rest are under "More".
  const QUICK = {
    'instant pot': ['chop', 'saute', 'deglaze', 'add', 'pressure', 'shred', 'season', 'serve'],
    stovetop: ['chop', 'heat', 'saute', 'add', 'simmer', 'boil', 'season', 'serve'],
    oven: ['chop', 'preheat', 'mix', 'add', 'bake', 'broil', 'rest', 'serve'],
    'slow cooker': ['chop', 'saute', 'add', 'cook', 'mix', 'season', 'shred', 'serve'],
    none: ['chop', 'mix', 'add', 'season', 'blend', 'chill', 'top', 'serve'],
  };
  const DONE = { chop: 'chopped', grate: 'grated', rinse: 'rinsed', drain: 'drained', marinate: 'marinated', mix: 'mixed', season: 'seasoned', blend: 'blended',
    mash: 'mashed', shred: 'shredded', heat: 'heated', saute: 'sautéed', cook: 'cooked', boil: 'boiled', simmer: 'simmered', pressure: 'cooked', bake: 'baked',
    broil: 'broiled', grill: 'grilled', rest: 'rested', chill: 'chilled', add: 'added' };

  const blank = () => ({ verb: null, uses: [], time: undefined, heat: undefined, text: '', temp: undefined, parallel: false });
  const st = App.session.builder ||= { stage: 'basics', r: { title: '', servings: 4, method: '', tags: [], ingredients: [], steps: [] }, cur: blank(), editing: null, err: '' };
  const r = st.r;
  const ing = id => r.ingredients.find(g => g.id === id);
  const method = () => r.method || 'stovetop';

  // ---------- adding ingredients to the step being built ----------
  // Steps before the one being built (or edited) — what's "ready to add".
  const before = () => st.editing ? r.steps.slice(0, r.steps.findIndex(s => s.id === st.editing)) : r.steps;
  const usedBefore = () => new Set(before().flatMap(s => (s.uses || []).map(u => u.ing)));
  function addToCur(text) {
    const p = U.parseIngredientLine(text);
    if (!p) return;
    p.name = U.canonName(p.name);
    let g = U.findIngredient(r.ingredients, p.name);
    if (g && g.qty == null && !g.unit && (p.qty != null || p.unit)) { g.qty = p.qty; g.unit = p.unit; }
    if (!g) { g = p; r.ingredients.push(g); }
    if (!st.cur.uses.some(u => u.ing === g.id)) st.cur.uses.push(p.note && g !== p ? { ing: g.id, note: p.note } : { ing: g.id });
  }
  function usePreset(i) {
    const pr = App.STEP_PRESETS[i];
    st.cur = { ...blank(), verb: pr.verb, time: pr.time, heat: pr.heat, text: pr.text || '', temp: pr.temp, parallel: !!pr.parallel };
    (pr.ings || []).forEach(addToCur);
  }
  function setAmount(g, v) {
    v = v.trim();
    if (!v) { g.qty = null; g.unit = ''; return; }
    const p = U.parseIngredientLine(v + ' x');
    g.qty = p?.qty ?? U.parseQty(v); g.unit = p?.unit || '';
  }
  // Save the step being built into the recipe (a new one at the end, or the one being edited).
  function commitStep() {
    const c = st.cur;
    if (!c.verb) { st.err = 'Pick what happens in this step first.'; return false; }
    const clean = { verb: c.verb, uses: c.uses.map(u => ({ ...u })), time: c.time || undefined, heat: c.heat || undefined, text: c.text.trim() || undefined, temp: c.temp || undefined };
    if (st.editing) Object.assign(r.steps.find(s => s.id === st.editing), clean);
    else { const prev = r.steps[r.steps.length - 1]; r.steps.push({ id: U.uid('s'), ...clean, after: c.parallel || !prev ? [] : [prev.id] }); }
    st.cur = blank(); st.editing = null; st.err = '';
    return true;
  }
  const curIsEmpty = () => !st.cur.verb && !st.cur.uses.length;

  // ---------- drawing ----------
  const dots = () => `<div class="steps-dots">${['basics', 'steps', 'review'].map(s => `<i class="${s === st.stage ? 'on' : ''}"></i>`).join('')}</div>`;
  const icoFor = id => App.icon(App.verb(id).icon);

  function render() {
    const y = window.scrollY;
    const body = st.stage === 'basics' ? basicsHtml() : st.stage === 'steps' ? stepsHtml() : reviewHtml();
    root.innerHTML = `
      <header class="topbar"><button class="btn small" data-act="cancel">Cancel</button><span class="title-sm">New recipe</span>${dots()}</header>
      ${body}`;
    window.scrollTo(0, y);
  }

  function basicsHtml() {
    return `<div class="b-card card">
      <h2 class="b-q">What are you making?</h2>
      <input class="input" data-b="title" value="${U.esc(r.title)}" placeholder="Chicken stew over rice" autocomplete="off" aria-label="Recipe name">
      <h2 class="b-q">How is it cooked?</h2>
      <div class="b-chips">${METHODS.map(m => `<button class="chip pick ${r.method === m.id ? 'on' : ''}" data-method="${m.id}">${App.icon(m.icon)}${m.label}</button>`).join('')}</div>
      <h2 class="b-q">Serves</h2>
      <div class="stepper" aria-label="Servings"><button data-serv="-1" aria-label="Fewer">${App.glyph('minus')}</button><span class="val">${App.icon('cloche')}${r.servings}</span><button data-serv="1" aria-label="More">${App.glyph('plus')}</button></div>
      ${st.err ? `<div class="join-err">${U.esc(st.err)}</div>` : ''}
      <button class="btn primary block b-next" data-act="to-steps">Next: steps</button>
    </div>`;
  }

  function stepsHtml() {
    const c = st.cur, n = st.editing ? r.steps.findIndex(s => s.id === st.editing) + 1 : r.steps.length + 1;
    const done = r.steps.map((s, i) => `<div class="b-step ${s.id === st.editing ? 'editing' : ''}" data-edit-step="${s.id}">
        <span class="n">${i + 1}</span>${icoFor(s.verb)}<b>${U.esc(App.verb(s.verb).label)}</b>
        <span class="muted">${U.esc([(s.uses || []).map(u => ing(u.ing)?.name).filter(Boolean).join(', '), s.time ? U.fmtMins(s.time) : '', s.text].filter(Boolean).join(' · '))}</span>
        <button class="x" data-rm-step="${s.id}" aria-label="Delete step">${App.glyph('x')}</button></div>`).join('');

    let compose;
    if (!c.verb) {
      // start the step: a standard step, or just an action
      const presets = App.STEP_PRESETS.map((p, i) => ({ p, i })).filter(({ p }) => p.for === 'all' || p.for.includes(method()));
      compose = `
        <div class="b-label">Standard steps</div>
        <div class="b-chips scroll">${presets.map(({ p, i }) => `<button class="chip pick" data-preset="${i}">${App.icon(p.icon)}${U.esc(p.label)}</button>`).join('')}</div>
        <div class="b-label">Or pick what happens</div>
        <div class="acts b-acts">${QUICK[method()].map(v => `<button class="act" data-verb="${v}">${icoFor(v)}${App.verb(v).label}</button>`).join('')}
          <button class="act more" data-act="more-verbs">${App.glyph('plus')}More</button></div>`;
    } else {
      const prior = usedBefore();
      const ready = [...prior].filter(id => !c.uses.some(u => u.ing === id) && ing(id)).reverse();
      const lastVerb = id => { const s = [...before()].reverse().find(x => (x.uses || []).some(u => u.ing === id)); return DONE[App.verb(s?.verb).id] || ''; };
      compose = `
        <button class="b-verb" data-act="more-verbs" aria-label="Change the action">${icoFor(c.verb)}<b>${App.verb(c.verb).label}</b><span class="muted">change</span></button>
        <ul class="b-ings">${c.uses.map(u => { const g = ing(u.ing); if (!g) return ''; const first = !prior.has(g.id);
          return `<li>${U.ingIconHtml(g)}${first ? `<input class="inl amt" data-amt="${g.id}" value="${U.esc(g.qty != null || g.unit ? U.fmtAmount(g.qty, U.normUnit(g.unit)) : '')}" placeholder="amount" inputmode="decimal" aria-label="Amount">` : ''}
            <span class="nm">${U.esc(g.name)}</span><input class="inl un" data-unote="${g.id}" value="${U.esc(u.note || '')}" placeholder="+ prep (diced…)" aria-label="How it's prepped">
            <button class="x" data-rm-use="${g.id}" aria-label="Remove">${App.glyph('x')}</button></li>`; }).join('')}</ul>
        ${ready.length ? `<div class="b-tray"><div class="b-label">Ready to add <button class="link" data-act="add-all">Add all</button></div>
          <div class="b-chips">${ready.map(id => { const g = ing(id), d = lastVerb(id); return `<button class="chip pick" data-ready="${id}">${U.ingIconHtml(g)}${U.esc(g.name)}${d ? `<small>${d}</small>` : ''}</button>`; }).join('')}</div></div>` : ''}
        <input class="input b-add" data-b-add placeholder="${c.uses.length ? '+ ingredient' : '+ ingredient, or leave empty'}" autocomplete="off" enterkeyhint="done" aria-label="Add an ingredient">
        <div class="b-opts">
          <label class="opt">${App.icon('clock')}<input class="inl" data-b-time inputmode="numeric" value="${c.time ? c.time + ' min' : ''}" placeholder="time" aria-label="Minutes"></label>
          <button class="opt ${c.heat ? '' : 'off'}" data-act="heat">${App.icon('flame')}${c.heat ? U.HEAT[c.heat].toLowerCase() + ' heat' : 'heat'}</button>
          ${c.temp !== undefined || App.verb(c.verb).group === 'Oven' ? `<label class="opt">${App.icon('thermo')}<input class="inl" data-b-temp value="${U.esc(c.temp || '')}" placeholder="temp" aria-label="Oven temperature"></label>` : ''}
          <label class="opt wide">${App.glyph('pencil')}<input class="inl" data-b-text value="${U.esc(c.text)}" placeholder="note (until…, then…)" aria-label="Note for this step"></label>
        </div>`;
    }
    return `${done ? `<div class="b-steps">${done}</div>` : `<p class="muted b-hint">Build the recipe one step at a time, in the order you'd cook it.</p>`}
      <div class="b-card card composer">
        <h2 class="b-q">${st.editing ? `Edit step ${n}` : `Step ${n}`}</h2>
        ${compose}
        ${st.err ? `<div class="join-err">${U.esc(st.err)}</div>` : ''}
        ${c.verb ? `<div class="row-btns b-btns">${st.editing ? `<button class="btn" data-act="cancel-edit">Cancel</button>` : `<button class="btn" data-act="clear-step">Start over</button>`}
          <button class="btn primary" data-act="commit">${st.editing ? 'Save step' : `Add step ${n}`}</button></div>` : ''}
      </div>
      <div class="row-btns b-foot"><button class="btn" data-act="to-basics">${App.glyph('back')}Basics</button>
        <button class="btn primary" data-act="to-review" ${r.steps.length || st.cur.verb ? '' : 'disabled'}>Review recipe</button></div>`;
  }

  function reviewHtml() {
    const fits = U.fittingTags(r);
    const methodTag = ['instant pot', 'slow cooker'].includes(r.method) ? [r.method] : [];
    const offer = [...new Set([...methodTag, ...fits, ...(r.tags || [])])];
    const amt = g => g.qty != null || g.unit ? U.fmtAmount(g.qty, U.normUnit(g.unit)) : '';
    return `<div class="hero">${U.recipeIconHtml(r)}<h2>${U.esc(r.title)}</h2></div>
      <div class="b-label">Tags <span class="muted">tap to add or remove</span></div>
      <div class="b-chips">${offer.map(t => `<button class="chip pick ${r.tags.includes(t) ? 'on' : ''}" data-tag="${U.esc(t)}">${t === 'vegan' ? App.icon('leaf') : /instant ?pot/.test(t) ? App.icon('ip') : ''}${U.esc(t)}</button>`).join('')}</div>
      <div class="section-label">Ingredients <span class="hint">${r.ingredients.length}</span></div>
      <ul class="card ing-list">${r.ingredients.map(g => `<li>${U.ingIconHtml(g)}<span class="qty">${U.esc(amt(g)) || '—'}</span><span class="nm">${U.esc(g.name)}</span></li>`).join('')}</ul>
      <div class="section-label">Steps</div>
      <div class="steps">${r.steps.map((s, i) => `<div class="card step"><div class="num">${i + 1}</div><div class="body">${App.ui.step(r, s)}</div></div>`).join('')}</div>
      <p class="muted b-hint">You can change anything later on the recipe page.</p>
      <div class="row-btns b-foot"><button class="btn" data-act="to-steps">${App.glyph('back')}Steps</button><button class="btn primary" data-act="save">Save recipe</button></div>`;
  }

  // ---------- events ----------
  function save() {
    const used = new Set(r.steps.flatMap(s => (s.uses || []).map(u => u.ing)));
    r.ingredients = r.ingredients.filter(g => used.has(g.id));
    const { method: _m, ...data } = U.tidyRecipe(JSON.parse(JSON.stringify(r)));
    const id = S.addRecipe({ ...data, title: data.title.trim() || 'Untitled' });
    delete App.session.builder;
    App.ui.toast(`Saved “${data.title}”`);
    location.hash = '#/r/' + encodeURIComponent(id);
  }
  const verbMenu = anchor => App.ui.popover(anchor, [...new Set(App.VERBS.map(v => v.group))].map(g =>
    `<div class="pop-head">${g}</div><div class="acts">${App.VERBS.filter(v => v.group === g).map(v => `<button class="act ${v.id === st.cur.verb ? 'on' : ''}" data-pick="${v.id}">${App.icon(v.icon)}${v.label}</button>`).join('')}</div>`).join(''),
    v => { st.cur.verb = v; st.err = ''; render(); });

  root.onclick = e => {
    const t = e.target.closest('button, [data-edit-step]');
    if (!t) return;
    const d = t.dataset;
    if (d.act === 'cancel') { if (r.title || r.steps.length) { if (!confirm('Throw away this recipe?')) return; } delete App.session.builder; location.hash = '#/'; return; }
    if (d.act === 'to-steps') { if (!r.title.trim()) { st.err = 'Give it a name first.'; return render(); } st.err = ''; st.stage = 'steps'; window.scrollTo(0, 0); }
    else if (d.act === 'to-basics') st.stage = 'basics';
    else if (d.act === 'to-review') { if (st.cur.verb && !commitStep()) return render(); if (!r.steps.length) return; st.stage = 'review'; window.scrollTo(0, 0);
      const methodTag = ['instant pot', 'slow cooker'].includes(r.method) ? r.method : null; if (methodTag && !r.tags.includes(methodTag)) r.tags.push(methodTag); }
    else if (d.act === 'save') return save();
    else if (d.method) r.method = r.method === d.method ? '' : d.method;
    else if (d.serv) r.servings = Math.max(1, r.servings + +d.serv);
    else if (d.preset) usePreset(+d.preset);
    else if (d.verb && !t.closest('.pop')) st.cur.verb = d.verb;
    else if (d.act === 'more-verbs') return verbMenu(t);
    else if (d.ready) st.cur.uses.push({ ing: d.ready });
    else if (d.act === 'add-all') [...usedBefore()].filter(id => !st.cur.uses.some(u => u.ing === id)).forEach(id => st.cur.uses.push({ ing: id }));
    else if (d.rmUse) st.cur.uses = st.cur.uses.filter(u => u.ing !== d.rmUse);
    else if (d.act === 'heat') st.cur.heat = ((st.cur.heat || 0) + 1) % 4 || undefined;
    else if (d.act === 'commit') { if (commitStep()) navigator.vibrate?.(10); }
    else if (d.act === 'clear-step') st.cur = blank();
    else if (d.act === 'cancel-edit') { st.cur = blank(); st.editing = null; }
    else if (d.rmStep) {
      e.stopPropagation();
      r.steps = r.steps.filter(s => s.id !== d.rmStep);
      r.steps.forEach(s => { s.after = (s.after || []).filter(x => x !== d.rmStep); });
      if (st.editing === d.rmStep) { st.editing = null; st.cur = blank(); }
    }
    else if (d.editStep) {
      if (!curIsEmpty() && st.editing !== d.editStep && !confirm('Leave the step you were building?')) return;
      const s = r.steps.find(x => x.id === d.editStep);
      st.editing = s.id;
      st.cur = { ...blank(), verb: s.verb, uses: (s.uses || []).map(u => ({ ...u })), time: s.time, heat: s.heat, text: s.text || '', temp: s.temp };
    }
    else if (d.tag) r.tags = r.tags.includes(d.tag) ? r.tags.filter(x => x !== d.tag) : [...r.tags, d.tag];
    else return;
    render();
  };
  root.oninput = e => {
    const t = e.target, d = t.dataset;
    if (d.b === 'title') r.title = t.value;
    else if ('bText' in d) st.cur.text = t.value;
    else if ('bTemp' in d) st.cur.temp = t.value.trim() || undefined;
    else if (d.unote) { const u = st.cur.uses.find(x => x.ing === d.unote); if (u) u.note = t.value.trim() || undefined; }
    else if ('bAdd' in d) {
      const html = App.ui.ingSuggestions(r.ingredients, t.value);
      if (!html) return App.ui.closePopover();
      if (t._pop?.el.isConnected) t._pop.update(html);
      else t._pop = App.ui.popover(t, html, v => { addToCur(v); render(); root.querySelector('[data-b-add]')?.focus(); });
    }
  };
  root.onchange = e => {
    const t = e.target, d = t.dataset;
    if (d.amt) { setAmount(ing(d.amt), t.value); render(); }
    else if ('bTime' in d) { const n = parseFloat(t.value.replace(/[^\d.]/g, '')); st.cur.time = n > 0 ? n : undefined; t.value = n > 0 ? n + ' min' : ''; }
    else if ('bAdd' in d && t.value.trim()) { App.ui.closePopover(); addToCur(t.value); render(); root.querySelector('[data-b-add]')?.focus(); }
  };
  root.onkeydown = e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    if ('bAdd' in e.target.dataset && App.ui.pickFirst()) return; // finish the suggested word
    e.target.blur();
  };

  render();
  return () => { root.onkeydown = null; App.ui.closePopover(); };
};
