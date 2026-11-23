// Helpers: formatting, units, ingredient parsing, aisles, and the recipe's total time.
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
  box: ['box', 'boxes'],
  jar: ['jar', 'jars'],
  bag: ['bag', 'bags'],
  bottle: ['bottle', 'bottles'],
  carton: ['carton', 'cartons'],
  splash: ['splash', 'splashes'],
  drizzle: ['drizzle'],
  sprinkle: ['sprinkle'],
  stalk: ['stalk', 'stalks', 'rib', 'ribs'],
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
const PLURAL = new Set(['cup', 'clove', 'can', 'jar', 'bag', 'bottle', 'carton', 'pinch', 'dash', 'bunch', 'package', 'slice', 'stick', 'head', 'sprig', 'handful', 'stalk', 'splash']);
U.fmtUnit = (unit, qty) => {
  if (!unit) return '';
  if (unit === 'box' && qty != null && qty > 1) return 'boxes';
  if (PLURAL.has(unit) && qty != null && qty > 1) return unit === 'pinch' || unit === 'dash' || unit === 'bunch' || unit === 'splash' ? unit + 'es' : unit + 's';
  return unit;
};
U.fmtAmount = (qty, unit) => {
  const q = U.fmtQty(qty);
  const u = U.fmtUnit(unit, qty);
  return [q, u].filter(Boolean).join(' ');
};

