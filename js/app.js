// Router: maps the URL hash (#/r/some-id) to a view.
(() => {
  const root = document.getElementById('app');
  let cleanup = null;

  const routes = [
    [/^#?\/?$/,                 () => App.views.library(root),          'recipes'],
    [/^#\/r\/([^/]+)$/,         m => App.views.recipe(root, { id: m[1] }), 'recipes'],
    [/^#\/new$/,                () => App.views.editor(root, {}),        'recipes'],
    [/^#\/edit\/([^/]+)$/,      m => App.views.editor(root, { id: m[1] }), 'recipes'],
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

  // Timer buttons work on every screen.
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action="timer"]');
    if (b) App.ui.startTimer(b.dataset.label, +b.dataset.mins);
  });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
})();
