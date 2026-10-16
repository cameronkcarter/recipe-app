// Saves everything in the browser (localStorage) for now.
// Later this can be swapped for a real database without changing the views much.
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
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : fresh();
    } catch (e) {
      state = fresh();
    }
    state.recipes ||= []; state.log ||= []; state.list ||= { recipes: [], checked: {}, extras: [] };
    // The old example friend notes ("Sam (example)") are gone from the app; drop them from saved data.
    state.recipes.forEach(r => { if (r.notes) r.notes = r.notes.filter(n => !/\(example\)/.test(n.author || '')); });
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
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Could not save', e); }
  }
  load();

  return {
    get state() { return state; },
    save,
    recipes: () => state.recipes,
    recipe: id => state.recipes.find(r => r.id === id),
    upsertRecipe(r) {
      const i = state.recipes.findIndex(x => x.id === r.id);
      if (i > -1) state.recipes[i] = r; else state.recipes.unshift(r);
      save();
    },
    // Saves a new recipe (blank or imported) and returns its id.
    addRecipe(data) {
      const U = App.util;
      const base = U.slug(data.title || 'recipe');
      let id = base, n = 2;
      while (state.recipes.some(r => r.id === id)) id = base + '-' + n++;
      state.recipes.unshift({ title: '', emoji: '🍽️', servings: 4, source: '', tags: [], ingredients: [], steps: [], notes: [], ...data, id });
      save();
      return id;
    },
    deleteRecipe(id) {
      state.recipes = state.recipes.filter(r => r.id !== id);
      state.list.recipes = state.list.recipes.filter(x => x.id !== id);
      save();
    },
    logCook(recipeId, mode) {
      state.log.unshift({ id: App.util.uid('l'), recipeId, date: App.util.todayStr(), mode });
      save();
    },
    deleteLog(id) { state.log = state.log.filter(l => l.id !== id); save(); },
    cooksFor: id => state.log.filter(l => l.recipeId === id),
    exportJSON: () => JSON.stringify(state, null, 2),
    importJSON(text) {
      const data = JSON.parse(text);
      if (!Array.isArray(data.recipes)) throw new Error('Not a backup file');
      state = data;
      state.log ||= []; state.list ||= { recipes: [], checked: {}, extras: [] };
      save();
    },
    reset() { state = fresh(); save(); },
  };
})();
