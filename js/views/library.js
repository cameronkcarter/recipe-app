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
    if (!S.recipes().length) return `<div class="empty"><div class="big">🍳</div><p>No recipes yet.<br>Tap <b>+</b> to add your first one.</p></div>`;
    if (!list.length) return `<div class="empty">No recipes match “${U.esc(query)}”.</div>`;
    return `<div class="recipe-grid">${list.map(r => {
      const cooks = S.cooksFor(r.id);
      const time = U.schedule(r, 1).total;
      const meta = [`⏱ ${U.fmtMins(time)}`, cooks.length ? `✅ ${cooks.length}× · ${U.ago(cooks[0].date)}` : ''].filter(Boolean).join('<br>');
      return `<a class="card recipe-card" href="#/r/${encodeURIComponent(r.id)}">
        <div class="emoji">${U.esc(r.emoji || '🍽️')}</div>
        <div class="name">${U.esc(r.title)}</div>
        <div class="meta">${meta}</div></a>`;
    }).join('')}</div>`;
  };

  root.innerHTML = `
    <header class="topbar"><h1>Recipes</h1></header>
    <input class="input search" type="search" placeholder="🔍 Search recipes, tags, ingredients" value="${U.esc(query)}">
    <div id="cards">${cardsHtml()}</div>
    <button class="fab" aria-label="Add recipe" data-act="add">+</button>`;

  root.onclick = e => { if (e.target.closest('[data-act=add]')) addSheet(); };

  function addSheet() {
    App.ui.sheet(`<h3>Add a recipe</h3>
      <form data-form="import">
        <label class="field"><span>🔗 Paste a recipe link</span>
          <input class="input" name="url" type="url" inputmode="url" placeholder="https://..." autocomplete="off" required></label>
        <button class="btn primary block" data-import>Import</button>
        <div class="import-msg" role="status"></div>
      </form>
      <div class="or">or</div>
      <details class="paste-box"><summary class="btn block">📋 Paste recipe text</summary>
        <p class="hint">Select the whole recipe on the page (or copy text from a photo), copy, and paste it here.</p>
        <textarea class="input" rows="8" name="text" placeholder="Title&#10;Ingredients&#10;2 tbsp olive oil&#10;1 onion, diced&#10;Instructions&#10;Heat the oil over medium heat…"></textarea>
        <button class="btn primary block" data-paste style="margin-top:8px">Convert</button>
        <div class="import-msg paste-msg" role="status"></div>
      </details>
      <button class="btn block" data-blank style="margin-top:10px">✏️ Start from scratch</button>`,
      (el, close) => {
        const input = el.querySelector('[name=url]'), msg = el.querySelector('.import-msg'), btn = el.querySelector('[data-import]');
        input.focus();
        el.querySelector('[data-blank]').onclick = () => { close(); location.hash = '#/new'; };
        el.querySelector('[data-paste]').onclick = () => {
          const pm = el.querySelector('.paste-msg');
          try {
            App.session = App.session || {};
            App.session.importDraft = App.importer.fromText(el.querySelector('[name=text]').value);
            close();
            location.hash = '#/new';
          } catch (err) { pm.textContent = err.message; pm.classList.add('err'); }
        };
        el.querySelector('form').onsubmit = async ev => {
          ev.preventDefault();
          btn.disabled = true; btn.textContent = 'Reading recipe…'; msg.textContent = ''; msg.classList.remove('err');
          try {
            App.session = App.session || {};
            App.session.importDraft = await App.importer.fromUrl(input.value.trim());
            close();
            location.hash = '#/new';
          } catch (err) {
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
