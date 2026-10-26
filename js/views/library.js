// Recipes tab: your recipe book — recipes you added, and other people's you saved with the heart.
App.views = App.views || {};
App.views.library = root => {
  const U = App.util, S = App.store;
  let query = App.views.library.query || '';

  const match = r => {
    const q = query.trim().toLowerCase();
    return !q || r.title.toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
      r.ingredients.some(i => i.name.toLowerCase().includes(q));
  };
  const grid = list => `<div class="recipe-grid">${list.map(App.ui.recipeCard).join('')}</div>`;

  const cardsHtml = () => {
    const mine = S.mine(), saved = S.saved().filter(r => r.author !== S.me()?.id);
    const m = mine.filter(match), s = saved.filter(match);
    if (query.trim() && !m.length && !s.length) return `<div class="empty">Nothing in your recipes matches “${U.esc(query)}”.<br><a href="#/search">Search all recipes</a></div>`;
    return `<h2 class="sec">My recipes <span class="count">${mine.length}</span></h2>
      ${m.length ? grid(m) : `<div class="muted hint-line">${mine.length ? 'No matches.' : 'Tap + to add your first recipe.'}</div>`}
      <h2 class="sec">Saved <span class="count">${saved.length}</span></h2>
      ${s.length ? grid(s) : `<div class="muted hint-line">${saved.length ? 'No matches.' : `Tap ${App.glyph('heart')} on any recipe in <a href="#/search">Search</a> to save it here.`}</div>`}`;
  };

  if (!S.me()) {
    root.innerHTML = `${App.ui.topbar('<h1>Recipes</h1>')}
      <div class="card logged-out">
        <div class="big">${App.icon('book')}</div>
        <h2>Your recipe book</h2>
        <p class="muted">Log in to add your own recipes and save other people's.</p>
        <div class="row-btns"><button class="btn primary" data-acct>Log in</button><a class="btn" href="#/search">${App.glyph('search')}Browse recipes</a></div>
      </div>`;
    return;
  }

  root.innerHTML = `
    ${App.ui.topbar('<h1>Recipes</h1>')}
    <div class="search-wrap">${App.glyph('search')}<input class="input search" type="search" placeholder="Search your recipes" value="${U.esc(query)}"></div>
    <div id="cards">${cardsHtml()}</div>
    <button class="fab" aria-label="Add recipe" data-act="add">${App.glyph('plus')}</button>`;

  root.onclick = e => {
    if (e.target.closest('[data-act=add]') && !App.needLogin()) addSheet();
  };

  function addSheet() {
    // Imported recipes are saved right away and open in edit mode to check.
    const open = draft => {
      const id = App.store.addRecipe(draft);
      App.session.justImported = id;
      location.hash = '#/edit/' + encodeURIComponent(id);
    };
    App.ui.sheet(`
      <div class="sheet-head"><h3>Add a recipe</h3><button class="btn small" data-close>Cancel</button></div>
      <form>
        <div class="input-wrap">${App.glyph('link')}<input class="input" name="url" type="url" inputmode="url" placeholder="Paste a recipe link" autocomplete="off" required aria-label="Recipe link"></div>
        <button class="btn primary block" data-import style="margin-top:8px">Import</button>
        <div class="import-msg" role="status"></div>
      </form>
      <details class="paste-box"><summary class="btn block">${App.glyph('paste')}Paste recipe text</summary>
        <textarea class="input" rows="8" name="text" placeholder="Copy the whole recipe from a page or photo and paste it here"></textarea>
        <button class="btn primary block" data-paste style="margin-top:8px">Convert</button>
        <div class="import-msg paste-msg" role="status"></div>
      </details>
      <button class="btn block" data-blank style="margin-top:8px">${App.glyph('pencil')}Blank recipe</button>`,
      (el, close) => {
        const input = el.querySelector('[name=url]'), msg = el.querySelector('.import-msg'), btn = el.querySelector('[data-import]');
        input.focus();
        el.querySelector('[data-blank]').onclick = () => { close(); location.hash = '#/new'; };
        el.querySelector('[data-paste]').onclick = () => {
          const pm = el.querySelector('.paste-msg');
          try { const draft = App.importer.fromText(el.querySelector('[name=text]').value); close(); open(draft); }
          catch (err) { pm.textContent = err.message; pm.classList.add('err'); }
        };
        el.querySelector('form').onsubmit = async ev => {
          ev.preventDefault();
          btn.disabled = true; btn.textContent = 'Reading…'; msg.textContent = ''; msg.classList.remove('err');
          try { const draft = await App.importer.fromUrl(input.value.trim()); close(); open(draft); }
          catch (err) {
            msg.textContent = err.message; msg.classList.add('err');
            btn.disabled = false; btn.textContent = 'Import';
          }
        };
      });
  }

  root.querySelector('.search').addEventListener('input', e => {
    query = App.views.library.query = e.target.value;
    root.querySelector('#cards').innerHTML = cardsHtml();
  });
};
