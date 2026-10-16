// Router: maps the URL hash (#/r/some-id) to a view.
(() => {
  const root = document.getElementById('app');
  let cleanup = null;

  const routes = [
    [/^#?\/?$/,                 () => App.views.library(root),          'recipes'],
    [/^#\/r\/([^/]+)$/,         m => App.views.recipe(root, { id: m[1] }), 'recipes'],
    [/^#\/new$/,                () => { location.replace('#/edit/' + encodeURIComponent(App.store.addRecipe({}))); }, 'recipes'],
    [/^#\/edit\/([^/]+)$/,      m => App.views.recipe(root, { id: m[1], edit: true }), 'recipes'],
    [/^#\/list$/,               () => App.views.shopping(root),         'list'],
    [/^#\/log$/,                () => App.views.log(root),              'log'],
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
