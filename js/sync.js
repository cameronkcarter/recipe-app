// Shares recipes, the cook log and the shopping list across every device through Firebase
// (Firestore). One shared set of data for the whole site — no sign-in.
// The browser copy (localStorage) stays as a fast, offline cache; Firestore is the truth.
//
//   kitchens/main-shared-recipe-collection/recipes/{recipeId}   one doc per recipe
//   kitchens/main-shared-recipe-collection/meta/log             { items: [...] }
//   kitchens/main-shared-recipe-collection/meta/list            shopping list
window.App = window.App || {};
App.sync = (() => {
  const off = { enabled: false, recipe() {}, removeRecipe() {}, meta() {} };
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !window.firebase) return off;

  let db;
  try {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); // works offline too
  } catch (e) { console.warn('Sync off:', e); return off; }

  const S = App.store;
  const base = db.collection('kitchens').doc('main-shared-recipe-collection');
  const recipesRef = base.collection('recipes'), metaRef = base.collection('meta');
  const clean = o => JSON.parse(JSON.stringify(o)); // Firestore rejects `undefined`
  const warn = e => console.warn('Sync:', e.message || e);
  const flag = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const setFlag = k => { try { localStorage.setItem(k, '1'); } catch (e) {} };

  // ---------- this device → everyone ----------
  const api = {
    enabled: true,
    recipe(r) { recipesRef.doc(r.id).set(clean({ ...r, addedAt: r.addedAt || Date.now() })).catch(warn); },
    removeRecipe(id) { recipesRef.doc(id).delete().catch(warn); },
    meta(name, value) { metaRef.doc(name).set(clean(name === 'log' ? { items: value } : value)).catch(warn); },
  };
  const pushAll = recipes => {
    const now = Date.now();
    recipes.forEach((r, i) => { r.addedAt ||= now - i; api.recipe(r); });
  };

  // ---------- everyone → this device ----------
  // The first time a device connects, recipes it saved before syncing existed get added.
  const MERGED = 'recipeapp.merged';
  let first = true;
  recipesRef.onSnapshot(snap => {
    if (first && snap.metadata.fromCache) return; // wait for the real list before merging
    const remote = snap.docs.map(d => d.data()).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (first) {
      first = false;
      if (!flag(MERGED) || !remote.length) {
        const have = new Set(remote.map(r => r.id));
        const extra = S.recipes().filter(r => !have.has(r.id));
        pushAll(extra);
        remote.push(...extra);
        setFlag(MERGED);
      }
    }
    remote.forEach(r => (r.steps || []).forEach(s => delete s.detail));
    S.applyRemote({ recipes: remote });
  }, warn);
  let firstMeta = true;
  metaRef.onSnapshot(snap => {
    if (firstMeta && snap.metadata.fromCache) return;
    if (firstMeta) {
      firstMeta = false;
      const ids = new Set(snap.docs.map(d => d.id));
      if (!ids.has('log') && S.state.log.length) api.meta('log', S.state.log);
      if (!ids.has('list')) api.meta('list', S.state.list);
    }
    const patch = {};
    snap.docs.forEach(d => { if (d.id === 'log') patch.log = d.data().items || []; if (d.id === 'list') patch.list = d.data(); });
    if (Object.keys(patch).length) S.applyRemote(patch);
  }, warn);

  try { localStorage.removeItem('recipeapp.kitchen'); } catch (e) {} // from the short-lived per-device version
  return api;
})();
