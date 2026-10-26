// Shopping list: pick recipes, merge their ingredients, check off by store section. Everyone has their own.
App.views = App.views || {};

App.views.shopping = root => {
  const U = App.util, S = App.store, ui = App.ui;
  const L = S.myList();
  if (!L) {
    root.innerHTML = `${App.ui.topbar('<h1>Shopping</h1>')}
      <div class="card logged-out">
        <div class="big">${App.icon('basket')}</div>
        <h2>Log in to make a shopping list</h2>
        <p class="muted">Add recipes and their ingredients get combined into one list, sorted by aisle.</p>
        <button class="btn primary" data-act="login">Log in</button>
      </div>`;
    root.onclick = e => { if (e.target.closest('[data-act=login]')) App.needLogin(); };
    return;
  }

  const keyOf = name => String(name).toLowerCase().trim().replace(/\s+/g, ' ').replace(/(es|s)$/, '');

  function build() {
    const map = new Map();
    for (const entry of L.recipes) {
      const r = S.recipe(entry.id);
      if (!r) continue;
      const sc = (entry.servings || r.servings || 1) / (r.servings || 1);
      for (const ing of r.ingredients) {
        const key = keyOf(ing.name);
        if (!map.has(key)) map.set(key, { key, name: ing.name, cat: U.category(ing), icon: U.ingIconHtml(ing), items: [], from: new Set() });
        const row = map.get(key);
        row.items.push({ qty: ing.qty != null ? ing.qty * sc : null, unit: ing.unit });
        row.from.add(r.title);
      }
    }
    return [...map.values()];
  }

  function render() {
    const rows = build();
    const byCat = App.CATEGORIES.map(c => ({ ...c, rows: rows.filter(r => r.cat === c.id).sort((a, b) => a.name.localeCompare(b.name)) })).filter(c => c.rows.length);
    const total = rows.length + L.extras.length;
    const doneCount = rows.filter(r => L.checked[r.key]).length + L.extras.filter(x => x.checked).length;

    root.innerHTML = `
      ${App.ui.topbar('<h1>Shopping</h1>', total ? `<button class="icon-btn" data-act="copy" aria-label="Copy list">${App.glyph('copy')}</button>` : '')}

      <div class="section-label">Recipes <button class="btn small" data-act="pick">${App.glyph('plus')}Add recipes</button></div>
      ${L.recipes.length ? `<div class="shop-recipes">${L.recipes.map(e => {
        const r = S.recipe(e.id);
        if (!r) return '';
        return `<span class="shop-recipe">${App.icon(U.recipeIcon(r))}${U.esc(r.title)}
          <span class="stepper"><button data-act="serv" data-id="${U.esc(e.id)}" data-d="-1" aria-label="Fewer servings">${App.glyph('minus')}</button><span class="val">${App.icon('cloche')}${e.servings}</span><button data-act="serv" data-id="${U.esc(e.id)}" data-d="1" aria-label="More servings">${App.glyph('plus')}</button></span>
          <button class="rm" data-act="rm-recipe" data-id="${U.esc(e.id)}" aria-label="Remove recipe">${App.glyph('x')}</button></span>`;
      }).join('')}</div>` : `<div style="color:var(--muted);font-size:.9rem">Pick a few recipes and their ingredients get combined here.</div>`}

      ${byCat.map(c => `<div class="section-label"><span class="lab">${App.icon(c.icon)}${c.label}</span></div>
        <ul class="card check-list">${c.rows.map(r => {
          const amt = U.mergeAmounts(r.items);
          return `<li class="${L.checked[r.key] ? 'done' : ''}" data-check="${U.esc(r.key)}">
            <span class="box">${L.checked[r.key] ? App.glyph('check') : ''}</span>${r.icon}
            <span class="lbl">${amt ? `<span class="amt">${U.esc(amt)}</span> ` : ''}${U.esc(r.name)}
              ${r.from.size > 1 ? `<div class="from">${[...r.from].map(U.esc).join(' · ')}</div>` : ''}</span></li>`;
        }).join('')}</ul>`).join('')}

      <div class="section-label">Extras</div>
      ${L.extras.length ? `<ul class="card check-list" style="margin-bottom:10px">${L.extras.map(x => `
        <li class="${x.checked ? 'done' : ''}" data-extra="${x.id}"><span class="box">${x.checked ? App.glyph('check') : ''}</span>
        <span class="lbl">${U.esc(x.name)}</span><button class="rm-x" data-act="rm-extra" data-id="${x.id}" aria-label="Remove">${App.glyph('x')}</button></li>`).join('')}</ul>` : ''}
      <form data-form="extra" style="display:flex;gap:8px">
        <input class="input" name="extra" placeholder="Add an item (paper towels, coffee…)">
        <button class="btn">Add</button>
      </form>

      ${total ? `<div style="display:flex;gap:8px;margin-top:24px">
        <button class="btn small" data-act="clear-checked" ${doneCount ? '' : 'disabled'}>Clear checked (${doneCount})</button>
        <button class="btn small danger" data-act="clear-all">Clear list</button></div>` : ''}`;
  }

  root.onclick = e => {
    const li = e.target.closest('[data-check]');
    const ex = e.target.closest('[data-extra]');
    const t = e.target.closest('[data-act]');
    if (t) {
      const act = t.dataset.act;
      if (act === 'serv') { const en = L.recipes.find(x => x.id === t.dataset.id); en.servings = Math.max(1, en.servings + +t.dataset.d); }
      else if (act === 'rm-recipe') L.recipes = L.recipes.filter(x => x.id !== t.dataset.id);
      else if (act === 'rm-extra') { L.extras = L.extras.filter(x => x.id !== t.dataset.id); }
      else if (act === 'clear-checked') { L.extras = L.extras.filter(x => !x.checked); hideChecked(); }
      else if (act === 'clear-all') { if (!confirm('Clear the whole list?')) return; L.recipes = []; L.checked = {}; L.extras = []; }
      else if (act === 'pick') return pickSheet();
      else if (act === 'copy') return copyList(t);
      S.save(); render(); return;
    }
    if (li) { const k = li.dataset.check; if (L.checked[k]) delete L.checked[k]; else L.checked[k] = true; S.save(); render(); }
    else if (ex) { const x = L.extras.find(y => y.id === ex.dataset.extra); x.checked = !x.checked; S.save(); render(); }
  };
  root.onsubmit = e => {
    e.preventDefault();
    const inp = e.target.querySelector('[name=extra]');
    const v = inp.value.trim();
    if (!v) return;
    L.extras.push({ id: U.uid('e'), name: v, checked: false });
    S.save(); render();
    root.querySelector('[name=extra]').focus();
  };

  // "Clear checked": drop recipes that are fully checked off; partly-checked ones stay.
  function hideChecked() {
    L.recipes = L.recipes.filter(en => {
      const r = S.recipe(en.id);
      return r && r.ingredients.some(i => !L.checked[keyOf(i.name)]);
    });
    if (!L.recipes.length) L.checked = {};
  }

  function copyList(btn) {
    const rows = build();
    const lines = [];
    for (const c of App.CATEGORIES) {
      const rs = rows.filter(r => r.cat === c.id && !L.checked[r.key]);
      if (!rs.length) continue;
      lines.push(c.label.toUpperCase());
      for (const r of rs) lines.push('☐ ' + [U.mergeAmounts(r.items), r.name].filter(Boolean).join(' '));
      lines.push('');
    }
    const extras = L.extras.filter(x => !x.checked);
    if (extras.length) { lines.push('EXTRAS'); extras.forEach(x => lines.push('☐ ' + x.name)); }
    navigator.clipboard?.writeText(lines.join('\n').trim()).then(() => { btn.innerHTML = App.glyph('check'); setTimeout(() => btn.innerHTML = App.glyph('copy'), 1200); },
      () => alert(lines.join('\n')));
  }

  function pickSheet() {
    const picked = new Set(L.recipes.map(x => x.id));
    ui.sheet(`<h3>Add recipes to the list</h3>
      <div class="pick-list">${S.recipes().map(r => `<label><input type="checkbox" value="${U.esc(r.id)}" ${picked.has(r.id) ? 'checked' : ''}>
        ${App.icon(U.recipeIcon(r))}${U.esc(r.title)}</label>`).join('') || '<p>No recipes yet.</p>'}</div>
      <button class="btn primary block" data-done style="margin-top:14px">Done</button>`,
      (el, close) => {
        el.querySelector('[data-done]').onclick = () => {
          const ids = [...el.querySelectorAll('input:checked')].map(i => i.value);
          L.recipes = L.recipes.filter(x => ids.includes(x.id));
          for (const id of ids) if (!L.recipes.some(x => x.id === id)) L.recipes.push({ id, servings: S.recipe(id).servings || 1 });
          S.save(); close(); render();
        };
      });
  }

  render();
};
