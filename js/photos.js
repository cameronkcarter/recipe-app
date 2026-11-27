// Recipe photos: one hero photo per recipe, added in the app (camera or library), framed with
// zoom and nudge buttons (no dragging), shrunk to about 1200×800 and ~150 KB, and saved free in
// Firestore (its own document per photo, so recipe lists stay fast). Photos only ever come from
// people using the app; the importer never takes them from other sites.
//
//   recipe.photo = { at, thumb }    at: when it was saved (also the version); thumb: a tiny copy for cards
//   kitchens/main-shared-recipe-collection/photos/{recipeId} = { data, at, by }   the full photo
//
// This device keeps its own copy of each photo (IndexedDB), so a photo is downloaded once.
// Recipes with no photo get a drawn cover instead: their color, a dot pattern, and their icon on a plate.
window.App = window.App || {};
App.photos = {};
(() => {
  const U = () => App.util, S = () => App.store;
  const W = 1200, H = 800, TW = 240, TH = 160, MAX_BYTES = 190000;

  // ---------- this device's copy (IndexedDB) ----------
  let dbp = null;
  const idb = () => dbp ||= new Promise(res => {
    try {
      const rq = indexedDB.open('recipeapp-photos', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('photos', { keyPath: 'id' });
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  const tx = async (mode, fn) => {
    const db = await idb();
    if (!db) return null;
    return new Promise(res => {
      try {
        const t = db.transaction('photos', mode), st = t.objectStore('photos');
        const rq = fn(st);
        t.oncomplete = () => res(rq?.result ?? null);
        t.onerror = t.onabort = () => res(null);
      } catch (e) { res(null); }
    });
  };
  const localGet = id => tx('readonly', st => st.get(id));
  const localPut = rec => tx('readwrite', st => st.put(rec));
  const localDel = id => tx('readwrite', st => st.delete(id));

  // ---------- loading ----------
  const mem = {}; // id → { at, data }
  const pending = {};
  App.photos.has = r => !!(r && r.photo && r.photo.at);
  App.photos.thumb = r => (App.photos.has(r) && r.photo.thumb) || '';
  // The full photo as a data URL (or '' when there isn't one / it can't be found).
  App.photos.load = async r => {
    if (!App.photos.has(r)) return '';
    const id = r.id, at = r.photo.at;
    if (mem[id]?.at === at) return mem[id].data;
    const key = id + '@' + at;
    return pending[key] ||= (async () => {
      let rec = await localGet(id);
      if (!rec || rec.at !== at) {
        const remote = App.sync?.getPhoto ? await App.sync.getPhoto(id) : null;
        if (remote?.data) { rec = { id, at: remote.at, data: remote.data }; localPut(rec); }
      }
      if (rec?.data) mem[id] = { at: rec.at, data: rec.data };
      delete pending[key];
      return rec?.data || '';
    })();
  };
  // Any photo that shows up on screen gets its full copy (lists redraw parts of the page often).
  let queued = false;
  const fillSoon = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; App.photos.fill(document); }); };
  App.photos.fill = root => {
    root.querySelectorAll('img[data-photo]:not([data-filling])').forEach(img => {
      img.dataset.filling = '1';
      const r = S().find(img.dataset.photo);
      if (!App.photos.has(r)) return;
      App.photos.load(r).then(src => { if (src && img.isConnected) { img.src = src; img.classList.add('sharp'); } });
    });
  };
  if (typeof MutationObserver !== 'undefined') document.addEventListener('DOMContentLoaded', () => new MutationObserver(fillSoon).observe(document.body, { childList: true, subtree: true }));

  // ---------- the cover: a photo, or the drawn default ----------
  // kind: 'hero' (recipe page), 'card' (recipe grids), 'feed' (Search feed). Same 3:2 shape everywhere.
  App.photos.coverHtml = (r, kind = 'card') => {
    const u = U();
    if (App.photos.has(r)) {
      const th = App.photos.thumb(r);
      return `<div class="r-cover photo ${kind}"><img data-photo="${u.esc(r.id)}" src="${th || ''}" alt="${u.esc(r.title || 'Recipe photo')}" ${kind === 'card' ? 'loading="lazy"' : ''}></div>`;
    }
    return `<div class="r-cover drawn ${kind}" style="--blob:${u.esc(u.recipeBlob(r))}" aria-hidden="true"><span class="plate">${App.icon(u.recipeIcon(r))}</span></div>`;
  };

  // ---------- saving ----------
  const me = () => S().me()?.id || null;
  // Puts a photo on a recipe (data: a JPEG data URL, or '' to remove it). Saves right away.
  App.photos.set = async (id, data, thumb) => {
    const r = S().find(id);
    if (!r) return;
    if (!data) {
      delete r.photo; delete mem[id];
      S().upsertRecipe(r);
      localDel(id);
      App.sync?.removePhoto?.(id);
      return;
    }
    const at = Date.now();
    mem[id] = { at, data };
    await localPut({ id, at, data });
    App.sync?.photo?.(id, { data, at, by: me() });
    r.photo = { at, thumb };
    S().upsertRecipe(r);
  };
  // For Undo: the photo as it is now, to put back later.
  App.photos.snapshot = async id => {
    const r = S().find(id);
    if (!App.photos.has(r)) return null;
    return { data: await App.photos.load(r), thumb: r.photo.thumb };
  };
  App.photos.restore = (id, snap) => snap?.data ? App.photos.set(id, snap.data, snap.thumb) : App.photos.set(id, '');
  App.photos.forget = id => { delete mem[id]; localDel(id); App.sync?.removePhoto?.(id); };

  // ---------- picking and framing ----------
  const readImage = file => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file isn\'t a photo this browser can open.')); };
    img.src = url;
  });
  const jpeg = (canvas, maxBytes) => {
    let q = .84, out = canvas.toDataURL('image/jpeg', q);
    while (out.length * .75 > maxBytes && q > .45) { q -= .08; out = canvas.toDataURL('image/jpeg', q); }
    return out;
  };
  // view: { z: zoom ≥ 1, x, y: center of the frame as a share of the photo (0–1) }
  const draw = (img, v, w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight), s = base * v.z;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, w / 2 - v.x * dw, h / 2 - v.y * dh, dw, dh);
    return c;
  };
  // Keeps the frame inside the photo.
  const clampView = (img, v) => {
    const fw = 3, fh = 2, base = Math.max(fw / img.naturalWidth, fh / img.naturalHeight), s = base * v.z;
    const hw = fw / (img.naturalWidth * s) / 2, hh = fh / (img.naturalHeight * s) / 2;
    v.x = Math.min(1 - hw, Math.max(hw, v.x));
    v.y = Math.min(1 - hh, Math.max(hh, v.y));
    return v;
  };

  // Opens the phone's photo picker (it offers the camera too), then the framing sheet.
  // onDone(data, thumb) is called with the finished photo.
  App.photos.pick = onDone => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) return;
      try { const { img, url } = await readImage(f); frame(img, url, onDone); }
      catch (e) { App.ui.toast(e.message); }
    });
    input.click();
  };

  const frame = (img, url, onDone) => {
    const v = clampView(img, { z: 1, x: .5, y: .5 });
    const STEP = .06;
    App.ui.sheet(`<div class="photo-frame">
        <div class="sheet-head"><h3>Frame your photo</h3><button class="btn small" data-close>Cancel</button></div>
        <div class="pf-window"><img src="${url}" alt=""></div>
        <div class="pf-controls">
          <div class="pf-zoom"><button class="icon-btn" data-pf="out" aria-label="Zoom out">${App.glyph('minus')}</button><span>Zoom</span><button class="icon-btn" data-pf="in" aria-label="Zoom in">${App.glyph('plus')}</button></div>
          <div class="pf-pad">
            <button class="icon-btn" data-pf="up" aria-label="Move up">${App.glyph('up')}</button>
            <button class="icon-btn" data-pf="left" aria-label="Move left">${App.glyph('back')}</button>
            <button class="icon-btn" data-pf="center" aria-label="Center">${App.glyph('move')}</button>
            <button class="icon-btn" data-pf="right" aria-label="Move right">${App.glyph('chevron')}</button>
            <button class="icon-btn" data-pf="down" aria-label="Move down">${App.glyph('down')}</button>
          </div>
        </div>
        <button class="btn primary block" data-pf="use">Use photo</button></div>`, (el, close) => {
      const pic = el.querySelector('.pf-window img');
      // show the frame exactly as the saved photo will look
      const paint = () => {
        const win = el.querySelector('.pf-window'), fw = win.clientWidth || 300, fh = fw * 2 / 3;
        const base = Math.max(fw / img.naturalWidth, fh / img.naturalHeight), s = base * v.z;
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        pic.style.width = dw + 'px'; pic.style.height = dh + 'px';
        pic.style.transform = `translate(${fw / 2 - v.x * dw}px, ${fh / 2 - v.y * dh}px)`;
      };
      paint();
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-pf]');
        if (!b) return;
        const a = b.dataset.pf, move = STEP / v.z;
        if (a === 'in') v.z = Math.min(4, v.z * 1.2);
        if (a === 'out') v.z = Math.max(1, v.z / 1.2);
        if (a === 'left') v.x -= move;
        if (a === 'right') v.x += move;
        if (a === 'up') v.y -= move;
        if (a === 'down') v.y += move;
        if (a === 'center') { v.x = .5; v.y = .5; }
        clampView(img, v);
        if (a === 'use') {
          b.disabled = true; b.textContent = 'Saving…';
          try {
            const data = jpeg(draw(img, v, W, H), MAX_BYTES), thumb = jpeg(draw(img, v, TW, TH), 14000);
            close(); onDone(data, thumb);
          } catch (err) { b.disabled = false; b.textContent = 'Use photo'; App.ui.toast('Couldn\'t use that photo. Try another one.'); }
          return;
        }
        paint();
      });
    }, () => URL.revokeObjectURL(url));
  };

  // Add / replace / remove on a recipe, with Undo. after() redraws the page.
  App.photos.change = (id, after) => App.photos.pick(async (data, thumb) => {
    const before = await App.photos.snapshot(id);
    await App.photos.set(id, data, thumb);
    after?.();
    App.ui.toast(before ? 'Photo replaced' : 'Photo added', async () => { await App.photos.restore(id, before); after?.(); });
  });
  App.photos.remove = async (id, after) => {
    const before = await App.photos.snapshot(id);
    await App.photos.set(id, '');
    after?.();
    App.ui.toast('Photo removed', async () => { await App.photos.restore(id, before); after?.(); });
  };
  App.photos.menu = (anchor, id, after) => {
    const has = App.photos.has(S().find(id));
    if (!has) return App.photos.change(id, after);
    App.ui.popover(anchor, `<button class="sug" data-pick="replace">${App.icon('camera')}Replace photo</button>
      <button class="sug danger" data-pick="remove">${App.glyph('x')}Remove photo</button>`, a => a === 'replace' ? App.photos.change(id, after) : App.photos.remove(id, after));
  };
})();
