// Saves everything in the browser (localStorage) as a fast offline copy, and passes changes
// to App.sync (js/sync.js), which shares them across devices through Firebase.
window.App = window.App || {};

App.store = (() => {
  const KEY = 'recipeapp.v1';
  let state;

  const fresh = () => ({
    recipes: JSON.parse(JSON.stringify(App.SEED_RECIPES)),
    log: [],                                  // [{id, recipeId, date, mode}]
    list: { recipes: [], checked: {}, extras: [] }, // shopping list
    seedVersion: App.SEED_VERSION,
  });

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : fresh();
    } catch (e) {
      state = fresh();
    }
    state.recipes ||= []; state.log ||= []; state.list ||= { recipes: [], checked: {}, extras: [] };
    // The old example friend notes ("Sam (example)") are gone from the app; drop them from saved data.
    state.recipes.forEach(r => { if (r.notes) r.notes = r.notes.filter(n => !/\(example\)/.test(n.author || '')); });
    // Steps don't carry "more" paragraphs any more — the app is meant to be read at a glance.
    state.recipes.forEach(r => (r.steps || []).forEach(s => delete s.detail));
    // One-time rewrites of early imports in the app's style (see App.RECIPE_FIXES).
    state.fixes ||= {};
    for (const [id, fix] of Object.entries(App.RECIPE_FIXES || {})) {
      const r = state.recipes.find(x => x.id === id);
      if (r && !state.fixes[id]) Object.assign(r, JSON.parse(JSON.stringify(fix)));
      state.fixes[id] = true;
    }
    if (raw) save();
    // Refresh the starter recipe(s) if they've been updated, keeping any notes you added.
    if ((state.seedVersion || 1) < App.SEED_VERSION) {
      for (const seed of App.SEED_RECIPES) {
        const i = state.recipes.findIndex(r => r.id === seed.id);
        if (i < 0) continue;
        const fresh = JSON.parse(JSON.stringify(seed));
        const seedNoteIds = new Set(fresh.notes.map(n => n.id));
        fresh.notes.push(...(state.recipes[i].notes || []).filter(n => !seedNoteIds.has(n.id) && !/^step:/.test(n.target)));
        state.recipes[i] = fresh;
      }
      state.seedVersion = App.SEED_VERSION;
      save();
    }
  }
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Could not save', e); }
  }
  // Cook log and shopping list are changed from several screens, so every save sends whichever
  // of them actually changed (shortly after, so quick taps become one write).
  const sent = {};
  let metaTimer = null;
  function save() {
    saveLocal();
    if (!App.sync?.enabled) return;
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => {
      for (const name of ['log', 'list']) {
        const json = JSON.stringify(state[name]);
        if (sent[name] !== json) { sent[name] = json; App.sync.meta(name, state[name]); }
      }
    }, 400);
  }
  const syncRecipe = r => App.sync?.enabled && App.sync.recipe(r);
  load();

  return {
    get state() { return state; },
    save,
    recipes: () => state.recipes,
    recipe: id => state.recipes.find(r => r.id === id),
    upsertRecipe(r) {
      const i = state.recipes.findIndex(x => x.id === r.id);
      if (i > -1) state.recipes[i] = r; else state.recipes.unshift(r);
      save(); syncRecipe(r);
    },
    // Saves a new recipe (blank or imported) and returns its id.
    addRecipe(data) {
      const U = App.util;
      const base = U.slug(data.title || 'recipe');
      let id = base, n = 2;
      while (state.recipes.some(r => r.id === id)) id = base + '-' + n++;
      state.recipes.unshift({ title: '', emoji: '🍽️', servings: 4, source: '', tags: [], ingredients: [], steps: [], notes: [], ...data, id, addedAt: Date.now() });
      save(); syncRecipe(state.recipes[0]);
      return id;
    },
    deleteRecipe(id) {
      state.recipes = state.recipes.filter(r => r.id !== id);
      state.list.recipes = state.list.recipes.filter(x => x.id !== id);
      save();
      if (App.sync?.enabled) App.sync.removeRecipe(id);
    },
    logCook(recipeId, mode) {
      state.log.unshift({ id: App.util.uid('l'), recipeId, date: App.util.todayStr(), mode });
      save();
    },
    deleteLog(id) { state.log = state.log.filter(l => l.id !== id); save(); },
    cooksFor: id => state.log.filter(l => l.recipeId === id),
    // Changes arriving from another device. Saved locally only (no echo back), then the
    // current screen redraws.
    applyRemote(patch) {
      let changed = false;
      for (const [k, v] of Object.entries(patch)) {
        const json = JSON.stringify(v);
        if (json === JSON.stringify(state[k])) continue;
        state[k] = v; changed = true;
        if (k !== 'recipes') sent[k] = json;
      }
      if (!changed) return;
      saveLocal();
      App.onRemoteChange?.();
    },
    reset() { state = fresh(); save(); },
  };
})();
