// Search tab: every recipe on the site. "+ Filter" narrows it by who added a recipe or by tag
// (the labels cooks put on their recipes); active filters show as chips you can remove.
// Each card shows its cook's first name and a heart to save it to your recipes.
// #/u/<id> shows one person's recipes (from the "by …" link on a recipe).
App.views = App.views || {};
App.views.search = root => {
  const U = App.util, S = App.store;
  const st = App.views.search.state ||= { query: '', people: [], tags: [], have: [] };
  st.have ||= [];
  let open = false; // the filter menu
  let haveOpen = st.have.length > 0; // the "What can I make?" box

  // Grid or Scroll (the photo feed), remembered on this device.
  const VIEW = 'recipeapp.searchView';
  const view = () => { try { return localStorage.getItem(VIEW) === 'grid' ? 'grid' : 'scroll'; } catch (e) { return 'scroll'; } };
  const setView = v => { try { localStorage.setItem(VIEW, v); } catch (e) { /* private mode */ } };
  // Posts you hid from the feed on this device.
  const HID = 'recipeapp.feedHidden';
  const hidden = () => { try { return JSON.parse(localStorage.getItem(HID) || '[]'); } catch (e) { return []; } };
  const setHidden = list => { try { localStorage.setItem(HID, JSON.stringify(list)); } catch (e) { /* private mode */ } };

  // Tags on the site with how many recipes use each, most used first.
  const tagCounts = () => {
    const n = {};
    for (const r of S.recipes()) for (const t of new Set((r.tags || []).map(x => x.toLowerCase()))) n[t] = (n[t] || 0) + 1;
    return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const tagIcon = t => t === 'vegan' ? App.icon('leaf') : /instant ?pot/.test(t) ? App.icon('ip') : '';
  const viewSeg = () => `<div class="seg view-seg" role="group" aria-label="View">
      <button type="button" data-view="grid" class="${view() === 'grid' ? 'on' : ''}" aria-pressed="${view() === 'grid'}" aria-label="Grid view">${App.glyph('grid')}</button>
      <button type="button" data-view="scroll" class="${view() === 'scroll' ? 'on' : ''}" aria-pressed="${view() === 'scroll'}" aria-label="Scroll view">${App.glyph('feed')}</button></div>`;
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
    const have = haveOpen ? `<div class="card have-box">
        <div class="fm-head">What can I make? <span class="muted">ingredients you have</span></div>
        <div class="have-chips">${st.have.map(h => `<button class="chip filter on" data-have="${U.esc(h)}" aria-label="Remove ${U.esc(h)}">${U.ingIconHtml({ name: h })}${U.esc(h)}${App.glyph('x')}</button>`).join('')}
          <input class="inl have-add" data-have-add placeholder="${st.have.length ? '+ another' : 'like chicken, rice'}" aria-label="Add an ingredient you have" enterkeyhint="done" autocomplete="off"></div>
        <p class="muted have-hint">Salt, pepper, oil and water count as on hand.</p>
      </div>` : '';
    return `<div class="filters"><button class="chip filter add ${open ? 'on' : ''}" data-act="filters" aria-expanded="${open}">${App.glyph('plus')}Filter</button>
      <button class="chip filter add ${haveOpen ? 'on' : ''}" data-act="have" aria-expanded="${haveOpen}">${App.icon('basket')}What can I make?</button>${chips}${viewSeg()}</div>${menu}${have}`;
  };

  // "What can I make?": how many of a recipe's ingredients you're missing (staples don't count).
  const STAPLE = /^(salt|kosher salt|sea salt|(black )?pepper|water|ice|(olive |vegetable |canola |neutral |cooking )?oil|cooking spray)$/;
  const norm = x => String(x).toLowerCase().trim().replace(/\s+/g, ' ').replace(/(es|s)$/, '');
  const missing = r => {
    const haves = st.have.map(norm);
    const need = (r.ingredients || []).filter(g => !STAPLE.test(String(g.name).toLowerCase().trim()));
    // "rice" doesn't cover rice vinegar, and "chicken" doesn't cover chicken broth
    const OTHER = /\b(vinegar|flour|noodles?|wine|sauce|stock|broth|bouillon|powder|paste|oil|milk|syrup|paper|cakes?|seasoning|extract)$/;
    const got = g => { const n = norm(g.name); return haves.some(h => n === h || (h.length > 3 && h.includes(n)) || (n.includes(h) && !(OTHER.test(n) && !OTHER.test(h)))); };
    const have = need.filter(got).length;
    return { miss: need.filter(g => !got(g)), have, share: need.length ? have / need.length : 0 };
  };

  const filtered = () => {
    const q = st.query.trim().toLowerCase();
    return S.recipes().filter(r =>
      (!st.people.length || st.people.includes(r.author)) &&
      st.tags.every(t => (r.tags || []).some(x => x.toLowerCase() === t)) &&
      (!q || r.title.toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
        r.ingredients.some(i => i.name.toLowerCase().includes(q)) || S.profile(r.author)?.name.toLowerCase().includes(q)));
  };
  const grid = list => `<div class="recipe-grid">${list.map(r => App.ui.recipeCard(r)).join('')}</div>`;

  // One post in the scroll view: the photo (or drawn cover), what it is, who made it, and Save / Add to shopping list / Hide.
  const post = r => {
    const mine = r.author && r.author === S.me()?.id, by = S.profile(r.author), key = U.recipeKey(r);
    const tags = U.tagIcons(r).map(t => `<span class="tag-ico" title="${t.label}">${App.icon(t.icon)}</span>`).join('');
    const onList = !!S.myList()?.recipes.some(x => x.id === r.id);
    return `<article class="card feed-post" data-post="${U.esc(r.id)}">
      <a class="fp-photo" href="#/r/${key}" aria-label="${U.esc(r.title)}">${App.photos.coverHtml(r, 'feed')}</a>
      <div class="fp-body">
        <a class="fp-title" href="#/r/${key}">${U.esc(r.title)}</a>
        <div class="fp-meta">${by ? `<a class="fp-cook" href="#/u/${encodeURIComponent(by.id)}">${U.avatarHtml(by)}${U.esc(mine ? 'You' : U.firstName(by))}</a><span class="dot">·</span>` : ''}
          <span>${App.icon('clock')}${U.fmtMinsShort(U.schedule(r).total)}</span><span class="dot">·</span><span>${r.ingredients.length} ingredients</span>${tags}</div>
        <div class="fp-acts">
          ${mine ? '' : `<span class="fp-save">${App.ui.heart(r.id)}<span>${S.isSaved(r.id) ? 'Saved' : 'Save'}</span></span>`}
          <button class="btn small" data-act="to-list" data-id="${U.esc(r.id)}" ${onList ? 'disabled' : ''}>${onList ? App.glyph('check') + 'On shopping list' : App.icon('basket') + 'Add to shopping list'}</button>
          <button class="btn small fp-hide" data-act="hide" data-id="${U.esc(r.id)}" aria-label="Hide from this feed">${App.glyph('hide')}</button>
        </div>
      </div></article>`;
  };

  const resultsHtml = () => {
    const q = st.query.trim();
    let list = filtered();
    if (st.have.length) {
      const ranked = list.map(r => ({ r, ...missing(r) })).filter(x => x.have > 0).sort((a, b) => b.share - a.share || a.miss.length - b.miss.length);
      if (!ranked.length) return `<div class="empty">No recipes use ${U.esc(st.have.join(', '))}.</div>`;
      return `<div class="recipe-grid">${ranked.map(({ r, miss }) => App.ui.recipeCard(r,
        `<div class="have-line ${miss.length ? '' : 'all'}">${miss.length ? `Missing ${miss.length}: ${U.esc(miss.slice(0, 2).map(g => g.name).join(', '))}${miss.length > 2 ? '…' : ''}` : 'You have everything'}</div>`)).join('')}</div>`;
    }
    if (!list.length) return `<div class="empty">No recipes match${q ? ` “${U.esc(q)}”` : ''}.</div>`;
    if (view() === 'grid') return grid(list);
    // Every recipe gets a post; ones without a photo use their drawn cover.
    const hid = new Set(hidden());
    const shown = list.filter(r => !hid.has(r.id)), nHid = list.length - shown.length;
    return `${nHid ? `<p class="muted feed-more">${nHid} hidden from this feed. <button class="link" data-view="grid">See all in grid</button></p>` : ''}
      ${shown.length ? `<div class="feed">${shown.map(post).join('')}</div>` : ''}`;
  };

  root.innerHTML = `
    ${App.ui.topbar('<h1>Search</h1>')}
    <div class="search-wrap">${App.glyph('search')}<input class="input search" type="search" placeholder="Recipes, ingredients, cooks" value="${U.esc(st.query)}"></div>
    <div id="filters">${filtersHtml()}</div>
    <div id="results">${resultsHtml()}</div>`;

  const redraw = () => { root.querySelector('#filters').innerHTML = filtersHtml(); root.querySelector('#results').innerHTML = resultsHtml(); };
  const results = () => { root.querySelector('#results').innerHTML = resultsHtml(); };
  root.querySelector('.search').addEventListener('input', e => { st.query = e.target.value; results(); });
  const addHave = box => {
    const add = box.value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!add.length) return;
    st.have = [...new Set([...st.have, ...add])];
    redraw();
    root.querySelector('[data-have-add]')?.focus();
  };
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset?.haveAdd != null) { e.preventDefault(); addHave(e.target); } });
  root.onchange = e => { if (e.target.dataset?.haveAdd != null) addHave(e.target); };
  root.onclick = e => {
    const p = e.target.closest('[data-person]'), t = e.target.closest('[data-tag]'), v = e.target.closest('[data-view]');
    const h = e.target.closest('[data-have]'), act = e.target.closest('[data-act]')?.dataset.act;
    const toggle = (arr, x) => arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x];
    if (v) { setView(v.dataset.view); redraw(); }
    else if (act === 'filters') { open = !open; redraw(); }
    else if (act === 'have') { haveOpen = !haveOpen; if (!haveOpen) st.have = []; redraw(); if (haveOpen) root.querySelector('[data-have-add]')?.focus(); }
    else if (h) { st.have = st.have.filter(x => x !== h.dataset.have); redraw(); }
    else if (p) { st.people = toggle(st.people, p.dataset.person); redraw(); }
    else if (t) { st.tags = toggle(st.tags, t.dataset.tag); redraw(); }
    else if (act === 'to-list') {
      if (App.needLogin()) return;
      const id = e.target.closest('[data-act]').dataset.id, r = S.recipe(id), list = S.myList();
      if (!r || list.recipes.some(x => x.id === id)) return;
      list.recipes.push({ id, servings: r.servings || 1 });
      S.save(); results();
      App.ui.toast(`Added “${r.title}” to your shopping list`, () => { list.recipes = list.recipes.filter(x => x.id !== id); S.save(); results(); });
    }
    else if (act === 'hide') {
      const id = e.target.closest('[data-act]').dataset.id;
      setHidden([...new Set([...hidden(), id])]); results();
      App.ui.toast('Hidden from your feed', () => { setHidden(hidden().filter(x => x !== id)); results(); });
    }
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
