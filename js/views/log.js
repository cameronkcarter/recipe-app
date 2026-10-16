// Cook log: what you've cooked and when.
App.views = App.views || {};

App.views.log = root => {
  const U = App.util, S = App.store;

  function render() {
    const log = S.state.log;
    const today = U.parseDate(U.todayStr());
    const month = U.todayStr().slice(0, 7);
    const thisMonth = log.filter(l => l.date.startsWith(month)).length;
    const distinct = new Set(log.map(l => l.recipeId)).size;

    // Heatmap: last 20 weeks, columns = weeks (Sun–Sat)
    const counts = {};
    log.forEach(l => counts[l.date] = (counts[l.date] || 0) + 1);
    const weeks = 20;
    const start = new Date(today); start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);
    const cells = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const k = U.dateStr(d), n = counts[k] || 0;
      cells.push(`<div class="${n ? 'l' + Math.min(3, n) : ''} ${k === U.todayStr() ? 'today' : ''}" title="${k}${n ? ` · ${n} cooked` : ''}"></div>`);
    }

    // Most cooked
    const tally = {};
    log.forEach(l => tally[l.recipeId] = (tally[l.recipeId] || 0) + 1);
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const row = l => {
      const r = S.recipe(l.recipeId);
      return `<li><span class="e">${U.esc(r?.emoji || '🍽️')}</span>
        <span class="t">${r ? `<a href="#/r/${encodeURIComponent(r.id)}">${U.esc(r.title)}</a>` : '<i>Deleted recipe</i>'}
        <div class="d">${U.fmtDate(l.date)}${l.mode === 'coop' ? ' · 👥 co-op' : ''}</div></span>
        <button class="x" data-del="${l.id}" aria-label="Remove entry">✕</button></li>`;
    };

    root.innerHTML = `
      <header class="topbar"><h1>Cook log</h1></header>
      <div class="stats">
        <div class="card stat"><div class="n">${log.length}</div><div class="l">meals cooked</div></div>
        <div class="card stat"><div class="n">${thisMonth}</div><div class="l">this month</div></div>
        <div class="card stat"><div class="n">${distinct}</div><div class="l">different recipes</div></div>
      </div>

      <div class="section-label">Last ${weeks} weeks</div>
      <div class="card heat-wrap"><div class="heatmap">${cells.join('')}</div></div>

      ${top.length ? `<div class="section-label">Most cooked</div>
        <ul class="card log-list">${top.map(([id, n]) => {
          const r = S.recipe(id);
          return `<li><span class="e">${U.esc(r?.emoji || '🍽️')}</span><span class="t">${r ? `<a href="#/r/${encodeURIComponent(id)}">${U.esc(r.title)}</a>` : '<i>Deleted recipe</i>'}</span><b>${n}×</b></li>`;
        }).join('')}</ul>` : ''}

      <div class="section-label">History</div>
      ${log.length ? `<ul class="card log-list">${log.map(row).join('')}</ul>`
        : `<div class="empty"><div class="big">📅</div><p>Nothing logged yet.<br>Finish a recipe in cook mode, or tap “I cooked this today”.</p></div>`}

      <div class="section-label">Devices</div>
      ${App.sync.enabled
        ? `<p class="muted" style="margin-top:0">Open this link once on your phone or another device to see the same recipes. Anyone with it can edit them.</p>
           <button class="btn small primary" data-act="link">📱 Copy kitchen link</button>`
        : `<p class="muted" style="margin-top:0">Recipes are saved in this browser only.</p>`}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn small" data-act="export">⬇️ Download backup</button>
        <button class="btn small" data-act="import">⬆️ Restore backup</button>
        <input type="file" accept=".json,application/json" hidden>
      </div>`;
  }

  root.onclick = e => {
    const del = e.target.closest('[data-del]');
    if (del) { if (confirm('Remove this entry?')) { S.deleteLog(del.dataset.del); render(); } return; }
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'export') {
      const blob = new Blob([S.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `recipes-backup-${U.todayStr()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    if (t.dataset.act === 'import') root.querySelector('input[type=file]').click();
    if (t.dataset.act === 'link') {
      const link = App.sync.link();
      if (navigator.share) navigator.share({ title: 'Recipes', url: link }).catch(() => {});
      else navigator.clipboard?.writeText(link).then(() => { t.textContent = '✓ Copied'; }, () => prompt('Copy this link:', link));
    }
  };
  root.onchange = async e => {
    if (e.target.type !== 'file' || !e.target.files[0]) return;
    try {
      const text = await e.target.files[0].text();
      if (!confirm('Replace everything in this browser with the backup?')) return;
      S.importJSON(text);
      alert('Backup restored.');
      render();
    } catch (err) { alert('That file could not be read as a backup.'); }
  };

  render();
};
