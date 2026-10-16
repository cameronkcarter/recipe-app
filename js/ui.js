// Shared UI pieces: bottom sheet, timers, screen wake lock, step rendering, notes.
window.App = window.App || {};
App.ui = {};
(() => {
  const U = App.util;

  // ---------- Bottom sheet ----------
  App.ui.sheet = (html, onMount) => {
    const back = document.createElement('div');
    back.className = 'sheet-back';
    back.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    document.body.appendChild(back);
    onMount && onMount(back.querySelector('.sheet'), close);
    return close;
  };

  // ---------- Step rendering ----------
  // Amount shown for an ingredient inside a step: the step's portion if set, else the full amount.
  App.ui.useAmount = (use, ing, scale) => {
    const qty = use.qty != null ? use.qty : ing.qty;
    const unit = use.qty != null ? (use.unit ?? ing.unit) : ing.unit;
    return qty != null ? U.fmtAmount(qty * scale, U.normUnit(unit)) : '';
  };

  // Two columns: the action on the left, what it uses on the right.
  // Time / heat / temp sit underneath as a quiet note line.
  App.ui.step = (recipe, step, scale = 1, opts = {}) => {
    const v = App.verb(step.verb);
    // Only show an amount the first time an ingredient appears (or when the step uses a set portion).
    const idx = recipe.steps.indexOf(step);
    const usedBefore = new Set(recipe.steps.slice(0, Math.max(0, idx)).flatMap(s => (s.uses || []).map(u => u.ing)));
    const items = (step.uses || []).map(use => {
      const ing = recipe.ingredients.find(i => i.id === use.ing);
      if (!ing) return '';
      const amt = use.qty != null || !usedBefore.has(ing.id) ? App.ui.useAmount(use, ing, scale) : '';
      return `<li>${U.ingIconHtml(ing)}<span>${amt ? `<b>${U.esc(amt)}</b> ` : ''}${U.esc(ing.name)}${use.note ? ` <span class="un">· ${U.esc(use.note)}</span>` : ''}</span></li>`;
    }).join('');
    const text = step.text ? `<div class="s-text ${items ? '' : 'solo'}">${U.esc(step.text)}</div>` : '';
    return `<div class="s-grid">
      <div class="s-verb"><span class="vi">${v.icon}</span><span class="vl">${U.esc(v.label)}</span></div>
      <div class="s-what">${items ? `<ul class="s-ings">${items}</ul>` : ''}${text}${App.ui.stepMeta(step, recipe, opts)}</div>
    </div>`;
  };

  App.ui.stepMeta = (step, recipe, opts = {}) => {
    const out = [];
    if (step.time) {
      const v = App.verb(step.verb);
      out.push(`<button class="s-timer" data-action="timer" data-mins="${+step.time}" data-label="${U.esc(v.label + (recipe ? ' · ' + recipe.title : ''))}" title="Start a timer">⏲ ${U.esc(U.fmtMins(+step.time))}</button>`);
    }
    if (step.heat) out.push(`<span>🔥 ${U.HEAT[step.heat].toLowerCase()} heat</span>`);
    if (step.temp) out.push(`<span>🌡 ${U.esc(step.temp)}</span>`);
    if (opts.extra) out.push(opts.extra);
    return out.length ? `<div class="s-meta">${out.join('<span class="dot">·</span>')}</div>` : '';
  };

  // ---------- Notes ----------
  App.ui.notesFor = (recipe, target, removable = true) =>
    (recipe.notes || []).filter(n => n.target === target).map(n => {
      const t = App.NOTE_TYPES.find(x => x.id === n.type) || App.NOTE_TYPES[4];
      return `<div class="note"><span>${t.icon}</span><span><span class="who">${U.esc(n.author || 'Me')}:</span> ${U.esc(n.text)}</span>${removable ? `<button class="x" data-action="del-note" data-id="${n.id}" aria-label="Delete note">✕</button>` : ''}</div>`;
    }).join('');

  // ---------- Timers ----------
  const timers = [];
  let tickHandle = null, audioCtx = null;
  const host = () => {
    let el = document.getElementById('timers');
    if (!el) { el = document.createElement('div'); el.id = 'timers'; el.className = 'timers'; document.body.appendChild(el); }
    return el;
  };
  const beep = () => {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(.25, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .4);
      o.start(); o.stop(audioCtx.currentTime + .4);
    } catch (e) { /* no audio */ }
  };
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const render = () => {
    host().innerHTML = timers.map(t => {
      const left = (t.end - Date.now()) / 1000;
      return `<div class="timer-pill ${left <= 0 ? 'ring' : ''}" data-id="${t.id}">⏲️ ${U.esc(t.label)}
        <span class="t">${left <= 0 ? 'Done!' : fmt(left)}</span>
        ${left > 0 ? `<button data-timer="add" data-id="${t.id}">+1</button>` : ''}
        <button data-timer="stop" data-id="${t.id}">${left <= 0 ? 'OK' : '✕'}</button></div>`;
    }).join('');
  };
  const tick = () => {
    const now = Date.now();
    for (const t of timers) {
      if (t.end <= now && now - (t.lastBeep || 0) > 1500) { t.lastBeep = now; beep(); navigator.vibrate?.(300); }
    }
    render();
    if (!timers.length) { clearInterval(tickHandle); tickHandle = null; }
  };
  App.ui.startTimer = (label, mins) => {
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch (e) {}
    timers.push({ id: U.uid('t'), label, end: Date.now() + mins * 60000 });
    render();
    tickHandle ||= setInterval(tick, 500);
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-timer]');
    if (!b) return;
    const i = timers.findIndex(t => t.id === b.dataset.id);
    if (i < 0) return;
    if (b.dataset.timer === 'stop') timers.splice(i, 1);
    else timers[i].end += 60000;
    render();
  });

  // ---------- Keep screen awake while cooking ----------
  let lock = null;
  App.ui.keepAwake = async on => {
    App.ui.wantAwake = on;
    try {
      if (on && 'wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => lock = null); }
      if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) { /* not supported / not allowed */ }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && App.ui.wantAwake) App.ui.keepAwake(true);
  });
})();
