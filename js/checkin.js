// After you cook: Sue asks how it went (one tap), offers the matching change to the recipe (with Undo)
// or a "Next time" note, then offers to add a photo. Each time is remembered on the recipe:
//   recipe.cooked   = [{ at, by, verdict, change }]   newest last, last 10 kept
//   recipe.nextTime = [{ id, text, at }]              notes shown above the steps until you clear them
// Shows with Sue on All tips or Check-in only; only on recipes you own (changes go to your recipe).
// Also here: Sue's panel sections for Last time, done temperatures and scaling.
window.App = window.App || {};
App.checkin = {};
(() => {
  const U = () => App.util, S = () => App.store;
  const C = App.checkin;
  const VERDICTS = [
    ['perfect', 'Perfect'], ['salt', 'More salt'], ['spice', 'More spice'],
    ['longer', 'Cook longer'], ['watery', 'Too watery'], ['other', 'Something else…'],
  ];
  const label = v => (VERDICTS.find(x => x[0] === v) || [, v])[1].replace(/…$/, ''); // the chip says "Something else…", the log says "Something else"
  const state = id => ((App.session.checkin ||= {})[id] ||= { stage: 'ask' });

  // A tidy amount after scaling up or down (⅛ steps under 1, ¼ under 4, ½ above), never the same as before.
  const nudge = (q, f) => {
    const step = q < 1 ? .125 : q < 4 ? .25 : .5;
    let n = Math.round(q * f / step) * step;
    if (n === q) n = q + (f > 1 ? step : -step);
    return Math.max(step, +n.toFixed(3));
  };
  const amt = (q, u) => U().fmtAmount(q, U().normUnit(u));
  const findIng = (r, re, skip) => (r.ingredients || []).find(g => re.test(String(g.name).toLowerCase()) && !(skip && skip.test(String(g.name).toLowerCase())));
  const HOT = [/cayenne/, /red pepper flakes|chili flakes|crushed red pepper/, /chipotle|gochujang|curry paste|sriracha|hot sauce/, /serrano|jalape|chil(e|i)(?! powder)/, /chili powder|chilli powder/, /black pepper/];
  const COOKS = /^(cook|simmer|boil|bake|broil|grill|pressure|saute)$/;

  // What a verdict can change: { text, apply } (apply changes the recipe and returns an undo), or null.
  C.offer = (r, v) => {
    if (v === 'salt') {
      const g = findIng(r, /\bsalt\b/, /unsalted|salted butter|celery salt|garlic salt/);
      if (!g || g.qty == null) return null;
      const n = nudge(g.qty, 1.25);
      return { text: `Use ${amt(n, g.unit)} salt (was ${amt(g.qty, g.unit)})`, apply: () => { const was = g.qty; g.qty = n; return () => { g.qty = was; }; } };
    }
    if (v === 'spice') {
      let g = null;
      for (const re of HOT) if ((g = findIng(r, re)) && g.qty != null) break; else g = null;
      if (!g) return null;
      const n = nudge(g.qty, 1.5);
      return { text: `Use ${amt(n, g.unit)} ${g.name} (was ${amt(g.qty, g.unit)})`, apply: () => { const was = g.qty; g.qty = n; return () => { g.qty = was; }; } };
    }
    if (v === 'longer') {
      const s = (r.steps || []).filter(s => +s.time > 0 && COOKS.test(App.verb(s.verb).id)).sort((a, b) => b.time - a.time)[0];
      if (!s) return null;
      const n = +s.time + Math.max(5, Math.round(s.time * .1 / 5) * 5), i = r.steps.indexOf(s) + 1;
      return { text: `Make step ${i} ${U().fmtMins(n)} (was ${U().fmtMins(+s.time)})`, apply: () => { const was = s.time; s.time = n; return () => { s.time = was; }; } };
    }
    if (v === 'watery') {
      const g = (r.ingredients || []).filter(g => /\b(water|broth|stock|milk|cream|wine)\b/i.test(g.name) && g.qty != null && !/bouillon|powder|cube/i.test(g.name))
        .sort((a, b) => (b.qty * (/cup/.test(U().normUnit(b.unit)) ? 48 : 1)) - (a.qty * (/cup/.test(U().normUnit(a.unit)) ? 48 : 1)))[0];
      if (!g) return null;
      const n = nudge(g.qty, .8);
      return { text: `Use ${amt(n, g.unit)} ${g.name} (was ${amt(g.qty, g.unit)})`, apply: () => { const was = g.qty; g.qty = n; return () => { g.qty = was; }; } };
    }
    return null;
  };

  const log = (r, verdict, change) => {
    r.cooked = [...(r.cooked || []), { at: Date.now(), by: S().me()?.id || null, verdict, ...(change ? { change } : {}) }].slice(-10);
  };
  C.addNote = (r, text) => { r.nextTime = [...(r.nextTime || []), { id: 'n' + Date.now().toString(36), text: String(text).trim().slice(0, 200), at: Date.now() }]; };
  const day = at => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  C.last = r => (r.cooked || []).slice(-1)[0] || null;
  C.lastText = r => {
    const l = C.last(r);
    return l ? `${day(l.at)}: ${label(l.verdict)}${l.change ? `. ${l.change}` : l.verdict === 'perfect' ? '' : ' (noted for next time)'}` : '';
  };

  // ---------- on the recipe page ----------
  C.nextTimeHtml = (r, mine) => {
    const list = r.nextTime || [];
    if (!list.length) return '';
    const u = U();
    return `<div class="next-time card"><div class="nt-head">${App.icon('sue')}Next time</div>
      <ul>${list.map(n => `<li><span>${u.esc(n.text)}</span>${mine ? `<button class="sue-tip-x" data-ci="clear" data-note="${u.esc(n.id)}" aria-label="Clear this note">${App.glyph('x')}</button>` : ''}</li>`).join('')}</ul></div>`;
  };

  // ctx: { mine, allDone }
  C.html = (r, ctx) => {
    if (!App.sue.on() || !ctx.mine || !(r.steps || []).length) return '';
    const st = state(r.id), u = U();
    if (st.stage === 'closed') return '';
    if (st.stage === 'ask' && !ctx.allDone) return `<button class="btn block ci-start" data-ci="start">${App.icon('cloche')}Done cooking</button>`;
    const head = t => `<div class="ci-head">${App.icon('sue')}<span>${t}</span><button class="sue-tip-x" data-ci="close" aria-label="Close">${App.glyph('x')}</button></div>`;
    if (st.stage === 'ask' || st.stage === 'open') {
      const last = C.lastText(r);
      return `<div class="checkin card">${head('How did it turn out?')}
        <div class="ci-chips">${VERDICTS.map(([k, l]) => `<button class="chip pick" data-ci="verdict" data-v="${k}">${l}</button>`).join('')}</div>
        ${last ? `<p class="muted ci-last">Last time, ${u.esc(last)}</p>` : ''}</div>`;
    }
    if (st.stage === 'tweak') {
      const o = C.offer(r, st.verdict);
      return `<div class="checkin card">${head(label(st.verdict))}
        ${o ? `<p class="ci-offer">${u.esc(o.text)}?</p>` : `<p class="ci-offer muted">Nothing in the recipe to change for this. Save it as a note?</p>`}
        <div class="ci-acts">${o ? `<button class="btn primary small" data-ci="apply">Change recipe</button>` : ''}
          <button class="btn small" data-ci="note">Note for next time</button></div></div>`;
    }
    if (st.stage === 'other') {
      return `<div class="checkin card">${head('What would you change?')}
        <textarea class="input ci-text" rows="2" maxlength="200" placeholder="Like: less garlic, serve with bread"></textarea>
        <div class="ci-acts"><button class="btn primary small" data-ci="save-other">Save note</button></div></div>`;
    }
    // done
    const photo = !App.photos.has(r);
    return `<div class="checkin card">${head(st.msg || 'Saved')}
      ${photo ? `<div class="ci-acts"><button class="btn small" data-ci="photo">${App.icon('camera')}Add a photo</button></div>` : ''}</div>`;
  };

  // t: the button; ctx: { render }. Returns true when it was a check-in button.
  C.click = (t, r, ctx) => {
    const d = t.dataset, st = state(r.id);
    if (d.ci == null) return false;
    const save = () => S().upsertRecipe(r);
    const done = msg => { st.stage = 'done'; st.msg = msg; ctx.render(); };
    if (d.ci === 'start') { st.stage = 'open'; ctx.render(); }
    else if (d.ci === 'close') { st.stage = 'closed'; ctx.render(); }
    else if (d.ci === 'verdict') {
      st.verdict = d.v;
      if (d.v === 'perfect') { log(r, 'perfect'); save(); done('Glad it worked. Saved.'); }
      else if (d.v === 'other') { st.stage = 'other'; ctx.render(); setTimeout(() => document.querySelector('.ci-text')?.focus(), 0); }
      else { st.stage = 'tweak'; ctx.render(); }
    }
    else if (d.ci === 'apply') {
      const o = C.offer(r, st.verdict);
      if (!o) return true;
      const prevCooked = r.cooked;
      const undo = o.apply();
      log(r, st.verdict, o.text.replace(/^Use /, 'Now ').replace(/^Make /, 'Now '));
      save(); done('Recipe updated');
      App.ui.toast('Recipe updated', () => { undo(); r.cooked = prevCooked; save(); st.stage = 'tweak'; ctx.render(); });
    }
    else if (d.ci === 'note') {
      C.addNote(r, label(st.verdict)); log(r, st.verdict); save(); done('Noted for next time');
    }
    else if (d.ci === 'save-other') {
      const text = document.querySelector('.ci-text')?.value.trim();
      if (!text) return true;
      C.addNote(r, text); log(r, 'other'); save(); done('Noted for next time');
    }
    else if (d.ci === 'clear') {
      const before = r.nextTime;
      r.nextTime = (r.nextTime || []).filter(n => n.id !== d.note);
      if (!r.nextTime.length) delete r.nextTime;
      save(); ctx.render();
      App.ui.toast('Note cleared', () => { r.nextTime = before; save(); ctx.render(); });
    }
    else if (d.ci === 'photo') App.photos.change(r.id, () => { st.stage = 'closed'; ctx.render(); });
    return true;
  };

  // ---------- Sue's panel ----------
  App.sue.section('last', r => (r.cooked || []).length ? { title: 'Last time', html: `<p class="sue-none">${U().esc(C.lastText(r))}</p>` } : null);

  // Safe inside temperatures (USDA), checked with a thermometer in the thickest part.
  const TEMPS = [
    [/chicken|turkey|duck/, 'Chicken and turkey', '165°F (74°C)'],
    [/ground (beef|pork|lamb|meat)|burger|meatball|meatloaf|sausage/, 'Ground meat', '160°F (71°C)'],
    [/pork|ham/, 'Pork chops and roasts', '145°F (63°C), rest 3 min'],
    [/steak|beef|lamb|roast/, 'Beef and lamb', '145°F (63°C), rest 3 min. Medium-rare is 130°F.'],
    [/salmon|fish|cod|tuna|tilapia|halibut|trout|shrimp|scallop/, 'Fish and seafood', '145°F (63°C), or until it flakes'],
    [/\beggs?\b(?!plant)/, 'Egg dishes', '160°F (71°C)'],
  ];
  App.sue.section('temps', r => {
    const names = (r.ingredients || []).map(g => String(g.name).toLowerCase()).join(' | ') + ' | ' + String(r.title || '').toLowerCase();
    // "ground beef" is ground meat, and "chicken broth" isn't chicken
    const solid = names.replace(/ground \w+/g, '').replace(/\w+ (broth|stock|bouillon|base)( powder| cubes?)?/g, '');
    const hits = [], seen = new Set();
    for (const [re, what, temp] of TEMPS) if (re.test(what === 'Ground meat' ? names : solid) && !seen.has(what) && !(what === 'Egg dishes' && /bake|cake|cookie|bread/i.test(names))) { seen.add(what); hits.push([what, temp]); }
    if (!hits.length) return null;
    return { title: 'Done temperatures', html: `<div class="kn-sheet">${hits.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>` };
  });

  // When you've changed the servings.
  App.sue.section('scale', (r, ctx) => {
    const sc = ctx.scale?.() || 1;
    if (Math.abs(sc - 1) < .01) return null;
    const verbs = new Set((r.steps || []).map(s => App.verb(s.verb).id));
    const tips = sc > 1 ? [
      'Salt and spices: start with about ¾ of the new amount, then taste.',
      'Use a bigger pot or pan. A crowded pan steams instead of browning.',
      verbs.has('bake') ? 'Fuller pans can take longer in the oven. Check at the usual time, then add more.' : '',
    ] : [
      'Use a smaller pan so liquid doesn\'t cook off too fast.',
      'Cook times stay about the same. Check a little early.',
    ];
    const n = Math.round(sc * 100) / 100;
    return { title: `Making ${n === 2 ? 'twice as much' : n === .5 ? 'half as much' : `${U().fmtQty(n)}×`}`,
      html: `<ul class="sue-list plain">${tips.filter(Boolean).map(t => `<li><span>${t}</span></li>`).join('')}</ul>` };
  });

  // Keep panel sections in a sensible order: what to know first, reference last.
  const ORDER = ['heads-up', 'last', 'scale', 'temps', 'out', 'vegan', 'measure'];
  App.sue.sections.sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99));
})();
