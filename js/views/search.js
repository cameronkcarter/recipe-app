// Search tab: every recipe on the site. Filter chips on top narrow it by who added it or by tag;
// each card shows its cook's first name and a heart to save it to your recipe book.
// #/u/<id> shows one person's recipes (from the "by …" link on a recipe).
App.views = App.views || {};
App.views.search = root => {
  const U = App.util, S = App.store;
  const st = App.views.search.state ||= { query: '', people: [], tags: [] };

  // Tags worth filtering by: the most used ones on the site.
  const topTags = () => {
    const n = {};
    for (const r of S.recipes()) for (const t of new Set((r.tags || []).map(x => x.toLowerCase()))) n[t] = (n[t] || 0) + 1;
    return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b)).slice(0, 10);
  };
  const filtersHtml = () => {
    const people = S.profiles().filter(p => S.recipes().some(r => r.author === p.id));
    return people.map(p => `<button class="chip filter cook ${st.people.includes(p.id) ? 'on' : ''}" data-person="${U.esc(p.id)}">${U.avatarHtml(p)}${U.esc(U.firstName(p))}</button>`).join('') +
      topTags().map(t => `<button class="chip filter ${st.tags.includes(t) ? 'on' : ''}" data-tag="${U.esc(t)}">${t === 'vegan' ? App.icon('leaf') : /instant ?pot/.test(t) ? App.icon('ip') : ''}${U.esc(t)}</button>`).join('');
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
    <div class="filters scroll" id="filters">${filtersHtml()}</div>
    <div id="results">${resultsHtml()}</div>`;

  const redraw = () => { root.querySelector('#filters').innerHTML = filtersHtml(); root.querySelector('#results').innerHTML = resultsHtml(); };
  root.querySelector('.search').addEventListener('input', e => { st.query = e.target.value; root.querySelector('#results').innerHTML = resultsHtml(); });
  root.onclick = e => {
    const p = e.target.closest('[data-person]'), t = e.target.closest('[data-tag]');
    const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
    if (p) { st.people = toggle(st.people, p.dataset.person); redraw(); }
    if (t) { st.tags = toggle(st.tags, t.dataset.tag); redraw(); }
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
