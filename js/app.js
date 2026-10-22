// Router: maps the URL hash (#/r/some-id) to a view.
(() => {
  const root = document.getElementById('app');
  let cleanup = null;

  // Nav icons and the browser-tab icon come from the app's own icon set.
  // The Profile tab shows your own picture.
  App.refreshNav = () => document.querySelectorAll('.nav [data-ic]').forEach(el => {
    el.innerHTML = el.dataset.ic === 'me' ? App.util.avatarHtml(App.store.me(), 'nav-av') : App.icon(el.dataset.ic);
  });
  App.refreshNav();
  document.querySelector('link[rel=icon]').href = 'data:image/svg+xml,' + encodeURIComponent(App.icon('pot').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));

  // Night mode: the toggle saves a choice on this device; until then the app follows the phone's setting.
  const themeColor = () => document.querySelector('meta[name=theme-color]').content = getComputedStyle(document.body).getPropertyValue('--bg').trim();
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
    [/^#\/me$/,                 () => App.views.profile(root),          'me'],
    [/^#\/u\/([^/]+)$/,         m => App.views.profile(root, { id: m[1] }), 'me'],
    [/^#\/log$/,                () => location.replace('#/me'),         'me'], // old link
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
      document.body.dataset.tab = tab; // each tab has its own page color
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

  // Timer buttons work on every screen.
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action="timer"]');
    if (b) App.ui.startTimer(b.dataset.label, +b.dataset.mins);
  });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
})();
