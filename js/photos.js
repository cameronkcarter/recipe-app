// Recipe photos: one hero photo per recipe, added in the app (camera or library). The photo is saved
// once, uncropped (shrunk to fit 1600 px and ~300 KB), free in Firestore (its own document per photo,
// so recipe lists stay fast). Framing is a separate, small setting: one zoom and center point that
// places the photo in every shape it shows in (the tall Search feed, the wide recipe cover, cards).
// Photos only ever come from people using the app; the importer never takes them from other sites.
//
//   recipe.photo = { at, thumb, view }   at: when it was saved (also the version); thumb: a tiny
//                                        uncropped copy for cards; view: { z, x, y } (see below)
//   kitchens/main-shared-recipe-collection/photos/{recipeId} = { data, at, by }   the full photo
//
// This device keeps its own copy of each photo (IndexedDB), so a photo is downloaded once.
// Recipes with no photo get a drawn cover instead: their color, a dot pattern, and their icon on a plate.
window.App = window.App || {};
App.photos = {};
(() => {
  const U = () => App.util, S = () => App.store;
  const MAX_SIDE = 1600, THUMB_SIDE = 320, MAX_BYTES = 300000, THUMB_BYTES = 16000;
  // The two shapes a photo is framed for: the Search feed (tall, about a phone screen) and the recipe cover.
  const SHAPES = [{ id: 'feed', w: 9, h: 16, label: 'Search feed' }, { id: 'cover', w: 3, h: 2, label: 'Recipe page' }];

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
    root.querySelectorAll('img[data-photo]').forEach(watch);
  };

  // ---------- placing a photo in its frame ----------
  // view: { z: zoom ≥ 1, x, y: the point of the photo (as a share of its width and height, 0–1) that sits
  // in the middle of the frame }. Each frame shows as much of that as its shape allows; near an edge the
  // photo stops at the edge instead of showing a gap. Photos saved before framing was shared have no view.
  const DEF = { z: 1, x: .5, y: .5 };
  App.photos.view = r => ({ ...DEF, ...(r?.photo?.view || {}) });
  const layout = (iw, ih, cw, ch, v) => {
    const s = Math.max(cw / iw, ch / ih) * v.z, dw = iw * s, dh = ih * s;
    const left = Math.min(0, Math.max(cw - dw, cw / 2 - v.x * dw)), top = Math.min(0, Math.max(ch - dh, ch / 2 - v.y * dh));
    return { dw, dh, left, top };
  };
  App.photos.layout = layout;
  const place = img => {
    const box = img.parentElement, cw = box?.clientWidth, ch = box?.clientHeight;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!cw || !ch || !iw || !ih) return;
    const p = layout(iw, ih, cw, ch, App.photos.view(S().find(img.dataset.photo)));
    img.classList.add('placed');
    img.style.width = p.dw + 'px'; img.style.height = p.dh + 'px';
    img.style.transform = `translate(${p.left}px, ${p.top}px)`;
  };
  App.photos.place = place;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(es => es.forEach(e => {
    const img = e.target.querySelector('img[data-photo]'); if (img) place(img);
  })) : null;
  const watch = img => {
    if (!img.dataset.placing) {
      img.dataset.placing = '1';
      img.addEventListener('load', () => place(img));
      if (img.parentElement) ro?.observe(img.parentElement);
    }
    place(img);
  };
  if (typeof MutationObserver !== 'undefined') document.addEventListener('DOMContentLoaded', () => new MutationObserver(fillSoon).observe(document.body, { childList: true, subtree: true }));

  // ---------- the cover: a photo, or the drawn default ----------
  // kind: 'hero' (recipe page), 'card' (recipe grids), 'feed' (Search feed: as tall as the screen).
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
  App.photos.set = async (id, data, thumb, view) => {
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
    r.photo = { at, thumb, ...(view ? { view: { ...view } } : {}) };
    S().upsertRecipe(r);
  };
  // Changes only the framing (the photo itself stays as saved).
  App.photos.setView = (id, view) => {
    const r = S().find(id);
    if (!App.photos.has(r)) return;
    r.photo = { ...r.photo, view: { ...view } };
    S().upsertRecipe(r);
  };
  // For Undo: the photo as it is now, to put back later.
  App.photos.snapshot = async id => {
    const r = S().find(id);
    if (!App.photos.has(r)) return null;
    return { data: await App.photos.load(r), thumb: r.photo.thumb, view: r.photo.view };
  };
  App.photos.restore = (id, snap) => snap?.data ? App.photos.set(id, snap.data, snap.thumb, snap.view) : App.photos.set(id, '');
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
  // The whole photo, shrunk to fit max × max (never cropped).
  const shrink = (img, max) => {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  // Keeps the center point where at least one of the shapes can still show it (so the buttons always do something).
  const clampView = (img, v) => {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let hw = 1, hh = 1;
    SHAPES.forEach(sh => {
      const s = Math.max(sh.w / iw, sh.h / ih) * v.z;
      hw = Math.min(hw, sh.w / (iw * s) / 2); hh = Math.min(hh, sh.h / (ih * s) / 2);
    });
    v.x = Math.min(1 - hw, Math.max(hw, v.x));
    v.y = Math.min(1 - hh, Math.max(hh, v.y));
    return v;
  };

  // Opens the phone's photo picker (it offers the camera too), then the framing sheet.
  // onDone(data, thumb, view) is called with the finished photo and its framing.
  App.photos.pick = onDone => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) return;
      try { const { img, url } = await readImage(f); frame(img, url, (v) => onDone(jpeg(shrink(img, MAX_SIDE), MAX_BYTES), jpeg(shrink(img, THUMB_SIDE), THUMB_BYTES), v)); }
      catch (e) { App.ui.toast(e.message); }
    });
    input.click();
  };

  // The framing sheet: the photo in both shapes side by side, moved together by one set of buttons.
  // Skipping it (Use photo straight away) leaves the photo centered in both.
  const frame = (img, url, onDone, start = DEF, useLabel = 'Use photo') => {
    const v = clampView(img, { ...DEF, ...start });
    const STEP = .06;
    App.ui.sheet(`<div class="photo-frame">
        <div class="sheet-head"><h3>Frame your photo</h3><button class="btn small" data-close>Cancel</button></div>
        <div class="pf-shapes">${SHAPES.map(sh => `<figure class="pf-shape ${sh.id}"><div class="pf-window" style="aspect-ratio:${sh.w} / ${sh.h}"><img src="${url}" alt=""></div><figcaption>${sh.label}</figcaption></figure>`).join('')}</div>
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
        <button class="btn primary block" data-pf="use">${useLabel}</button></div>`, (el, close) => {
      // show each frame exactly as the photo will look there
      const paint = () => el.querySelectorAll('.pf-window').forEach(win => {
        const pic = win.querySelector('img'), cw = win.clientWidth || 150, ch = win.clientHeight || 100;
        const p = layout(img.naturalWidth, img.naturalHeight, cw, ch, v);
        pic.style.width = p.dw + 'px'; pic.style.height = p.dh + 'px';
        pic.style.transform = `translate(${p.left}px, ${p.top}px)`;
      });
      paint();
      requestAnimationFrame(paint);
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
          try { close(); onDone({ z: +v.z.toFixed(3), x: +v.x.toFixed(4), y: +v.y.toFixed(4) }); }
          catch (err) { b.disabled = false; b.textContent = useLabel; App.ui.toast('Couldn\'t use that photo. Try another one.'); }
          return;
        }
        paint();
      });
    }, () => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); });
  };

  // Moves or zooms a saved photo again, without picking it again. Undo puts the old framing back.
  App.photos.reframe = async (id, after) => {
    const r = S().find(id), src = await App.photos.load(r);
    if (!src) return App.ui.toast('That photo hasn\'t loaded yet. Try again in a moment.');
    const img = new Image();
    img.onload = () => {
      const before = r.photo.view;
      frame(img, src, v => {
        App.photos.setView(id, v);
        after?.();
        App.ui.toast('Framing saved', () => { App.photos.setView(id, before || DEF); after?.(); });
      }, App.photos.view(r), 'Save framing');
    };
    img.src = src;
  };

  // Add / replace / remove on a recipe, with Undo. after() redraws the page.
  App.photos.change = (id, after) => App.photos.pick(async (data, thumb, view) => {
    const before = await App.photos.snapshot(id);
    await App.photos.set(id, data, thumb, view);
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
    App.ui.popover(anchor, `<button class="sug" data-pick="frame">${App.glyph('move')}Move or zoom</button>
      <button class="sug" data-pick="replace">${App.icon('camera')}Replace photo</button>
      <button class="sug danger" data-pick="remove">${App.glyph('x')}Remove photo</button>`, a => a === 'frame' ? App.photos.reframe(id, after) : a === 'replace' ? App.photos.change(id, after) : App.photos.remove(id, after));
  };
})();
