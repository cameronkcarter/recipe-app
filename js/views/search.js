// Search tab: every recipe on the site. "+ Filter" narrows it by who added a recipe or by tag
// (the labels cooks put on their recipes); active filters show as chips you can remove.
// Each card shows its cook's first name and a heart to save it to your recipes.
// #/u/<id> shows one person's recipes (from the "by …" link on a recipe).
App.views = App.views || {};
App.views.search = root => {
  const U = App.util, S = App.store;
  const st = App.views.search.state ||= { query: '', tags: [], have: [] };
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
  const filtersHtml = () => {
    const chips = st.tags.map(t => `<button class="chip filter on" data-tag="${U.esc(t)}" aria-label="Remove filter">${tagIcon(t)}${U.esc(t)}${App.glyph('x')}</button>`).join('');
    const menu = open ? `<div class="card filter-menu">
        <div class="fm-head">Tagged <span class="muted">labels cooks add to their recipes</span></div>
        <div class="fm-opts">${tagCounts().map(([t, n]) => `<button class="chip filter ${st.tags.includes(t) ? 'on' : ''}" data-tag="${U.esc(t)}">${tagIcon(t)}${U.esc(t)}<b>${n}</b></button>`).join('') || '<span class="muted">No tags yet.</span>'}</div>
      </div>` : '';
    const have = haveOpen ? U.haveBox(st.have) : '';
    // Filter and What can I make? are icons in the top bar, so only chosen filters show here.
    return `${chips ? `<div class="filters scroll ft-chips">${chips}</div>` : ''}${menu}${have}`;
  };
  // Typing a name also finds people: their profiles show as a row under the search box.
  const peopleHtml = () => {
    const q = st.query.trim().toLowerCase();
    if (!q) return '';
    const found = S.profiles().filter(p => p.name?.toLowerCase().split(/\s+/).some(w => w.startsWith(q)) || p.name?.toLowerCase().startsWith(q));
    return found.length ? `<div class="filters scroll ft-chips ft-people">${found.slice(0, 8).map(p => `<a class="chip filter cook" href="#/u/${encodeURIComponent(p.id)}">${U.avatarHtml(p)}${U.esc(p.name)}</a>`).join('')}</div>` : '';
  };
  // The top bar, the same in Grid and Scroll: search, Filter, What can I make?, the other view, and your account.
  const ftBtns = () => {
    const filtering = open || st.tags.length;
    return `<button type="button" class="ft-btn ${filtering ? 'on' : ''}" data-act="filters" aria-expanded="${open}" aria-label="Filter">${App.glyph('filter')}</button>
      <button type="button" class="ft-btn ${haveOpen ? 'on' : ''}" data-act="have" aria-expanded="${haveOpen}" aria-label="What can I make?">${App.icon('pot')}</button>
      ${view() === 'scroll' ? `<button type="button" class="ft-btn" data-view="grid" aria-label="Grid view">${App.glyph('grid')}</button>`
        : `<button type="button" class="ft-btn" data-view="scroll" aria-label="Scroll view">${App.glyph('feed')}</button>`}
`;
  };

  const filtered = () => {
    const q = st.query.trim().toLowerCase();
    return S.recipes().filter(r =>
      st.tags.every(t => (r.tags || []).some(x => x.toLowerCase() === t)) &&
      (!q || r.title.toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
        r.ingredients.some(i => i.name.toLowerCase().includes(q)) || S.profile(r.author)?.name.toLowerCase().includes(q)));
  };
  const grid = list => `<div class="recipe-grid">${list.map(r => App.ui.recipeCard(r)).join('')}</div>`;

  // One post in the scroll view: the photo (or drawn cover), what it is, who made it, and Save / Add to shopping list / Hide.
  const post = r => {
    const mine = r.author && r.author === S.me()?.id, by = S.profile(r.author), key = U.recipeKey(r);
    const tags = U.tagIcons(r).map(t => `<span class="tag-ico" title="${t.label}">${App.icon(t.icon)}</span>`).join('');
    const onList = !!S.myList()?.recipes.some(x => x.id === r.id), id = U.esc(r.id);
    // Down the right side, like TikTok and Reels: Save (the heart) with how many have it, Shopping list, Hide.
    // Everyone who saved it counts, and so does the cook who added it.
    const saves = new Set(S.profiles().filter(p => (p.saved || []).includes(r.id)).map(p => p.id));
    if (r.author) saves.add(r.author);
    const count = `<span class="fp-count" title="Saved by ${saves.size}">${saves.size}</span>`;
    const rail = `<div class="fp-rail">
        ${mine ? `<div class="fp-act"><span class="heart on mine" role="img" aria-label="Your recipe, saved by ${saves.size}">${App.icon('heart')}</span>${count}</div>`
          : `<div class="fp-act">${App.ui.heart(r.id)}${count}</div>`}
        <div class="fp-act"><button type="button" class="fp-btn ${onList ? 'on' : ''}" data-act="to-list" data-id="${id}" ${onList ? 'disabled' : ''} aria-label="${onList ? 'On shopping list' : 'Add to shopping list'}">${onList ? App.glyph('check') : App.icon('basket')}</button><span>${onList ? 'On list' : 'Shopping'}</span></div>
        <div class="fp-act"><button type="button" class="fp-btn" data-act="hide" data-id="${id}" aria-label="Hide from this feed">${App.glyph('hide')}</button><span>Hide</span></div>
      </div>`;
    return `<article class="card feed-post" data-post="${id}">
      <a class="fp-photo" href="#/r/${key}" aria-label="${U.esc(r.title)}">${App.photos.coverHtml(r, 'feed')}</a>
      ${rail}
      <div class="fp-body">
        <a class="fp-title" href="#/r/${key}">${U.esc(r.title)}</a>
        <div class="fp-meta">${by ? `<a class="fp-cook" href="#/u/${encodeURIComponent(by.id)}">${U.avatarHtml(by)}${U.esc(mine ? 'You' : U.firstName(by))}</a><span class="dot">·</span>` : ''}
          <span>${App.icon('clock')}${U.fmtMinsShort(U.schedule(r).total)}</span><span class="dot">·</span><span>${r.ingredients.length} ingredients</span>${tags}</div>
      </div></article>`;
  };

  const resultsHtml = () => {
    const q = st.query.trim();
    let list = filtered();
    if (st.have.length) {
      return U.haveGrid(list, st.have);
    }
    if (!list.length) return `<div class="empty">No recipes match${q ? ` “${U.esc(q)}”` : ''}.</div>`;
    if (view() === 'grid') return grid(list);
    // Every recipe gets a post; ones without a photo use their drawn cover.
    const hid = new Set(hidden());
    const shown = list.filter(r => !hid.has(r.id)), nHid = list.length - shown.length;
    const more = nHid ? `<p class="muted feed-more">${nHid} hidden from this feed. <button class="link" data-view="grid">See all in grid</button></p>` : '';
    return shown.length ? `<div class="feed">${shown.map(post).join('')}${more}</div>` : more;
  };

  // Both views share one top bar. In Scroll it's see-through over the photos; in Grid it sits on the page.
  // Results start below the bar and any chosen filters or the What can I make? box; the Filter menu drops over them.
  const render = () => {
    const box = `<input class="input search" type="search" placeholder="Search all recipes" value="${U.esc(st.query)}" aria-label="Search all recipes">`;
    root.innerHTML = `
      ${App.ui.bar(`<label class="ft-search">${App.glyph('search')}${box}</label>`, ftBtns(), `<div id="people">${peopleHtml()}</div><div id="filters">${filtersHtml()}</div>`, view() === 'grid' ? 'ft-grid' : '')}
      <div id="results" class="under-top">${resultsHtml()}</div>`;
    App.ui.watchBar(root);
  };
  render();

  // The Scroll feed scrolls on its own, so keep its place when the results are redrawn.
  const results = () => { const back = App.keepScroll(); root.querySelector('#results').innerHTML = resultsHtml(); back(); };
  const redraw = () => {
    root.querySelector('#filters').innerHTML = filtersHtml(); results();
    const b = root.querySelector('#ft-btns'); if (b) b.innerHTML = ftBtns() + App.ui.acctBtn();
  };
  root.oninput = e => { if (e.target.classList.contains('search')) { st.query = e.target.value; root.querySelector('#people').innerHTML = peopleHtml(); root.querySelector('#results').innerHTML = resultsHtml(); const f = root.querySelector('.feed'); if (f) f.scrollTop = 0; } };
  const addHave = box => {
    const add = box.value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!add.length) return;
    st.have = [...new Set([...st.have, ...add])];
    redraw();
    root.querySelector('[data-have-add]')?.focus();
  };
  const onKey = e => { if (e.key === 'Enter' && e.target.dataset?.haveAdd != null) { e.preventDefault(); addHave(e.target); } };
  root.addEventListener('keydown', onKey);
  root.onchange = e => { if (e.target.dataset?.haveAdd != null) addHave(e.target); };
  root.onclick = e => {
    const t = e.target.closest('[data-tag]'), v = e.target.closest('[data-view]');
    const h = e.target.closest('[data-have]'), act = e.target.closest('[data-act]')?.dataset.act;
    const toggle = (arr, x) => arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x];
    if (v) { setView(v.dataset.view); open = false; render(); }
    else if (act === 'filters') { open = !open; redraw(); }
    else if (act === 'have') { haveOpen = !haveOpen; if (!haveOpen) st.have = []; redraw(); if (haveOpen) root.querySelector('[data-have-add]')?.focus(); }
    else if (h) { st.have = st.have.filter(x => x !== h.dataset.have); redraw(); }
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
  // Pull down at the top of the Scroll feed to refresh it, like Instagram: a round arrow follows your finger
  // and spins once you let go past the line.
  let pull = null;
  const ptr = () => root.querySelector('#ptr') || root.insertAdjacentElement('beforeend', Object.assign(document.createElement('div'), { id: 'ptr', className: 'ptr', innerHTML: App.glyph('refresh') }));
  const f0 = () => root.querySelector('.feed');
  const onStart = e => {
    const f = e.target.closest?.('.feed');
    pull = f && f.scrollTop <= 0 && e.touches.length === 1 ? { y: e.touches[0].clientY, d: 0, on: false } : null;
  };
  const onMove = e => {
    if (!pull) return;
    const d = e.touches[0].clientY - pull.y;
    // Only take over once the finger has clearly moved down from the very top; any other swipe is left to the feed.
    if (!pull.on) {
      if (d < -6 || f0()?.scrollTop > 0) { pull = null; return; }
      if (d < 12) return;
      pull.on = true; pull.y += 12;
    }
    const dd = e.touches[0].clientY - pull.y;
    if (dd <= 0) { pull.d = 0; const el = root.querySelector('#ptr'); if (el) { el.style.cssText = ''; el.className = 'ptr'; } return; }
    if (e.cancelable) e.preventDefault(); // keep the page still while pulling
    pull.d = Math.min(110, dd * 0.5);
    const el = ptr(); el.classList.add('show'); el.classList.toggle('ready', pull.d >= 60);
    el.style.transform = `translate(-50%, ${pull.d}px) rotate(${pull.d * 4}deg)`;
  };
  const onEnd = () => {
    if (!pull) return;
    const go = pull.on && pull.d >= 60; pull = null;
    const el = root.querySelector('#ptr'); if (!el) return;
    if (!go) { el.style.cssText = ''; el.className = 'ptr'; return; }
    refresh();
  };
  // Spin the arrow, then redraw the results from the top.
  const refresh = () => {
    const el = ptr(); el.style.cssText = ''; el.className = 'ptr show spin';
    setTimeout(() => {
      root.querySelector('#results').innerHTML = resultsHtml();
      const f = root.querySelector('.feed'); if (f) f.scrollTop = 0;
      el.className = 'ptr';
    }, 700);
  };
  // Tapping the Search tab while you're already here goes back to the top and refreshes, like Instagram's home tab.
  const onTab = e => {
    if (!e.target.closest?.('.nav a[href="#/search"]') || location.hash !== '#/search') return;
    e.preventDefault();
    refresh();
    const f = root.querySelector('.feed'), top = { top: 0, behavior: 'smooth' };
    if (f) { if (f.scrollTo) f.scrollTo(top); else f.scrollTop = 0; } else window.scrollTo(top);
  };
  document.addEventListener('click', onTab);
  root.addEventListener('touchstart', onStart, { passive: true });
  root.addEventListener('touchmove', onMove, { passive: false });
  root.addEventListener('touchend', onEnd); root.addEventListener('touchcancel', onEnd);
  return () => {
    root.removeEventListener('keydown', onKey); root.onchange = null; document.removeEventListener('click', onTab);
    root.removeEventListener('touchstart', onStart); root.removeEventListener('touchmove', onMove);
    root.removeEventListener('touchend', onEnd); root.removeEventListener('touchcancel', onEnd);
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
