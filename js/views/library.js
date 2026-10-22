// Home: list of recipes with search.
App.views = App.views || {};
App.views.library = root => {
  const U = App.util, S = App.store;
  let query = App.views.library.query || '';

  const cardsHtml = () => {
    const q = query.trim().toLowerCase();
    const list = S.recipes().filter(r => !q ||
      r.title.toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
      r.ingredients.some(i => i.name.toLowerCase().includes(q)));
    if (!S.recipes().length) return `<div class="empty"><div class="big">${App.icon('pot')}</div><p>No recipes yet.<br>Tap <b>+</b> to add your first one.</p></div>`;
    if (!list.length) return `<div class="empty">No recipes match “${U.esc(query)}”.</div>`;
    return `<div class="recipe-grid">${list.map(r => {
      const cooks = S.cooksFor(r.id);
      const time = U.schedule(r, 1).total;
      const tags = U.tagIcons(r);
      // Time, and a "made it" seal with how many times you've cooked it.
      return `<a class="card recipe-card" href="#/r/${encodeURIComponent(r.id)}">
        ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag-ico" title="${t.label}">${App.icon(t.icon)}</span>`).join('')}</div>` : ''}
        ${U.recipeIconHtml(r)}
        <div class="name">${U.esc(r.title)}</div>
        <div class="meta"><span class="time">${App.icon('clock')}${U.fmtMins(time)}</span>${cooks.length ? App.seal(cooks.length) : ''}</div></a>`;
    }).join('')}</div>`;
  };

  root.innerHTML = `
    <header class="topbar"><h1>Recipes</h1>${themeBtn()}</header>
    <div class="search-wrap">${App.glyph('search')}<input class="input search" type="search" placeholder="Search recipes, tags, ingredients" value="${U.esc(query)}"></div>
    <div id="cards">${cardsHtml()}</div>
    <button class="fab" aria-label="Add recipe" data-act="add">${App.glyph('plus')}</button>`;

  root.onclick = e => {
    if (e.target.closest('[data-act=add]')) addSheet();
    const t = e.target.closest('[data-act=theme]');
    if (t) { App.toggleTheme(); t.outerHTML = themeBtn(); }
  };

  // Night mode switch: a sleepy moon by day, a sun at night.
  function themeBtn() {
    const dark = document.documentElement.dataset.theme === 'dark';
    return `<button class="icon-btn" data-act="theme" aria-label="${dark ? 'Day mode' : 'Night mode'}">${App.icon(dark ? 'sun' : 'moon')}</button>`;
  }

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
