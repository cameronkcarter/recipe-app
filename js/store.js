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
    profiles: JSON.parse(JSON.stringify(App.SEED_PROFILES)), // [{id, name, avatar, color}]
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
    state.recipes ||= []; state.log ||= []; state.profiles ||= JSON.parse(JSON.stringify(App.SEED_PROFILES)); state.list ||= { recipes: [], checked: {}, extras: [] };
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
      for (const name of ['log', 'list', 'profiles']) {
        const json = JSON.stringify(state[name]);
        if (sent[name] !== json) { sent[name] = json; App.sync.meta(name, state[name]); }
      }
    }, 400);
  }
  const syncRecipe = r => App.sync?.enabled && App.sync.recipe(r);
  load();

  // ---------- Profiles ----------
  // Who's logged in on this device (no passwords yet). null = logged out, which is how a new visitor starts.
  const ME = 'recipeapp.me';
  const meId = () => {
    let id = null;
    try { id = localStorage.getItem(ME); } catch (e) {}
    return state.profiles.some(p => p.id === id) ? id : null;
  };
  // Recipes and log entries from before profiles get their author once the shared copy has arrived
  // (only then, so an old offline copy never overwrites newer entries).
  function fillInAuthors(patch) {
    if (patch.recipes) for (const r of state.recipes) {
      const who = App.SEED_AUTHORS[r.id];
      if (who && !r.author) { r.author = who; syncRecipe(r); }
    }
    if (!patch.log) return;
    let changed = false;
    for (const l of state.log) if (!l.by) { l.by = App.SEED_COOKS[l.recipeId] || 'cameron'; changed = true; }
    if (changed) save();
  }
  fillInAuthors.local = () => state.recipes.forEach(r => { r.author ||= App.SEED_AUTHORS[r.id]; });
  fillInAuthors.local();

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
      state.recipes.unshift({ title: '', author: meId(), servings: 4, source: '', tags: [], ingredients: [], steps: [], notes: [], ...data, id, addedAt: Date.now() });
      save(); syncRecipe(state.recipes[0]);
      return id;
    },
    deleteRecipe(id) {
      state.recipes = state.recipes.filter(r => r.id !== id);
      state.list.recipes = state.list.recipes.filter(x => x.id !== id);
      save();
      if (App.sync?.enabled) App.sync.removeRecipe(id);
    },
    // A past day can be logged too (from the profile's History calendar); the log stays newest first.
    logCook(recipeId, mode, date = App.util.todayStr()) {
      state.log.unshift({ id: App.util.uid('l'), recipeId, date, mode, by: meId() });
      state.log.sort((a, b) => b.date.localeCompare(a.date));
      save();
    },
    deleteLog(id) { state.log = state.log.filter(l => l.id !== id); save(); },
    // Times a recipe was cooked by one person (default: you; none when logged out).
    cooksFor: (id, by = meId()) => by ? state.log.filter(l => l.recipeId === id && (l.by || 'cameron') === by) : [],
    cooksBy: by => state.log.filter(l => (l.by || 'cameron') === by),
    profiles: () => state.profiles,
    profile: id => state.profiles.find(p => p.id === id),
    me: () => state.profiles.find(p => p.id === meId()),
    // Log in (an id) or log out (null).
    setMe(id) { try { if (id) localStorage.setItem(ME, id); else localStorage.removeItem(ME); } catch (e) {} },
    addProfile(name, avatar, color) {
      const base = App.util.slug(name);
      let id = base, n = 2;
      while (state.profiles.some(p => p.id === id)) id = base + '-' + n++;
      state.profiles.push({ id, name, avatar, color });
      save();
      return id;
    },
    updateProfile(id, patch) { Object.assign(state.profiles.find(p => p.id === id), patch); save(); },
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
      fillInAuthors(patch); // also when the shared copy didn't change
      if (!changed) return;
      saveLocal();
      App.onRemoteChange?.();
    },
    reset() { state = fresh(); save(); },
  };
})();
