// Sue: the app's helper, a wooden spoon in a chef's hat. She gives short, useful nudges from simple
// rules and lookup tables inside the app (nothing is sent anywhere, nothing costs money).
// Her tone: short, plain, useful. Cute icon, grown-up words.
// Where she shows up: the first "Before you start" tip as one line at the top of a recipe, the Sue
// button on a recipe for all her tips, and the Done cooking check-in. There's no setting for it.
window.App = window.App || {};
App.sue = {};
(() => {
  const U = () => App.util;
  // A speech bubble from Sue. actions: [{ act, label, primary }] become buttons with data-sue-act.
  App.sue.says = (html, actions = [], cls = '') => `<div class="sue-says ${cls}">
    <span class="sue-ava" aria-hidden="true">${App.icon('sue')}</span>
    <div class="sue-bubble"><div class="sue-text">${html}</div>${actions.length ? `<div class="sue-acts">${actions.map(a =>
      `<button type="button" class="btn small ${a.primary ? 'primary' : ''}" data-sue-act="${U().esc(a.act)}">${a.label}</button>`).join('')}</div>` : ''}</div></div>`;

  // ---------- Heads-up before you start ----------
  // Things worth knowing before step 1: long waits (marinate, chill, rise, overnight), when to
  // preheat the oven, and how long it takes all in.
  const longWait = /\b(marinat\w*|chill\w*|refrigerat\w*|rise|proof\w*|soak\w*|freez\w*)\b/i;
  App.sue.headsUp = r => {
    const u = U(), out = [], steps = r.steps || [];
    steps.forEach((s, i) => {
      const v = App.verb(s.verb), text = `${s.text || ''}`;
      if (/overnight/i.test(text)) { out.push({ ico: 'hourglass', text: `Step ${i + 1} sits overnight. Start the day before.` }); return; }
      const mins = +s.time || 0;
      if (mins >= 60 && (/^(marinate|chill|rest)$/.test(v.id) || longWait.test(text)))
        out.push({ ico: v.icon, text: `Step ${i + 1} is a ${u.fmtMins(mins)} ${v.id === 'marinate' ? 'marinade' : v.id === 'chill' ? 'chill' : 'wait'}. Start early.` });
      if (/\bsoak/i.test(text) && mins < 60) out.push({ ico: 'drop', text: `Step ${i + 1} has a soak. Check how long before you start.` });
    });
    const ovenAt = steps.findIndex(s => /^(preheat|bake|broil)$/.test(App.verb(s.verb).id) || /°\s*[FC]\b|\boven\b/i.test(`${s.temp || ''} ${s.text || ''}`));
    if (ovenAt > 0) {
      const t = steps.slice(ovenAt).map(s => s.temp || (`${s.text || ''}`.match(/\d{3}\s*°\s*[FC]/) || [])[0]).find(Boolean);
      out.push({ ico: 'oven', text: `Preheat the oven${t ? ` to ${u.esc(t)}` : ''} at the start (used in step ${ovenAt + 1}).` });
    }
    const total = u.schedule(r).total;
    if (total >= 90 && !out.some(x => x.ico === 'hourglass')) out.push({ ico: 'clock', text: `Takes about ${u.fmtMins(total)} in total.` });
    return out;
  };

  // ---------- Sue's panel on a recipe ----------
  // Sections are added by name so later features can plug in (see App.sue.sections).
  App.sue.sections = [];
  App.sue.section = (id, fn) => { App.sue.sections = App.sue.sections.filter(s => s.id !== id).concat({ id, fn }); };
  App.sue.section('heads-up', r => {
    const list = App.sue.headsUp(r);
    return { title: 'Before you start', html: list.length
      ? `<ul class="sue-list">${list.map(x => `<li>${App.icon(x.ico)}<span>${x.text}</span></li>`).join('')}</ul>`
      : '<p class="muted sue-none">Nothing to plan ahead.</p>' };
  });

  // ctx: { scale, rerender } from the recipe page.
  App.sue.open = (r, ctx = {}) => {
    const body = () => App.sue.sections.map(s => {
      const out = s.fn(r, ctx);
      return out ? `<section class="sue-sec" data-sec="${s.id}"><h4>${out.title}</h4>${out.html}</section>` : '';
    }).join('');
    App.ui.sheet(`<div class="sue-panel">
        <div class="sheet-head"><h3 class="sue-title">${App.icon('sue')}Sue</h3><button class="btn small" data-close>Close</button></div>
        <div class="sue-body">${body()}</div></div>`, (el, close) => {
      el.addEventListener('click', e => {
        for (const s of App.sue.sections) if (s.onClick?.(e, r, { ...ctx, close, el, redraw: () => { el.querySelector('.sue-body').innerHTML = body(); } })) return;
      });
      for (const s of App.sue.sections) s.onMount?.(el, r, ctx);
    });
  };
  App.sue.onClick = (id, fn) => { const s = App.sue.sections.find(x => x.id === id); if (s) s.onClick = fn; };

  // The first heads-up shows as one quiet line on the recipe page, once per recipe per visit.
  App.sue.recipeNudge = r => {
    const seen = (App.session.sueSeen ||= {});
    if (seen[r.id]) return '';
    const first = App.sue.headsUp(r)[0];
    if (!first) return '';
    return `<div class="sue-tip" role="note"><span class="sue-tip-ico" aria-hidden="true">${App.icon('sue')}</span>
      <span class="sue-tip-text">${first.text}</span>
      <button type="button" class="link" data-sue-act="nudge-more">More</button>
      <button type="button" class="sue-tip-x" data-sue-act="nudge-ok" aria-label="Dismiss">${App.glyph('x')}</button></div>`;
  };
  App.sue.dismissNudge = r => { (App.session.sueSeen ||= {})[r.id] = true; };
})();
