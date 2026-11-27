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

  // Filters live in the Filter drop-down from the top bar: Show (All / Mine / Saved) and a tag
  // (vegan / Instant Pot also count when the recipe obviously is). Chosen ones show as chips you can remove.
  let tag = App.views.library.tag || null;
  let menuOpen = false;
  const have = App.views.library.have ||= []; // What can I make?, from your recipes only
  let haveOpen = have.length > 0;
  const hasTag = (r, t) => (r.tags || []).some(x => x.toLowerCase() === t) ||
    U.tagIcons(r).some(x => x.label.toLowerCase() === t || (t === 'instapot' && x.icon === 'ip'));
  const tagIcon = t => t === 'vegan' ? App.icon('leaf') : /instant ?pot/.test(t) ? App.icon('ip') : '';
  const SHOW = { all: 'All', mine: 'Mine', saved: 'Saved' };
  const showIcon = id => id === 'mine' ? '<i class="dot"></i>' : id === 'saved' ? App.icon('heart') : '';
  const chipsHtml = () => {
    const chips = (show !== 'all' ? `<button class="chip filter on ${show}" data-show="${show}" aria-label="Remove filter">${showIcon(show)}${SHOW[show]}${App.glyph('x')}</button>` : '') +
      (tag ? `<button class="chip filter on" data-tagf="${U.esc(tag)}" aria-label="Remove filter">${tagIcon(tag)}${U.esc(tag)}${App.glyph('x')}</button>` : '');
    return chips ? `<div class="filters scroll ft-chips">${chips}</div>` : '';
  };
  const menuHtml = () => {
    if (!menuOpen) return '';
    const b = book(), n = {};
    for (const r of b.all) for (const t of (r.tags || []).map(x => x.toLowerCase())) n[t] = (n[t] || 0) + 1;
    const tags = [...new Set(['vegan', 'instant pot', ...Object.keys(n).sort((x, y) => n[y] - n[x])])];
    return `<div class="card filter-menu">
      <div class="fm-head">Show</div>
      <div class="fm-opts">${Object.keys(SHOW).map(id => `<button class="chip filter ${id} ${show === id ? 'on' : ''}" data-show="${id}">${showIcon(id)}${SHOW[id]}<b>${b[id].length}</b></button>`).join('')}</div>
      <div class="fm-head">Tags</div>
      <div class="fm-opts">${tags.map(t => `<button class="chip filter ${tag === t ? 'on' : ''}" data-tagf="${U.esc(t)}">${tagIcon(t)}${U.esc(t)}<b>${b.all.filter(r => hasTag(r, t)).length}</b></button>`).join('')}</div>
    </div>`;
  };
  const belowHtml = () => `${chipsHtml()}${menuHtml()}${haveOpen ? U.haveBox(have) : ''}`;
  const btnsHtml = () => `<button type="button" class="ft-btn ${menuOpen || show !== 'all' || tag ? 'on' : ''}" data-act="filters" aria-expanded="${menuOpen}" aria-label="Filter">${App.glyph('filter')}</button>
    <button type="button" class="ft-btn ${haveOpen ? 'on' : ''}" data-act="have" aria-expanded="${haveOpen}" aria-label="What can I make?">${App.icon('pot')}</button>`;
  const cardsHtml = () => {
    const b = book();
    const list = b[show].filter(r => match(r) && (!tag || hasTag(r, tag)));
    if (!b.all.length) return `<div class="empty"><div class="big">${App.icon('book')}</div><p>Your recipe book is empty.<br>Tap <b>+</b> to add a recipe, or save one from <a href="#/search">Search</a>.</p></div>`;
    if (have.length) return U.haveGrid(list, have);
    if (!list.length) return query.trim()
      ? `<div class="empty">Nothing in your recipes matches “${U.esc(query)}”.<br><a href="#/search">Search all recipes</a></div>`
      : `<div class="muted hint-line">${show === 'saved' ? `Tap ${App.glyph('heart')} on any recipe in <a href="#/search">Search</a> to save it here.` : 'Tap + to add your first recipe.'}</div>`;
    return `<div class="recipe-grid">${list.map(App.ui.recipeCard).join('')}</div>`;
  };

  if (!S.me()) {
    root.innerHTML = `${App.ui.bar('<h1 class="ft-title">My Recipes</h1>')}
      <div class="under-top"><div class="card logged-out">
        <div class="big">${App.icon('book')}</div>
        <h2>Your recipe book</h2>
        <p class="muted">Log in to add your own recipes and save other people's.</p>
        <div class="row-btns"><button class="btn primary" data-acct>Log in</button><a class="btn" href="#/search">${App.glyph('search')}Browse recipes</a></div>
      </div></div>`;
    App.ui.watchBar(root);
    return;
  }

  root.innerHTML = `
    ${App.ui.bar(`<label class="ft-search">${App.glyph('search')}<input class="input search" type="search" placeholder="Search your recipes" value="${U.esc(query)}" aria-label="Search your recipes"></label>`,
      btnsHtml(), `<div id="below">${belowHtml()}</div>`)}
    <div id="cards" class="under-top">${cardsHtml()}</div>
    <button class="fab" aria-label="Add recipe" data-act="add">${App.glyph('plus')}</button>`;
  App.ui.watchBar(root);

  const redraw = () => {
    root.querySelector('#below').innerHTML = belowHtml(); root.querySelector('#cards').innerHTML = cardsHtml();
    root.querySelector('#ft-btns').innerHTML = btnsHtml() + App.ui.acctBtn();
  };
  const addHave = box => {
    const add = box.value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!add.length) return;
    for (const a of add) if (!have.includes(a)) have.push(a);
    redraw();
    root.querySelector('[data-have-add]')?.focus();
  };
  const onKey = e => { if (e.key === 'Enter' && e.target.dataset?.haveAdd != null) { e.preventDefault(); addHave(e.target); } };
  root.addEventListener('keydown', onKey);
  root.onchange = e => { if (e.target.dataset?.haveAdd != null) addHave(e.target); };
  root.onclick = e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add') { if (!App.needLogin()) addSheet(); return; }
    const f = e.target.closest('[data-show]'), tf = e.target.closest('[data-tagf]'), h = e.target.closest('[data-have]');
    if (act === 'filters') { menuOpen = !menuOpen; redraw(); }
    else if (act === 'have') { haveOpen = !haveOpen; if (!haveOpen) have.length = 0; redraw(); if (haveOpen) root.querySelector('[data-have-add]')?.focus(); }
    else if (h) { have.splice(have.indexOf(h.dataset.have), 1); redraw(); }
    else if (f) { show = App.views.library.show = f.dataset.show === show ? 'all' : f.dataset.show; redraw(); }
    else if (tf) { tag = App.views.library.tag = tag === tf.dataset.tagf ? null : tf.dataset.tagf; redraw(); }
    else if (menuOpen && !e.target.closest('.filter-menu')) { menuOpen = false; redraw(); }
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
        <button class="btn primary block mt8" data-import>Import</button>
        <div class="import-msg" role="status"></div>
      </form>
      <details class="paste-box"><summary class="btn block">${App.glyph('paste')}Paste recipe text</summary>
        <textarea class="input" rows="8" name="text" placeholder="Copy the whole recipe from a page or photo and paste it here"></textarea>
        <button class="btn primary block mt8" data-paste>Convert</button>
        <div class="import-msg paste-msg" role="status"></div>
      </details>
      <button class="btn block mt8" data-blank>${App.glyph('pencil')}Start from scratch</button>`,
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
  return () => { root.removeEventListener('keydown', onKey); root.onchange = null; };
};
