// Shopping list: pick recipes, merge their ingredients, check off by store section. Everyone has their own.
App.views = App.views || {};

App.views.shopping = root => {
  const U = App.util, S = App.store, ui = App.ui;
  // Always the list as it is in the store right now: a sync from another device replaces the
  // stored object, and a copy kept from when this screen opened would quietly stop saving.
  let L = S.myList();
  const fresh = () => { L = S.myList() || L; L.hidden ||= {}; L.cats ||= {}; return L; };
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

  // L.hidden: cleared (bought) items stay off the list while their recipe is on it.
  // L.cats: aisles you picked yourself for an item ({ key: categoryId }).
  fresh();
  const keyOf = name => String(name).toLowerCase().trim().replace(/\s+/g, ' ').replace(/(es|s)$/, '');

  function build() {
    const map = new Map();
    for (const entry of L.recipes) {
      const r = S.recipe(entry.id);
      if (!r) continue;
      const sc = (entry.servings || r.servings || 1) / (r.servings || 1);
      for (const ing of r.ingredients) {
        const key = keyOf(ing.name);
        if (!map.has(key)) map.set(key, { key, name: ing.name, cat: L.cats[key] || U.category(ing), icon: U.ingIconHtml(ing), items: [] });
        const row = map.get(key);
        // an ingredient with no amount may still say one in a step ("a splash", "to taste")
        let unit = ing.unit;
        if (ing.qty == null && !unit) {
          const said = [ing.note, ...r.steps.flatMap(s => (s.uses || []).filter(u => u.ing === ing.id).map(u => u.note || u.unit))]
            .map(t => String(t || '').trim().match(U.WORD_AMOUNT)).find(Boolean);
          if (said) unit = said[1].toLowerCase();
        }
        row.items.push({ qty: ing.qty != null ? ing.qty * sc : null, unit });
      }
    }
    return [...map.values()].filter(row => !L.hidden[row.key]);
  }

  function render() {
    fresh();
    const rows = build();
    const byCat = App.CATEGORIES.map(c => ({ ...c, rows: rows.filter(r => r.cat === c.id).sort((a, b) => a.name.localeCompare(b.name)) })).filter(c => c.rows.length);
    const total = rows.length + L.extras.length;
    const doneCount = rows.filter(r => L.checked[r.key]).length + L.extras.filter(x => x.checked).length;

    root.innerHTML = `
      ${App.ui.topbar('<h1>Shopping</h1>', total ? `<button class="icon-btn" data-act="copy" aria-label="Copy list">${App.glyph('copy')}</button>` : '')}

      <div class="section-label">Recipes <span class="lab-btns">${doneCount ? `<button class="btn small clear-checked" data-act="clear-checked" aria-label="Remove the ${doneCount} checked item${doneCount > 1 ? 's' : ''} from the list">${App.glyph('check')}Remove ${doneCount} checked</button>` : ''}<button class="btn small" data-act="pick">${App.glyph('plus')}Add recipes</button></span></div>
      ${L.recipes.length ? `<div class="shop-recipes">${L.recipes.map(e => {
        const r = S.recipe(e.id);
        if (!r) return '';
        const std = r.servings || 1, changed = e.servings !== std;
        return `<span class="shop-recipe">${App.icon(U.recipeIcon(r))}${U.esc(r.title)}
          <span class="stepper"><button data-act="serv" data-id="${U.esc(e.id)}" data-d="-1" aria-label="Fewer servings">${App.glyph('minus')}</button><button class="val ${changed ? 'changed' : ''}" data-act="serv-reset" data-id="${U.esc(e.id)}" aria-label="${e.servings} servings${changed ? `, recipe makes ${std}. Tap to reset` : ''}">${App.icon('cloche')}${e.servings}</button><button data-act="serv" data-id="${U.esc(e.id)}" data-d="1" aria-label="More servings">${App.glyph('plus')}</button></span>
          <button class="rm" data-act="rm-recipe" data-id="${U.esc(e.id)}" aria-label="Remove recipe">${App.glyph('x')}</button></span>`;
      }).join('')}</div>` : `<div class="muted">Pick a few recipes and their ingredients get combined here.</div>`}

      ${byCat.map(c => `<div class="section-label"><span class="lab">${App.icon(c.icon)}${c.label}</span></div>
        <ul class="card check-list">${c.rows.map(r => {
          const amt = U.mergeAmounts(r.items);
          return `<li class="${L.checked[r.key] ? 'done' : ''}" data-check="${U.esc(r.key)}">
            <span class="box">${L.checked[r.key] ? App.glyph('check') : ''}</span>${r.icon}
            <span class="lbl">${amt ? `<span class="amt">${U.esc(amt)}</span> ` : ''}${U.esc(r.name)}
              </span><button class="rm-x aisle" data-aisle="${U.esc(r.key)}" aria-label="Move ${U.esc(r.name)} to another aisle">${App.glyph('move')}</button></li>`;
        }).join('')}</ul>`).join('')}

      <div class="section-label">Extras</div>
      ${L.extras.length ? `<ul class="card check-list extras">${L.extras.map(x => `
        <li class="${x.checked ? 'done' : ''}" data-extra="${x.id}"><span class="box">${x.checked ? App.glyph('check') : ''}</span>
        <span class="lbl">${U.esc(x.name)}</span><button class="rm-x" data-act="rm-extra" data-id="${x.id}" aria-label="Remove">${App.glyph('x')}</button></li>`).join('')}</ul>` : ''}
      <form class="add-row" data-form="extra">
        <input class="input" name="extra" placeholder="Add an item (paper towels, coffee…)">
        <button class="btn">Add</button>
      </form>
`;
  }

  root.onclick = e => {
    fresh();
    const aisle = e.target.closest('[data-aisle]');
    if (aisle) return aisleMenu(aisle);
    const li = e.target.closest('[data-check]');
    const ex = e.target.closest('[data-extra]');
    const t = e.target.closest('[data-act]');
    if (t) {
      const act = t.dataset.act;
      if (act === 'serv') { const en = L.recipes.find(x => x.id === t.dataset.id); en.servings = Math.max(1, en.servings + +t.dataset.d); }
      else if (act === 'rm-recipe') { L.recipes = L.recipes.filter(x => x.id !== t.dataset.id); if (!L.recipes.length) { L.checked = {}; L.hidden = {}; } }
      else if (act === 'rm-extra') { L.extras = L.extras.filter(x => x.id !== t.dataset.id); }
      else if (act === 'clear-checked') {
        // Easy to tap by mistake, so it can be undone.
        const before = JSON.stringify({ recipes: L.recipes, checked: L.checked, hidden: L.hidden, extras: L.extras });
        const n = t.textContent.match(/\d+/)?.[0] || '';
        L.extras = L.extras.filter(x => !x.checked); hideChecked();
        ui.toast(`Removed ${n} checked item${n === '1' ? '' : 's'}`, () => { Object.assign(fresh(), JSON.parse(before)); S.save(); render(); });
      }
      else if (act === 'serv-reset') { const en = L.recipes.find(x => x.id === t.dataset.id); en.servings = S.recipe(en.id)?.servings || 1; }
      else if (act === 'pick') return pickSheet();
      else if (act === 'copy') return copyList(t);
      S.save(); render(); return;
    }
    if (li) { const k = li.dataset.check; if (L.checked[k]) delete L.checked[k]; else L.checked[k] = true; S.save(); render(); }
    else if (ex) { const x = L.extras.find(y => y.id === ex.dataset.extra); x.checked = !x.checked; S.save(); render(); }
  };
  root.onsubmit = e => {
    e.preventDefault();
    fresh();
    const inp = e.target.querySelector('[name=extra]');
    const v = inp.value.trim();
    if (!v) return;
    L.extras.push({ id: U.uid('e'), name: v, checked: false });
    S.save(); render();
    root.querySelector('[name=extra]').focus();
  };

  // Pick the aisle an item goes under. "Automatic" goes back to the app's guess.
  function aisleMenu(btn) {
    const key = btn.dataset.aisle, cur = L.cats[key];
    ui.popover(btn, `<div class="pop-head">Aisle</div>` + App.CATEGORIES.map(c =>
      `<button class="sug ${cur === c.id ? 'on' : ''}" data-pick="${c.id}"><span class="ing-ico">${App.icon(c.icon)}</span>${c.label}</button>`).join('') +
      `<button class="sug ${cur ? '' : 'on'}" data-pick="">Automatic</button>`, id => {
      fresh();
      if (id) L.cats[key] = id; else delete L.cats[key];
      S.save(); render();
    });
  }

  // "Clear checked": checked items leave the list; a recipe with nothing left to buy leaves too.
  function hideChecked() {
    for (const k of Object.keys(L.checked)) L.hidden[k] = true;
    L.checked = {};
    L.recipes = L.recipes.filter(en => {
      const r = S.recipe(en.id);
      return r && r.ingredients.some(i => !L.hidden[keyOf(i.name)]);
    });
    if (!L.recipes.length) L.hidden = {};
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

  // Your recipes and saved ones first, then everyone else's.
  function pickable() {
    const first = [...S.mine(), ...S.saved()];
    const ids = new Set(first.map(r => r.id));
    return [...first, ...S.recipes().filter(r => !ids.has(r.id))];
  }

  function pickSheet() {
    const picked = new Set(L.recipes.map(x => x.id));
    ui.sheet(`<h3>Add recipes to the list</h3>
      <div class="pick-list">${pickable().map(r => `<label><input type="checkbox" value="${U.esc(r.id)}" ${picked.has(r.id) ? 'checked' : ''}>
        ${App.icon(U.recipeIcon(r))}${U.esc(r.title)}</label>`).join('') || '<p>No recipes yet.</p>'}</div>
      <button class="btn primary block sheet-done" data-done>Done</button>`,
      (el, close) => {
        el.querySelector('[data-done]').onclick = () => {
          fresh();
          const ids = [...el.querySelectorAll('input:checked')].map(i => i.value);
          L.recipes = L.recipes.filter(x => ids.includes(x.id));
          for (const id of ids) if (!L.recipes.some(x => x.id === id)) {
            L.recipes.push({ id, servings: S.recipe(id).servings || 1 });
            for (const i of S.recipe(id).ingredients) delete L.hidden[keyOf(i.name)]; // a newly added recipe needs all its items
          }
          if (!L.recipes.length) { L.checked = {}; L.hidden = {}; }
          S.save(); close(); render();
        };
      });
  }

  render();
};
