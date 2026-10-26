// Search tab: every recipe on the site. "+ Filter" narrows it by who added a recipe or by tag
// (the labels cooks put on their recipes); active filters show as chips you can remove.
// Each card shows its cook's first name and a heart to save it to your recipes.
// #/u/<id> shows one person's recipes (from the "by …" link on a recipe).
App.views = App.views || {};
App.views.search = root => {
  const U = App.util, S = App.store;
  const st = App.views.search.state ||= { query: '', people: [], tags: [] };
  let open = false; // the filter menu

  // Tags on the site with how many recipes use each, most used first.
  const tagCounts = () => {
    const n = {};
    for (const r of S.recipes()) for (const t of new Set((r.tags || []).map(x => x.toLowerCase()))) n[t] = (n[t] || 0) + 1;
    return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const tagIcon = t => t === 'vegan' ? App.icon('leaf') : /instant ?pot/.test(t) ? App.icon('ip') : '';
  const filtersHtml = () => {
    const chips = [
      ...st.people.map(id => { const p = S.profile(id); return p ? `<button class="chip filter on cook" data-person="${U.esc(id)}" aria-label="Remove filter">${U.avatarHtml(p)}${U.esc(U.firstName(p))}${App.glyph('x')}</button>` : ''; }),
      ...st.tags.map(t => `<button class="chip filter on" data-tag="${U.esc(t)}" aria-label="Remove filter">${tagIcon(t)}${U.esc(t)}${App.glyph('x')}</button>`),
    ].join('');
    const cooks = S.profiles().filter(p => S.recipes().some(r => r.author === p.id));
    const menu = open ? `<div class="card filter-menu">
        <div class="fm-head">Added by</div>
        <div class="fm-opts">${cooks.map(p => `<button class="chip filter cook ${st.people.includes(p.id) ? 'on' : ''}" data-person="${U.esc(p.id)}">${U.avatarHtml(p)}${U.esc(p.name)}</button>`).join('')}</div>
        <div class="fm-head">Tagged <span class="muted">labels cooks add to their recipes</span></div>
        <div class="fm-opts">${tagCounts().map(([t, n]) => `<button class="chip filter ${st.tags.includes(t) ? 'on' : ''}" data-tag="${U.esc(t)}">${tagIcon(t)}${U.esc(t)}<b>${n}</b></button>`).join('') || '<span class="muted">No tags yet.</span>'}</div>
      </div>` : '';
    return `<div class="filters"><button class="chip filter add ${open ? 'on' : ''}" data-act="filters" aria-expanded="${open}">${App.glyph('plus')}Filter</button>${chips}</div>${menu}`;
  };
  const resultsHtml = () => {
    const q = st.query.trim().toLowerCase();
    const list = S.recipes().filter(r =>
      (!st.people.length || st.people.includes(r.author)) &&
      st.tags.every(t => (r.tags || []).some(x => x.toLowerCase() === t)) &&
      (!q || r.title.toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
        r.ingredients.some(i => i.name.toLowerCase().includes(q)) || S.profile(r.author)?.name.toLowerCase().includes(q)));
    if (!list.length) return `<div class="empty">No recipes match${q ? ` “${U.esc(st.query)}”` : ''}.</div>`;
    return `<div class="recipe-grid">${list.map(App.ui.recipeCard).join('')}</div>`;
  };

  root.innerHTML = `
    ${App.ui.topbar('<h1>Search</h1>')}
    <div class="search-wrap">${App.glyph('search')}<input class="input search" type="search" placeholder="Recipes, ingredients, cooks" value="${U.esc(st.query)}"></div>
    <div id="filters">${filtersHtml()}</div>
    <div id="results">${resultsHtml()}</div>`;

  const redraw = () => { root.querySelector('#filters').innerHTML = filtersHtml(); root.querySelector('#results').innerHTML = resultsHtml(); };
  root.querySelector('.search').addEventListener('input', e => { st.query = e.target.value; root.querySelector('#results').innerHTML = resultsHtml(); });
  root.onclick = e => {
    const p = e.target.closest('[data-person]'), t = e.target.closest('[data-tag]');
    const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
    if (e.target.closest('[data-act=filters]')) { open = !open; redraw(); }
    else if (p) { st.people = toggle(st.people, p.dataset.person); redraw(); }
    else if (t) { st.tags = toggle(st.tags, t.dataset.tag); redraw(); }
    else if (open && !e.target.closest('.filter-menu')) { open = false; redraw(); }
  };
};

// One person: their picture, name, and the recipes they added.
App.views.person = (root, { id }) => {
  const U = App.util, S = App.store;
  const p = S.profile(id);
  if (!p) { root.innerHTML = `<div class="empty"><p>Person not found.</p><a href="#/search">Back to search</a></div>`; return; }
  const recipes = S.recipes().filter(r => r.author === p.id);
  root.innerHTML = `
    ${App.ui.topbar(`<a class="icon-btn" href="#/search" aria-label="Back">${App.glyph('back')}</a><span class="title-sm"></span>`)}
    <div class="prof-head">${U.avatarHtml(p, 'xl')}<h1>${U.esc(p.name)}</h1>
      <p class="muted">${recipes.length} recipe${recipes.length === 1 ? '' : 's'}</p></div>
    ${recipes.length ? `<div class="recipe-grid">${recipes.map(App.ui.recipeCard).join('')}</div>` : `<div class="muted hint-line">No recipes yet.</div>`}`;
};
