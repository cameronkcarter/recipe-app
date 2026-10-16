// Keeps recipes, the cook log and the shopping list in sync across devices with Firebase
// (Firestore), without a login. Everything lives in a private "kitchen" whose id is a long
// random code. This device remembers its kitchen; other devices join by opening the kitchen
// link once (…/recipe-app/?kitchen=CODE). The browser copy (localStorage) stays as a fast,
// offline cache — Firestore is the shared truth.
//
//   kitchens/{kitchen}/recipes/{recipeId}   one doc per recipe
//   kitchens/{kitchen}/meta/log             { items: [...] }
//   kitchens/{kitchen}/meta/list            shopping list
window.App = window.App || {};
App.sync = (() => {
  const off = { enabled: false, recipe() {}, removeRecipe() {}, meta() {}, link: () => null };
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !window.firebase) return off;

  let db;
  try {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); // works offline too
  } catch (e) { console.warn('Sync off:', e); return off; }

  const S = App.store, KEY = 'recipeapp.kitchen';
  const newCode = () => {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', a = new Uint32Array(28);
    crypto.getRandomValues(a);
    return [...a].map(n => abc[n % abc.length]).join('');
  };
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  // Which kitchen? A ?kitchen= link wins (joining from another device), then the saved one,
  // otherwise this device starts a new kitchen with everything it already has.
  const params = new URLSearchParams(location.search);
  const fromLink = params.get('kitchen');
  let kitchen = read(KEY), mode = 'existing';
  if (fromLink && /^[A-Za-z0-9]{24,}$/.test(fromLink) && fromLink !== kitchen) { kitchen = fromLink; mode = 'join'; }
  else if (!kitchen) { kitchen = newCode(); mode = 'new'; }
  write(KEY, kitchen);
  if (fromLink) { params.delete('kitchen'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); }

  const base = db.collection('kitchens').doc(kitchen);
  const recipesRef = base.collection('recipes'), metaRef = base.collection('meta');
  const clean = o => JSON.parse(JSON.stringify(o)); // Firestore rejects `undefined`

  // ---------- local → cloud ----------
  const api = {
    enabled: true,
    recipe(r) { recipesRef.doc(r.id).set(clean({ ...r, addedAt: r.addedAt || Date.now() })).catch(warn); },
    removeRecipe(id) { recipesRef.doc(id).delete().catch(warn); },
    meta(name, value) { metaRef.doc(name).set(clean(name === 'log' ? { items: value } : value)).catch(warn); },
    link: () => location.origin + location.pathname + '?kitchen=' + kitchen,
  };
  const warn = e => console.warn('Sync:', e.message || e);
  const pushAll = (recipes = S.recipes()) => {
    const now = Date.now();
    recipes.forEach((r, i) => { r.addedAt ||= now - i; api.recipe(r); });
  };

  if (mode === 'new') { pushAll(); api.meta('log', S.state.log); api.meta('list', S.state.list); }

  // ---------- cloud → local ----------
  let first = true;
  recipesRef.onSnapshot(snap => {
    const remote = snap.docs.map(d => d.data()).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (first) {
      first = false;
      // Never wipe this device with an empty kitchen — fill the kitchen from here instead.
      if (!remote.length && S.recipes().length) { pushAll(); mode = 'existing'; return; }
      // Joining from this device: add any recipes this device has that the kitchen doesn't.
      if (mode === 'join') {
        const have = new Set(remote.map(r => r.id));
        const extra = S.recipes().filter(r => !have.has(r.id));
        pushAll(extra);
        remote.push(...extra);
        mode = 'existing';
      }
    }
    remote.forEach(r => (r.steps || []).forEach(s => delete s.detail));
    S.applyRemote({ recipes: remote });
  }, warn);
  metaRef.onSnapshot(snap => {
    const patch = {};
    snap.docs.forEach(d => { if (d.id === 'log') patch.log = d.data().items || []; if (d.id === 'list') patch.list = d.data(); });
    if (Object.keys(patch).length) S.applyRemote(patch);
  }, warn);

  return api;
})();