// Merge a list of {qty, unit} into display parts, converting where units are compatible.
// Amounts that are words, not numbers ("a splash of wine", "a pinch of salt").
U.WORD_AMOUNT = /^(?:a\s+)?(splash|pinch|dash|drizzle|handful|sprinkle|to taste)$/i;
const WORD_UNITS = new Set(['splash', 'pinch', 'dash', 'drizzle', 'handful', 'sprinkle']);
U.mergeAmounts = items => {
  const vol = [], wt = [], other = {};
  let noQty = false, toTaste = false;
  for (const it of items) {
    const u = U.normUnit(it.unit);
    if (u === 'to taste') { toTaste = true; continue; }
    // "a splash" with no number counts as one splash, so two recipes make "2 splashes"
    if (it.qty == null && WORD_UNITS.has(u)) { other[u] = (other[u] || 0) + 1; continue; }
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
  for (const [u, q] of Object.entries(other)) parts.push(WORD_UNITS.has(u) && q === 1 ? 'a ' + u : U.fmtAmount(q, u));
  if (toTaste && !parts.length) parts.push('to taste');
  if (!parts.length && noQty) return '';
  return parts.join(' + ');
};

// ---------- Ingredients ----------
// A keyword only counts at the start of a word: "sausage" must not match "sage", "goat cheese" not "oat".
U.ingIcon = name => {
  const n = String(name).toLowerCase();
  const at = k => { let i = n.indexOf(k); while (i > -1) { if (i === 0 || !/[a-zé]/.test(n[i - 1])) return true; i = n.indexOf(k, i + 1); } return false; };
  for (const [k, ico] of App.ING_ICONS) if (at(k)) return ico;
  // close enough: a word that's one letter off (two for long words) from a known ingredient
  for (const w of n.match(/[a-zé]{4,}/g) || [])
    for (const [k, ico] of App.ING_ICONS) if (!k.includes(' ') && k.length >= 4 && U.typos(w, k) <= (k.length >= 7 ? 2 : 1)) return ico;
  return null;
};
// How many letters you'd change to turn one word into the other (Levenshtein distance).
U.typos = (a, b) => {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};
// Icon names (js/icons.js); older saved data may still hold an emoji.
U.iconName = v => !v ? null : App.ICONS[v] ? v : App.EMOJI_ICONS[String(v).replace(/️/g, '')] || null;
U.ingIconHtml = ing => {
  const ico = U.iconName(ing.icon) || U.ingIcon(ing.name);
  if (ico) return `<span class="ing-ico">${App.icon(ico)}</span>`;
  return `<span class="ing-ico letter">${U.esc((ing.name || '?')[0].toUpperCase())}</span>`;
};

// ---------- Recipe icon & tags ----------
// The icon the app would pick: a dish word in the title, else a key ingredient.
U.suggestIcon = r => {
  const t = String(r.title || '').toLowerCase();
  for (const [k, ico] of App.DISH_ICONS) if (t.includes(k)) return ico;
  return U.ingIcon(t) || (r.ingredients?.[0] && U.ingIcon(r.ingredients[0].name)) || 'cloche';
};
// The icon you picked, else an old emoji, else the suggestion.
U.recipeIcon = r => U.iconName(r.icon) || U.iconName(r.emoji) || U.suggestIcon(r);
// Blob color behind the icon: the one you picked, else the icon's own main color.
// Only a plain #hex color is used (it goes into a style attribute).
U.recipeBlob = r => /^#[0-9a-f]{3,8}$/i.test(r.iconBg || '') ? r.iconBg : App.iconColor(U.recipeIcon(r));
U.recipeIconHtml = (r, cls = '') =>
  `<span class="r-ico ${cls}" style="--blob:${U.esc(U.recipeBlob(r))}">${App.icon(U.recipeIcon(r))}</span>`;
// A profile picture: one of the food icons in a round colored blob.
U.avatarHtml = (p, cls = '') =>
  `<span class="avatar ${cls}" style="--blob:${U.esc(p?.color || '#F9A27E')}">${App.icon(p?.avatar || 'cloche')}</span>`;
U.firstName = p => String(p?.name || '').split(' ')[0];
// Tags that get an icon: vegan (leaf) and Instant Pot (also spotted from a pressure-cook step or the title).
U.tagIcons = r => {
  const words = [r.title, ...(r.tags || [])].join(' ').toLowerCase();
  const out = [];
  if (/\bvegan\b/.test(words)) out.push({ icon: 'leaf', label: 'Vegan' });
  if (/instant ?pot|insta ?pot|pressure cook/.test(words) || (r.steps || []).some(s => s.verb === 'pressure')) out.push({ icon: 'ip', label: 'Instant Pot' });
  return out;
};
// The recipe's own ingredient that a typed name means: "chicken" → "Chicken breast", "onions" → "Yellow onion",
// "tyme" → "thyme". Exact names win; otherwise a whole-word match, then a near-miss spelling.
U.findIngredient = (list, name) => {
  const norm = s => String(s).toLowerCase().trim().replace(/\s+/g, ' ').split(' ').map(w => w.replace(/(es|s)$/, '')).join(' ');
  const n = norm(name);
  if (!n) return null;
  const words = s => new Set(s.split(' ').filter(w => w.length > 2));
  return list.find(g => norm(g.name) === n)
    || list.find(g => { const a = words(norm(g.name)), b = words(n); return a.size && b.size && ([...b].every(w => a.has(w)) || [...a].every(w => b.has(w))); })
    || (n.length >= 5 ? list.find(g => U.typos(norm(g.name), n) <= 1) : null)
    || (!n.includes(' ') && U.ingIcon(n) && ['cheese', 'noodle', 'herb', 'greens', 'oil', 'bean', 'jar'].includes(U.ingIcon(n)) ? list.find(g => U.ingIcon(g.name) === U.ingIcon(n)) : null)
    || null;
};

// ---------- Tidying a recipe (on Save) ----------
// What a careful cook would fix by hand, done for you every time you save:
//  • a note that says when/how the step goes ("until clear, then set aside") moves from the ingredient to
//    the step; notes about the ingredient itself ("medium", "diced") stay on the ingredient
//  • misspelled ingredient names get the usual spelling ("tyme" → thyme), and names are lowercase
//  • amounts use the tidiest unit (6 tsp → 2 tbsp, 8 tbsp → ½ cup); a note like "splash" becomes the amount
//  • the ingredient list follows the order the steps use them (unless you've put it in your own order)
U.STEP_CUE = /^(?:until|till|then|and then|set aside|remove|scrape|for \d|covered|uncovered|stirring|occasionally|over (?:low|medium|high)|on (?:low|medium|high)|in batches|in the (?:pot|pan)|to taste)\b/i;
U.splitCue = note => {
  const parts = String(note || '').split(/,\s*/).filter(Boolean);
  const i = parts.findIndex(p => U.STEP_CUE.test(p.trim()));
  if (i < 0) return { ing: note || undefined };
  return { ing: parts.slice(0, i).join(', ') || undefined, step: parts.slice(i).join(', ') };
};
// The usual way to write an ingredient: spelling fixed, and a cheese's name says "cheese".
U.canonName = name => {
  let n = U.fixSpelling(String(name).trim());
  if (/^(parmesan|parmigiano|pecorino|mozzarella|cheddar|feta|ricotta|gouda|swiss|provolone|goat|cream|cotija|gruyere|gruyère|monterey jack|pepper jack)$/i.test(n)) n += ' cheese';
  return n;
};
U.fixSpelling = name => {
  const dict = U._dict ||= new Set(App.ING_ICONS.flatMap(([k]) => k.split(' ')).filter(w => w.length >= 4));
  return String(name).replace(/[A-Za-zé]{4,}/g, w => {
    const l = w.toLowerCase();
    if (dict.has(l) || dict.has(l.replace(/(es|s)$/, ''))) return w;
    let best = null;
    for (const d of dict) { const t = U.typos(l, d); if (t <= (d.length >= 7 ? 2 : 1) && (!best || t < best[1])) best = [d, t]; }
    return best ? best[0] : w;
  });
};
U.tidyAmount = g => {
  if (g.qty == null) return;
  const whole = x => Math.abs(x - Math.round(x)) < .01;
  if (U.normUnit(g.unit) === 'tsp' && g.qty >= 3 && whole(g.qty / 3)) { g.qty = Math.round(g.qty / 3); g.unit = 'tbsp'; }
  if (U.normUnit(g.unit) === 'tbsp' && g.qty >= 4 && whole(g.qty / 4)) { g.qty = Math.round(g.qty / 4) / 4; g.unit = 'cup'; }
};
U.tidyRecipe = r => {
  for (const g of r.ingredients) {
    let n = U.canonName(g.name);
    if (/^[A-Z][a-z]/.test(n) && n.slice(1) === n.slice(1).toLowerCase()) n = n[0].toLowerCase() + n.slice(1);
    g.name = n;
    U.tidyAmount(g);
  }
  for (const s of r.steps) for (const u of s.uses || []) {
    if (!u.note) continue;
    // a note that is really an amount ("splash", "a pinch") becomes the amount, when there isn't one
    const g = r.ingredients.find(x => x.id === u.ing), amt = u.note.trim().match(/^(?:a\s+)?(splash|pinch|dash|drizzle|handful|sprinkle)$/i);
    if (amt && g && g.qty == null && !g.unit) { g.unit = amt[1].toLowerCase(); delete u.note; continue; }
    const { ing, step } = U.splitCue(u.note);
    u.note = ing;
    if (step && !(s.text || '').toLowerCase().includes(step.toLowerCase())) s.text = s.text ? s.text + ', ' + step : step;
    if (!u.note) delete u.note;
  }
  const first = new Map();
  r.steps.forEach((s, i) => (s.uses || []).forEach(u => { if (!first.has(u.ing)) first.set(u.ing, i); }));
  const order = g => g.group ? 1e6 : first.has(g.id) ? first.get(g.id) : 1e5;
  if (r.ingOrder !== 'mine') r.ingredients = r.ingredients.map((g, i) => [g, i]).sort((a, b) => order(a[0]) - order(b[0]) || a[1] - b[1]).map(x => x[0]);
  return r;
};

// Tags that clearly fit a recipe: what it's cooked in, how long it takes, what's in it, what it is.
U.fittingTags = r => {
  const out = [];
  const verbs = new Set((r.steps || []).map(s => App.verb(s.verb).id));
  if (verbs.has('pressure')) out.push('instant pot');
  if (r.steps?.length && U.schedule(r).total <= 30) out.push('quick');
  const icons = (r.ingredients || []).filter(g => !/\bvegan\b|plant|vegetable broth|coconut milk|almond milk|oat milk/i.test(g.name)).map(g => U.ingIcon(g.name));
  const meat = ['drum', 'steak', 'bacon', 'sausage', 'fish', 'shrimp'], animal = [...meat, 'milk', 'butter', 'cheese', 'egg', 'tub', 'honey'];
  if (r.ingredients?.length) {
    if (!icons.some(i => animal.includes(i)) && !/chicken|beef|pork|turkey|bouillon/i.test(r.ingredients.map(g => g.name).join(' '))) out.push('vegan');
    else if (!icons.some(i => meat.includes(i)) && !/chicken|beef|pork|turkey/i.test(r.ingredients.map(g => g.name).join(' '))) out.push('vegetarian');
  }
  const t = String(r.title || '').toLowerCase();
  for (const w of ['soup', 'stew', 'curry', 'salad', 'pasta', 'chili', 'dessert', 'breakfast', 'cookie', 'cake']) if (t.includes(w)) out.push(w);
  return [...new Set(out)];
};

// A recipe's link uses its name ("coconut-curry-over-rice") when no other recipe has the same name;
// otherwise its id. Old links by id keep working (see App.store.find).
U.recipeKey = r => {
  const slug = U.slug(r.title || '');
  const clash = !r.title || App.store.recipes().some(x => x !== r && x.id !== r.id && U.slug(x.title || '') === slug) || (App.store.recipe(slug) && App.store.recipe(slug).id !== r.id);
  return encodeURIComponent(clash ? r.id : slug);
};
U.recipeUrl = r => location.origin + location.pathname + '#/r/' + U.recipeKey(r);

// ---------- Mixtures ----------
// A step can say what it makes ("spice mix"): step.makes. A later step uses it like an ingredient —
// { from: stepId } in its uses — shown with a bowl and "from step 5", never on the shopping list.
U.mixtures = (r, beforeIndex = r.steps.length) => r.steps.slice(0, beforeIndex).filter(s => s.makes)
  .map(s => ({ id: s.id, name: s.makes, n: r.steps.indexOf(s) + 1 }));
U.findMixture = (r, beforeIndex, name) => {
  const n = String(name).toLowerCase().replace(/\bmixture\b/, 'mix').trim();
  return U.mixtures(r, beforeIndex).find(m => { const x = m.name.toLowerCase().replace(/\bmixture\b/, 'mix'); return x === n || x.includes(n) || n.includes(x); }) || null;
};
// Using a mixture means waiting for the step that makes it.
U.useMixture = (r, step, fromId) => {
  step.uses ||= [];
  if (!step.uses.some(u => u.from === fromId)) step.uses.push({ from: fromId });
  if (Array.isArray(step.after)) { if (!step.after.includes(fromId)) step.after.push(fromId); }
  else step.after = [...U.stepDeps(r, r.steps.indexOf(step)), fromId];
};

// Which aisle an ingredient is in. Whole words only ("eggplant" isn't "egg", "unsalted butter"
// isn't "salt"), the longest matching phrase wins ("fish sauce" over "fish"), and on a tie the
// last word wins, since that's the thing itself ("onion powder" is a powder, "chicken broth" is broth).
const catWord = w => /(?:ch|sh|ss|x|o)es$/.test(w) ? w.slice(0, -2) : /ies$/.test(w) ? w.slice(0, -3) + 'y' : /[^su]s$/.test(w) ? w.slice(0, -1) : w;
const catWords = s => (String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z]+/g) || []).map(catWord);
const SPICE_HERBS = new Set(['oregano', 'thyme', 'rosemary', 'sage', 'marjoram', 'tarragon', 'basil', 'dill', 'savory']);
const FRESH_HERBS = new Set(['cilantro', 'parsley', 'mint', 'chive', 'coriander']);
const FRESH_WORDS = new Set(['fresh', 'freshly', 'sprig', 'bunch', 'handful', 'leaf', 'leave', 'stem', 'stalk']);
U.category = ing => {
  if (ing.cat) return ing.cat;
  const words = catWords(ing.name);
  if (words.includes('frozen')) return 'frozen';
  if (U.normUnit(ing.unit) === 'can') return 'pantry';
  if (!U._catIndex) {
    U._catIndex = new Map();
    for (const [cat, list] of Object.entries(App.CAT_WORDS)) for (const p of list) U._catIndex.set(catWords(p).join(' '), cat);
  }
  let best = null;
  for (let len = Math.min(4, words.length); len >= 1 && !best; len--) {
    for (let i = words.length - len; i >= 0; i--) { // from the end, so the last word wins a tie
      const cat = U._catIndex.get(words.slice(i, i + len).join(' '));
      if (cat) { best = { cat, word: words[i + len - 1] }; break; }
    }
  }
  // Herbs: oregano, thyme, basil and the like mean the dried jar in the spice aisle unless the recipe
  // says fresh (or a sprig, bunch, handful or leaves). Cilantro, parsley, mint and chives are nearly
  // always bought fresh, so they stay in produce unless they say dried.
  // the herb has to be the thing itself ("dill", "thyme sprigs"), not a word in front of something else ("dill pickles")
  const herb = words.find((w, i) => (SPICE_HERBS.has(w) || (w === 'bay' && words[i + 1])) && (i === words.length - 1 || FRESH_WORDS.has(words[i + 1])));
  if (herb || (best && best.cat === 'produce' && words.some(w => FRESH_HERBS.has(w)))) {
    const all = [...words, ...catWords(ing.note || ''), ...catWords(ing.unit || '')];
    if (all.some(w => w === 'dried' || w === 'ground')) return 'spices';
    if (herb && herb !== 'bay' && all.some(w => FRESH_WORDS.has(w))) return 'produce';
    if (herb) return 'spices';
  }
  if (!best) return 'other';
  // dried or ground herbs and spices are in the spice aisle, not with the fresh ones
  if (best.cat === 'produce' && words.some(w => w === 'dried' || w === 'ground')) return 'spices';
  // a plain "pepper" measured by the spoon is black pepper; "2 peppers" are bell peppers
  if (best.word === 'pepper' && words.length === 1 && (!ing.qty || ['tsp', 'tbsp', 'pinch', 'dash'].includes(U.normUnit(ing.unit)))) return 'spices';
  return best.cat;
};

