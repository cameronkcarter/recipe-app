// Helpers: formatting, units, ingredient parsing, and the co-op scheduler.
window.App = window.App || {};
const U = App.util = {};

U.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
U.uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9);
U.slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe';

// ---------- Quantities ----------
const FRACS = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, '']];
U.fmtQty = q => {
  if (q == null || isNaN(q)) return '';
  if (q >= 20) return String(Math.round(q));
  if (q >= 10) return String(Math.round(q * 2) / 2).replace('.5', '½');
  let whole = Math.floor(q), rest = q - whole, best = FRACS[0];
  for (const f of FRACS) if (Math.abs(rest - f[0]) < Math.abs(rest - best[0])) best = f;
  if (best[0] === 1) { whole += 1; best = FRACS[0]; }
  if (!whole && !best[1]) return q > 0 ? '⅛' : '0';
  return (whole || '') + best[1];
};
const UNI = { '½': .5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': .25, '¾': .75, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 };
// "1 1/2", "1½", "1.5", "3/4", "1-2" (takes the first number) → number
U.parseQty = s => {
  s = String(s ?? '').trim();
  if (!s) return null;
  s = s.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, m => ' ' + UNI[m]).trim();
  s = s.split(/\s*[-–]\s*|\s+to\s+/)[0];
  let total = 0, any = false;
  for (const part of s.split(/\s+/)) {
    const f = part.match(/^(\d+)\/(\d+)$/);
    if (f) { total += +f[1] / +f[2]; any = true; continue; }
    const n = parseFloat(part);
    if (!isNaN(n)) { total += n; any = true; }
  }
  return any ? total : null;
};

// ---------- Units ----------
const UNIT_ALIASES = {
  tsp: ['tsp', 't', 'teaspoon', 'teaspoons', 'tsps'],
  tbsp: ['tbsp', 'tbs', 'tbl', 'T', 'tablespoon', 'tablespoons', 'tbsps'],
  cup: ['cup', 'cups', 'c'],
  'fl oz': ['fl oz', 'fluid ounce', 'fluid ounces'],
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  g: ['g', 'gram', 'grams'],
  kg: ['kg', 'kilogram', 'kilograms'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans'],
  pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'],
  bunch: ['bunch', 'bunches'],
  package: ['package', 'packages', 'pkg'],
  slice: ['slice', 'slices'],
  stick: ['stick', 'sticks'],
  head: ['head', 'heads'],
  sprig: ['sprig', 'sprigs'],
  handful: ['handful', 'handfuls'],
};
const ALIAS = {};
for (const [k, list] of Object.entries(UNIT_ALIASES)) for (const a of list) ALIAS[a] = k;
U.normUnit = u => {
  u = String(u ?? '').trim().replace(/\.$/, '');
  if (!u) return '';
  return ALIAS[u] || ALIAS[u.toLowerCase()] || u.toLowerCase();
};
U.UNITS = Object.keys(UNIT_ALIASES);

const VOL = { tsp: 1, tbsp: 3, cup: 48, 'fl oz': 6, ml: 0.202884, l: 202.884 }; // in tsp
const WT = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };                       // in grams
const PLURAL = new Set(['cup', 'clove', 'can', 'pinch', 'dash', 'bunch', 'package', 'slice', 'stick', 'head', 'sprig', 'handful']);
U.fmtUnit = (unit, qty) => {
  if (!unit) return '';
  if (PLURAL.has(unit) && qty != null && qty > 1) return unit === 'pinch' || unit === 'dash' || unit === 'bunch' ? unit + 'es' : unit + 's';
  return unit;
};
U.fmtAmount = (qty, unit) => {
  const q = U.fmtQty(qty);
  const u = U.fmtUnit(unit, qty);
  return [q, u].filter(Boolean).join(' ');
};

