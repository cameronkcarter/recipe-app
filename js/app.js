// Router: maps the URL hash (#/r/some-id) to a view.
(() => {
  const root = document.getElementById('app');
  let cleanup = null;

  // Nav icons and the browser-tab icon come from the app's own icon set.
  App.refreshNav = () => document.querySelectorAll('.nav [data-ic]').forEach(el => { el.innerHTML = App.icon(el.dataset.ic); });

  // Things that need to know who you are (saving, adding a recipe, the shopping list) open Log in first.
  // Returns true when it did.
  App.needLogin = () => {
    if (App.store.me()) return false;
    App.account();
    return true;
  };
  App.refreshNav();
  document.querySelector('link[rel=icon]').href = 'data:image/svg+xml,' + encodeURIComponent(App.icon('pot').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));

  // Night mode: the toggle saves a choice on this device; until then the app follows the phone's setting.
  const themeColor = () => document.querySelector('meta[name=theme-color]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  App.toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('recipeapp.theme', next); } catch (e) { /* private mode: still switches for now */ }
    themeColor();
    return next;
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', e => {
    let saved = null;
    try { saved = localStorage.getItem('recipeapp.theme'); } catch (err) {}
    if (!saved) { document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'; themeColor(); }
  });

  const routes = [
    [/^#?\/?$/,                 () => App.views.library(root),          'recipes'],
    [/^#\/r\/([^/]+)$/,         m => App.views.recipe(root, { id: m[1] }), 'recipes'],
    [/^#\/new$/,                () => { location.replace('#/edit/' + encodeURIComponent(App.store.addRecipe({}))); }, 'recipes'],
    [/^#\/edit\/([^/]+)$/,      m => App.views.recipe(root, { id: m[1], edit: true }), 'recipes'],
    [/^#\/list$/,               () => App.views.shopping(root),         'list'],
    [/^#\/search$/,             () => App.views.search(root),           'search'],
    [/^#\/u\/([^/]+)$/,         m => App.views.person(root, { id: m[1] }), 'search'],
    [/^#\/(me|log)$/,           () => location.replace('#/'),           'recipes'], // old links
  ];

  function render() {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    root.onclick = root.oninput = root.onchange = root.onsubmit = null;
    document.querySelectorAll('.sheet-back').forEach(el => el.remove());

    const hash = location.hash || '#/';
    for (const [re, view, tab] of routes) {
      const m = hash.match(re);
      if (!m) continue;
      if (m[1]) m[1] = decodeURIComponent(m[1]);
      cleanup = view(m);
      document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
      document.documentElement.dataset.tab = tab; // each tab has its own page color
      if (!/^#\/(r|edit|new)\b/.test(hash)) App.session.from = hash;
      themeColor();
      return;
    }
    location.hash = '#/';
  }

  // Another device changed something: redraw, unless you're in the middle of editing or typing.
  let pending = false;
  App.onRemoteChange = () => {
    const busy = /^#\/edit\//.test(location.hash) || document.querySelector('.sheet-back') ||
      (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
    if (busy) { pending = true; return; }
    pending = false;
    App.refreshNav(); // a profile picture may have changed on another device
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  };
  window.addEventListener('hashchange', () => { if (pending) setTimeout(App.onRemoteChange, 0); });

  // Redraw the current screen in place (after logging in or out).
  App.rerender = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };

  // The account button in every header, and the heart on recipe cards (inside the card's link).
  document.addEventListener('click', e => {
    if (e.target.closest('[data-acct]')) { App.account(); return; }
    const h = e.target.closest('[data-heart]');
    if (!h) return;
    e.preventDefault(); e.stopPropagation();
    if (App.needLogin()) return;
    App.store.toggleSaved(h.dataset.heart);
    App.rerender(); // a card may move in or out of your recipe book
    navigator.vibrate?.(10);
  }, true);

  // Timer buttons work on every screen.
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action="timer"]');
    if (b) App.ui.startTimer(b.dataset.label, +b.dataset.mins);
  });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
})();