// "2 (15-ounce) cans black beans, drained" → {qty:2, unit:'can', name:'black beans', note:'15-ounce'}
// Also tidies what recipe sites add: prices ("$0.17"), metric repeats ("(450 g)"), "about 2 cups" asides,
// a container after a size ("15 oz. can" → 1 can, note "15 oz"), and how-to words after the name
// with no comma ("yellow onion chopped", "kosher salt plus more to taste").
const PRICE = /\s*\$\s*\d+(?:\.\d+)?\**/g;
const MEASURE_ASIDE = /^(?:about|approx\.?|approximately|roughly|~)?\s*[\d½¼¾⅓⅔⅛.\/\s-]+\s*(?:g|grams?|kg|ml|l|liters?|oz\.?|ounces?|lbs?\.?|pounds?|cups?|tablespoons?|teaspoons?|tbsp|tsp|inch(?:es)?)\b/i;
const NOTE_WORD = /^(?:(?:finely|roughly|coarsely|thinly|freshly|very|lightly)\s+)?(?:chopped|diced|minced|sliced|grated|shredded|peeled|cubed|crushed|halved|quartered|trimmed|seeded|deseeded|cored|pitted|julienned|drained|rinsed|softened|melted|beaten|torn|cooked|uncooked|toasted|cut|zested|juiced|smashed)$/i;
const NOTE_START = /^(?:optional|plus|divided|to taste|for serving|for garnish|to serve|at room temperature|room temperature|in (?:their|its) juices?|or more)\b/i;
const CONTAINER = /^(cans?|tins?|jars?|pots?|tubs?|cartons?|bottles?|bags?|packages?|packets?|packs?|pkgs?|boxe?s?)\s+(?=\S)/i;
U.parseIngredientLine = line => {
  let s = String(line).trim().replace(/^[-•*▢□]\s*/, '').replace(PRICE, '').replace(/\*+/g, '');
  if (!s) return null;
  let note = '';
  const addNote = (t, front) => { t = String(t).trim().replace(/^,|,$/g, '').trim(); if (t) note = !note ? t : front ? t + ', ' + note : note + ', ' + t; };
  s = s.replace(/\(([^)]*)\)/g, (m, inner) => {
    inner = inner.replace(PRICE, '').replace(/,\s*$/, '').trim();
    if (/^\d+$/.test(inner)) return inner; // "(2) cans" → "2 cans"
    // keep "15-ounce" can sizes; drop metric repeats, "about 2 cups" and "or more to taste"
    const parts = inner.split(/,\s*/).filter(x => x && !(MEASURE_ASIDE.test(x) && !/^\d+[- ](?:ounce|oz|inch)/i.test(x)) && !/^or\b/i.test(x));
    for (const x of parts) addNote(x);
    return ' ';
  }).replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
  const m = s.match(/^((?:\d+\s+)?\d+\/\d+|\d*\.?\d+(?:\s*[½⅓⅔¼¾⅛⅜⅝⅞])?|[½⅓⅔¼¾⅛⅜⅝⅞])(?:\s*(?:[-–]|to)\s*[\d./½¼¾]+)?\s*(.*)$/);
  let qty = null, rest = s;
  if (m) { qty = U.parseQty(m[1]); rest = m[2]; }
  // "2 large or 4 small cloves garlic" → 2 cloves, note "large"
  const either = rest.match(/^(large|small|medium|big)\s+or\s+[\d½¼¾⅓⅔]+\s+(?:large|small|medium|big)\s+/i);
  if (either) { addNote(either[1].toLowerCase()); rest = rest.slice(either[0].length); }
  // size words like "15-ounce" or "1-inch" before the unit
  const size = rest.match(/^(\d+[- ]?(?:ounce|oz|g|gram|inch)s?)\s+/i);
  if (size) { addNote(size[1], true); rest = rest.slice(size[0].length); }
  const sizeWord = rest.match(/^(large|small|medium|big)\s+(?=\S)/i);
  if (sizeWord && ALIAS[rest.slice(sizeWord[0].length).split(' ')[0].replace(/[.,]$/, '').toLowerCase()]) { addNote(sizeWord[1], true); rest = rest.slice(sizeWord[0].length); }
  let unit = '';
  const words = rest.split(' ');
  for (const len of [2, 1]) {
    const cand = words.slice(0, len).join(' ').replace(/[.,]$/, '');
    if (ALIAS[cand] || ALIAS[cand.toLowerCase()]) { unit = U.normUnit(cand); rest = words.slice(len).join(' '); break; }
  }
  // "15 oz. can tomatoes" is one 15-oz can; "500g pot yogurt" is 500 g of yogurt
  if (unit && (WT[unit] || VOL[unit]) && rest.match(CONTAINER)) {
    const c = rest.match(CONTAINER), kind = U.normUnit(c[1].replace(/e?s$/i, '').replace(/^tin$/i, 'can').replace(/^pkg$/i, 'package'));
    rest = rest.slice(c[0].length);
    if (ALIAS[kind] && kind !== unit) { addNote(`${U.fmtQty(qty)} ${unit}`, true); qty = 1; unit = kind; }
  }
  rest = rest.replace(/^of\s+/i, '').replace(/^(?:from|of)\s+(?:a|an|the)?\s*(?:(?:large|small|medium|big)\s+)?(?:loaf|loaves|bag|package|box|jar|can|head|bunch)\s+of\s+/i, '');
  // "chopped cilantro" → name "cilantro", note "chopped"
  const prep = rest.match(/^((?:finely |roughly |coarsely |thinly |freshly )?(?:chopped|diced|minced|sliced|grated|shredded|peeled|fresh|large|medium|small))\s+(?=\S)/i);
  if (prep && !/tomato/i.test(rest)) { addNote(prep[1], true); rest = rest.slice(prep[0].length); }
  const comma = rest.indexOf(',');
  if (comma > -1) { addNote(rest.slice(comma + 1)); rest = rest.slice(0, comma); }
  // how-to words after the name, without a comma: "yellow onion chopped", "garlic minced",
  // "sweet potatoes peeled and ¼-inch diced", "kosher salt plus more to taste", "cayenne optional"
  {
    const ws = rest.trim().split(' ');
    for (let i = 1; i < ws.length; i++) {
      const tail = ws.slice(i).join(' '), next = ws[i + 1];
      const nextOk = next === undefined || /^(?:(?:and|or|into|in|to|for|very|then|small|fine|finely|thinly|lengthwise|crosswise)$|[\d½¼¾⅓⅔])/i.test(next);
      const adv = /^(finely|roughly|coarsely|thinly|freshly|lightly)$/i.test(ws[i]) && NOTE_WORD.test(ws[i] + ' ' + (next || ''));
      if (NOTE_START.test(tail) || (NOTE_WORD.test(ws[i]) && nextOk) || adv) {
        addNote(tail.replace(/^plus\s+(?:more\s+|extra\s+)?/i, ''));
        rest = ws.slice(0, i).join(' ');
        break;
      }
    }
  }
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
  if (Array.isArray(s.after)) return s.after.filter(id => { const k = recipe.steps.findIndex(x => x.id === id); return k > -1 && k < i; });
  return i > 0 ? [recipe.steps[i - 1].id] : [];
};
// Minutes a step takes. Only timed steps (simmer 20 min, sauté 4 min) store a time and show it;
// everything else gets a rough estimate here so the total time is sensible.
U.stepTime = s => {
  if (s.time != null && s.time !== '') return +s.time;
  const v = App.verb(s.verb), n = Math.max(1, (s.uses || []).length);
  if (v.group === 'Prep') return (['rinse', 'drain', 'measure'].includes(v.id) ? 1 : 3) * n;
  if (v.id === 'preheat') return 10;
  if (v.passive) return v.group === 'Oven' ? 15 : 5;
  if (v.group === 'Stove') return 2;
  return 1;
};

