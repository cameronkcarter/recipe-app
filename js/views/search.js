// Search tab: every recipe on the site, and people. Tap the heart on a card to save it to your recipe book.
// #/u/<id> shows one person's recipes.
App.views = App.views || {};
App.views.search = root => {
  const U = App.util, S = App.store;
  let query = App.views.search.query || '';

  const resultsHtml = () => {
    const q = query.trim().toLowerCase();
    const people = S.profiles().filter(p => !q || p.name.toLowerCase().includes(q));
    const recipes = S.recipes().filter(r => !q || r.title.toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
      r.ingredients.some(i => i.name.toLowerCase().includes(q)) ||
      S.profile(r.author)?.name.toLowerCase().includes(q));
    if (q && !people.length && !recipes.length) return `<div class="empty">Nothing matches “${U.esc(query)}”.</div>`;
    return `${people.length ? `<h2 class="sec">People</h2>
        <div class="people">${people.map(p => `<a class="person" href="#/u/${encodeURIComponent(p.id)}">${U.avatarHtml(p, 'lg')}<span>${U.esc(U.firstName(p))}</span></a>`).join('')}</div>` : ''}
      ${recipes.length ? `<h2 class="sec">${q ? 'Recipes' : 'All recipes'}</h2>
        <div class="recipe-grid">${recipes.map(App.ui.recipeCard).join('')}</div>` : ''}`;
  };

  root.innerHTML = `
    ${App.ui.topbar('<h1>Search</h1>')}
    <div class="search-wrap">${App.glyph('search')}<input class="input search" type="search" placeholder="Recipes, ingredients, people" value="${U.esc(query)}"></div>
    <div id="results">${resultsHtml()}</div>`;

  root.querySelector('.search').addEventListener('input', e => {
    query = App.views.search.query = e.target.value;
    root.querySelector('#results').innerHTML = resultsHtml();
  });
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