// Merge a list of {qty, unit} into display parts, converting where units are compatible.
U.mergeAmounts = items => {
  const vol = [], wt = [], other = {};
  let noQty = false;
  for (const it of items) {
    const u = U.normUnit(it.unit);
    if (it.qty == null) { noQty = true; continue; }
    if (VOL[u]) vol.push({ q: it.qty, u });
    else if (WT[u]) wt.push({ q: it.qty, u });
    else other[u] = (other[u] || 0) + it.qty;
  }
  const parts = [];
  const sameUnit = arr => arr.every(x => x.u === arr[0].u);
  if (vol.length) {
    if (sameUnit(vol)) parts.push(U.fmtAmount(vol.reduce((a, x) => a + x.q, 0), vol[0].u));
    else {
      const tsp = vol.reduce((a, x) => a + x.q * VOL[x.u], 0);
      if (tsp >= 24) parts.push(U.fmtAmount(tsp / 48, 'cup'));
      else if (tsp >= 3) parts.push(U.fmtAmount(tsp / 3, 'tbsp'));
      else parts.push(U.fmtAmount(tsp, 'tsp'));
    }
  }
  if (wt.length) {
    if (sameUnit(wt)) parts.push(U.fmtAmount(wt.reduce((a, x) => a + x.q, 0), wt[0].u));
    else {
      const metric = wt.some(x => x.u === 'g' || x.u === 'kg');
      const g = wt.reduce((a, x) => a + x.q * WT[x.u], 0);
      if (metric) parts.push(g >= 1000 ? U.fmtAmount(g / 1000, 'kg') : U.fmtAmount(g, 'g'));
      else parts.push(g >= 453 ? U.fmtAmount(g / WT.lb, 'lb') : U.fmtAmount(g / WT.oz, 'oz'));
    }
  }
  for (const [u, q] of Object.entries(other)) parts.push(U.fmtAmount(q, u));
  if (!parts.length && noQty) return '';
  return parts.join(' + ');
};

// ---------- Ingredients ----------
U.ingIcon = name => {
  const n = String(name).toLowerCase();
  for (const [k, ico] of App.ING_ICONS) if (n.includes(k)) return ico;
  return null;
};
U.ingIconHtml = ing => {
  const ico = ing.icon || U.ingIcon(ing.name);
  if (ico) return `<span class="ing-ico">${ico}</span>`;
  return `<span class="ing-ico letter">${U.esc((ing.name || '?')[0].toUpperCase())}</span>`;
};
U.category = ing => {
  if (ing.cat) return ing.cat;
  const n = String(ing.name).toLowerCase();
  if (U.normUnit(ing.unit) === 'can') return 'pantry';
  for (const [cat, words] of App.CAT_KEYWORDS) if (words.some(w => n.includes(w))) return cat;
  return 'other';
};

// "2 (15-ounce) cans black beans, drained" → {qty:2, unit:'can', name:'black beans', note:'15-ounce'}
U.parseIngredientLine = line => {
  let s = String(line).trim().replace(/^[-•*▢□]\s*/, '');
  if (!s) return null;
  let note = '';
  s = s.replace(/\(([^)]*)\)/g, (m, inner) => {
    if (/^\d+$/.test(inner.trim())) return inner; // "(2) cans" → "2 cans"
    note = note ? note + ', ' + inner : inner; return ' ';
  }).replace(/\s+/g, ' ').trim();
  const m = s.match(/^((?:\d+\s+)?\d+\/\d+|\d*\.?\d+(?:\s*[½⅓⅔¼¾⅛⅜⅝⅞])?|[½⅓⅔¼¾⅛⅜⅝⅞])(?:\s*(?:[-–]|to)\s*[\d./½¼¾]+)?\s*(.*)$/);
  let qty = null, rest = s;
  if (m) { qty = U.parseQty(m[1]); rest = m[2]; }
  // size words like "15-ounce" before the unit
  const size = rest.match(/^(\d+[- ]?(?:ounce|oz|g|gram)s?)\s+/i);
  if (size) { note = note ? size[1] + ', ' + note : size[1]; rest = rest.slice(size[0].length); }
  const sizeWord = rest.match(/^(large|small|medium|big)\s+(?=\S)/i);
  if (sizeWord && ALIAS[rest.slice(sizeWord[0].length).split(' ')[0].replace(/[.,]$/, '').toLowerCase()]) { note = note ? sizeWord[1] + ', ' + note : sizeWord[1]; rest = rest.slice(sizeWord[0].length); }
  let unit = '';
  const words = rest.split(' ');
  for (const len of [2, 1]) {
    const cand = words.slice(0, len).join(' ').replace(/[.,]$/, '');
    if (ALIAS[cand] || ALIAS[cand.toLowerCase()]) { unit = U.normUnit(cand); rest = words.slice(len).join(' '); break; }
  }
  rest = rest.replace(/^of\s+/i, '');
  // "chopped cilantro" → name "cilantro", note "chopped"
  const prep = rest.match(/^((?:finely |roughly |freshly )?(?:chopped|diced|minced|sliced|grated|shredded|peeled|fresh|large|medium|small))\s+(?=\S)/i);
  if (prep && !/tomato/i.test(rest)) { note = note ? prep[1] + ', ' + note : prep[1]; rest = rest.slice(prep[0].length); }
  const comma = rest.indexOf(',');
  if (comma > -1) { const after = rest.slice(comma + 1).trim(); note = note ? note + ', ' + after : after; rest = rest.slice(0, comma); }
  // "2 garlic cloves" → unit "clove", name "garlic"
  if (!unit) {
    const tail = rest.trim().match(/^(.+?)\s+(cloves?|cans?|sticks?|sprigs?|heads?|bunch(?:es)?|slices?|stalks?)$/i);
    if (tail) { rest = tail[1]; unit = U.normUnit(tail[2]); }
  }
  return { id: U.uid('i'), qty, unit, name: rest.trim() || s, note: note.trim() || undefined };
};

