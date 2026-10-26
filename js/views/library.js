// Recipes tab: your recipe book — recipes you added (Mine) and other people's you saved (Saved), in one grid.
// Saved cards are tinted rose; the chips on top show how many of each and filter the grid.
App.views = App.views || {};
App.views.library = root => {
  const U = App.util, S = App.store;
  let query = App.views.library.query || '';
  let show = App.views.library.show || 'all'; // all | mine | saved

  const match = r => {
    const q = query.trim().toLowerCase();
    return !q || r.title.toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
      r.ingredients.some(i => i.name.toLowerCase().includes(q)) ||
      S.profile(r.author)?.name.toLowerCase().includes(q);
  };
  const book = () => {
    const mine = S.mine(), saved = S.saved().filter(r => r.author !== S.me()?.id);
    return { mine, saved, all: [...mine, ...saved].sort((x, y) => (y.addedAt || 0) - (x.addedAt || 0)) };
  };

  const chipsHtml = () => {
    const b = book();
    const chip = (id, label, n, ico) => `<button class="chip filter ${id} ${show === id ? 'on' : ''}" data-show="${id}">${ico}${label}<b>${n}</b></button>`;
    return chip('all', 'All', b.all.length, '') + chip('mine', 'Mine', b.mine.length, '<i class="dot"></i>') + chip('saved', 'Saved', b.saved.length, App.icon('heart'));
  };
  const cardsHtml = () => {
    const b = book();
    const list = b[show].filter(match);
    if (!b.all.length) return `<div class="empty"><div class="big">${App.icon('book')}</div><p>Your recipe book is empty.<br>Tap <b>+</b> to add a recipe, or save one from <a href="#/search">Search</a>.</p></div>`;
    if (!list.length) return query.trim()
      ? `<div class="empty">Nothing in your book matches “${U.esc(query)}”.<br><a href="#/search">Search all recipes</a></div>`
      : `<div class="muted hint-line">${show === 'saved' ? `Tap ${App.glyph('heart')} on any recipe in <a href="#/search">Search</a> to save it here.` : 'Tap + to add your first recipe.'}</div>`;
    return `<div class="recipe-grid">${list.map(App.ui.recipeCard).join('')}</div>`;
  };

  if (!S.me()) {
    root.innerHTML = `${App.ui.topbar('<h1>Recipe book</h1>')}
      <div class="card logged-out">
        <div class="big">${App.icon('book')}</div>
        <h2>Your recipe book</h2>
        <p class="muted">Log in to add your own recipes and save other people's.</p>
        <div class="row-btns"><button class="btn primary" data-acct>Log in</button><a class="btn" href="#/search">${App.glyph('search')}Browse recipes</a></div>
      </div>`;
    return;
  }

  root.innerHTML = `
    ${App.ui.topbar('<h1>Recipe book</h1>')}
    <div class="search-wrap">${App.glyph('search')}<input class="input search" type="search" placeholder="Search your book" value="${U.esc(query)}"></div>
    <div class="filters" id="chips">${chipsHtml()}</div>
    <div id="cards">${cardsHtml()}</div>
    <button class="fab" aria-label="Add recipe" data-act="add">${App.glyph('plus')}</button>`;

  root.onclick = e => {
    if (e.target.closest('[data-act=add]') && !App.needLogin()) addSheet();
    const f = e.target.closest('[data-show]');
    if (f) {
      show = App.views.library.show = f.dataset.show === show ? 'all' : f.dataset.show;
      root.querySelector('#chips').innerHTML = chipsHtml();
      root.querySelector('#cards').innerHTML = cardsHtml();
    }
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