// When each step happens for one cook, and the total time (minutes). Passive steps (simmer,
// bake...) only keep you busy for about a minute, so other steps can happen while they run.
// Returns { byId: {stepId: {start, end, passive}}, total }.
U.schedule = recipe => {
  const steps = recipe.steps || [];
  const idx = {}; steps.forEach((s, i) => idx[s.id] = i);
  const deps = steps.map((_, i) => U.stepDeps(recipe, i).map(id => idx[id]));
  const dur = steps.map(U.stepTime);
  const passive = steps.map(s => !!App.verb(s.verb).passive);
  const busy = steps.map((_, i) => passive[i] ? Math.min(1, dur[i]) : dur[i]);
  let free = 0;
  const start = [], end = [];
  const left = new Set(steps.map((_, i) => i));
  while (left.size) {
    let pick = -1, pickStart = Infinity;
    for (const i of left) {
      if (!deps[i].every(d => end[d] != null)) continue;
      const st = Math.max(free, ...deps[i].map(d => end[d]));
      if (st < pickStart) { pick = i; pickStart = st; }
    }
    if (pick < 0) break; // only if dependencies loop, which the editor prevents
    start[pick] = pickStart; end[pick] = pickStart + dur[pick];
    free = pickStart + busy[pick];
    left.delete(pick);
  }
  const byId = {};
  steps.forEach((s, i) => byId[s.id] = { start: start[i], end: end[i], passive: passive[i] });
  return { byId, total: Math.max(0, ...end.filter(x => x != null)) };
};

U.fmtMins = m => {
  m = Math.round(m);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' hr' + (r ? ' ' + r + ' min' : '');
};
// Short form for tight spots like recipe cards: 45m, 1h 14m.
U.fmtMinsShort = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? h + 'h' + (r ? ' ' + r + 'm' : '') : m + 'm'; };
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