// ---------- Steps / scheduling ----------
U.stepDeps = (recipe, i) => {
  const s = recipe.steps[i];
  if (Array.isArray(s.after)) return s.after.filter(id => recipe.steps.some(x => x.id === id));
  return i > 0 ? [recipe.steps[i - 1].id] : [];
};
// Minutes a step takes. Only timed steps (simmer 20 min, sauté 4 min) store a time and show it;
// everything else gets a rough estimate here so co-op can still split the work sensibly.
U.stepTime = s => {
  if (s.time != null && s.time !== '') return +s.time;
  const v = App.verb(s.verb), n = Math.max(1, (s.uses || []).length);
  if (v.group === 'Prep') return (['rinse', 'drain', 'measure'].includes(v.id) ? 1 : 3) * n;
  if (v.id === 'preheat') return 10;
  if (v.passive) return v.group === 'Oven' ? 15 : 5;
  if (v.group === 'Stove') return 2;
  return 1;
};

// Splits steps between chefs. Returns { byId: {stepId: {chef, start, end}}, total } (minutes).
// 1. Start from a few guesses: everything on Chef A, a quick "whoever is free" split,
//    and one prep cook + one stove cook.
// 2. Try moving steps to the other chef, keeping a move when it makes the meal faster,
//    or same speed with more even work and fewer pot hand-offs.
// Passive steps (simmer, bake...) only keep the chef busy for ~1 minute.
U.schedule = (recipe, chefs = 2) => {
  const steps = recipe.steps;
  const n = steps.length;
  const idx = {}; steps.forEach((s, i) => idx[s.id] = i);
  const deps = steps.map((_, i) => U.stepDeps(recipe, i).map(id => idx[id]));
  const dur = steps.map(U.stepTime);
  const passive = steps.map(s => !!App.verb(s.verb).passive);
  const busy = steps.map((_, i) => passive[i] ? Math.min(1, dur[i]) : dur[i]);
  const pinned = steps.map(s => chefs === 2 && (s.chef === 'A' || s.chef === 'B') ? s.chef : null);

  // tail[i] = time from the start of step i to the end of the meal along its longest chain
  const tail = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const kids = deps.map((d, j) => j).filter(j => deps[j].includes(i));
    tail[i] = dur[i] + Math.max(0, ...kids.map(j => tail[j]));
  }
  // The step whose pot/pan this step continues: its latest non-prep dependency, else its last one.
  const parent = deps.map(ds => {
    const cook = [...ds].reverse().find(d => App.verb(steps[d].verb).group !== 'Prep');
    return cook ?? (ds.length ? Math.max(...ds) : null);
  });

  // Given who does what, work out when each step happens.
  function simulate(assign) {
    const free = { A: 0, B: 0 }, start = [], end = [];
    const left = new Set(steps.map((_, i) => i));
    while (left.size) {
      let pick = -1, pickStart = Infinity;
      for (const i of left) {
        if (!deps[i].every(d => end[d] != null)) continue;
        const st = Math.max(free[assign[i]], ...deps[i].map(d => end[d]));
        if (st < pickStart || (st === pickStart && tail[i] > tail[pick])) { pick = i; pickStart = st; }
      }
      if (pick < 0) break; // only if dependencies loop, which the editor prevents
      start[pick] = pickStart; end[pick] = pickStart + dur[pick];
      free[assign[pick]] = pickStart + busy[pick];
      left.delete(pick);
    }
    return { start, end, total: Math.max(0, ...end.filter(x => x != null)) };
  }
  function cost(assign) {
    const { total } = simulate(assign);
    let a = 0, b = 0, handoffs = 0;
    steps.forEach((_, i) => {
      if (assign[i] === 'A') a += busy[i]; else b += busy[i];
      if (parent[i] != null && assign[parent[i]] !== assign[i] && App.verb(steps[i].verb).group !== 'Prep') handoffs++;
    });
    return total * 10 + Math.abs(a - b) + handoffs * 5;
  }

  let assign = steps.map((_, i) => pinned[i] || 'A');
  if (chefs === 2) {
    // A step plus every later step that continues in the same pot (so a whole stove run can move at once).
    const chain = i => {
      const out = [i];
      for (let j = i + 1; j < n; j++) if (out.includes(parent[j]) && App.verb(steps[j].verb).group !== 'Prep') out.push(j);
      return out;
    };
    // Improve a split by moving single steps or whole pot-chains to the other chef.
    const climb = start => {
      let cur = start, best = cost(cur), improved = true, rounds = 0;
      while (improved && rounds++ < 20) {
        improved = false;
        for (let i = 0; i < n; i++) {
          for (const group of [[i], chain(i)]) {
            const movable = group.filter(j => !pinned[j]);
            if (!movable.length) continue;
            const to = cur[i] === 'A' ? 'B' : 'A';
            const trial = cur.slice();
            movable.forEach(j => trial[j] = to);
            const c = cost(trial);
            if (c < best) { best = c; cur = trial; improved = true; }
          }
        }
      }
      return { assign: cur, cost: best };
    };
    // Second starting guess: hand each step to whoever is free first, but keep a pot with
    // the chef already working it if that costs 3 minutes or less.
    const greedy = () => {
      const a = [], free = { A: 0, B: 0 }, end = [];
      const left = new Set(steps.map((_, i) => i));
      const at = (i, c) => Math.max(free[c], ...deps[i].map(d => end[d]));
      const ok = i => pinned[i] ? [pinned[i]] : ['A', 'B'];
      while (left.size) {
        let pick = -1, ps = Infinity;
        for (const i of left) {
          if (!deps[i].every(d => end[d] != null)) continue;
          const st = Math.min(...ok(i).map(c => at(i, c)));
          if (st < ps || (st === ps && tail[i] > tail[pick])) { pick = i; ps = st; }
        }
        if (pick < 0) break;
        let c = ok(pick).reduce((b, x) => at(pick, x) < at(pick, b) ? x : b);
        const own = parent[pick] != null && App.verb(steps[pick].verb).group !== 'Prep' ? a[parent[pick]] : null;
        if (own && own !== c && ok(pick).includes(own) && at(pick, own) <= at(pick, c) + 3) c = own;
        a[pick] = c;
        const s = at(pick, c);
        end[pick] = s + dur[pick]; free[c] = s + busy[pick];
        left.delete(pick);
      }
      return steps.map((_, i) => a[i] || 'A');
    };
    // Third guess: one prep cook, one stove cook.
    const prepVsStove = steps.map((st, i) => pinned[i] || (App.verb(st.verb).group === 'Prep' ? 'A' : 'B'));
    const tries = [climb(assign), climb(greedy()), climb(prepVsStove)];
    assign = tries.reduce((b, t) => t.cost < b.cost ? t : b).assign;
    // Whoever has the first step is Chef A.
    const st = simulate(assign).start;
    const first = steps.map((_, i) => i).sort((x, y) => st[x] - st[y] || x - y)[0];
    if (first != null && assign[first] === 'B' && !pinned.some(Boolean)) assign = assign.map(c => c === 'A' ? 'B' : 'A');
  }

  const { start, end, total } = simulate(assign);
  const byId = {};
  steps.forEach((s, i) => byId[s.id] = { chef: assign[i], start: start[i], end: end[i], passive: passive[i] });
  return { byId, total };
};

U.fmtMins = m => {
  m = Math.round(m);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' hr' + (r ? ' ' + r + ' min' : '');
};
U.HEAT = ['', 'Low', 'Medium', 'High'];

// ---------- Dates ----------
U.todayStr = () => U.dateStr(new Date());
U.dateStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
U.parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
U.fmtDate = s => U.parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
U.ago = s => {
  const days = Math.round((U.parseDate(U.todayStr()) - U.parseDate(s)) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return days + ' days ago';
  if (days < 60) return Math.round(days / 7) + ' wks ago';
  return Math.round(days / 30) + ' mo ago';
};
