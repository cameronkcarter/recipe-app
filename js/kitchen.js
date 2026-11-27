// Kitchen know-how for Sue, all from small tables in the app (no outside service):
// unit conversions (tap any amount), a measurement cheat sheet, cups ↔ grams for common baking
// ingredients, °F ↔ °C, vegan swaps (and "Make a vegan copy"), gluten-free swaps, and
// "Out of it?" stand-ins. Tap an ingredient on a recipe to see what applies to it.
window.App = window.App || {};
App.kitchen = {};
(() => {
  const U = () => App.util;
  const K = App.kitchen;

  // ---------- conversions ----------
  // kitchen (US label) measures: 1 cup = 240 ml, 1 tbsp = 15 ml, 1 tsp = 5 ml
  const ML = { tsp: 5, tbsp: 15, cup: 240, 'fl oz': 30, ml: 1, l: 1000, pint: 480, quart: 960, gallon: 3840 };
  const G = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
  // grams in one cup, for the usual baking and pantry ingredients (first match wins)
  const PER_CUP = [
    [/almond flour/, 96], [/powdered sugar|icing sugar|confectioner/, 120], [/brown sugar/, 213], [/\bflour\b/, 120],
    [/\bsugar\b/, 200], [/\bbutter\b(?! ?milk)/, 227], [/rolled oats|\boats\b/, 90], [/cocoa/, 85], [/chocolate chips/, 170],
    [/\brice\b/, 190], [/honey/, 340], [/maple syrup/, 322], [/\boil\b/, 218],
  ];
  K.perCup = name => { const n = String(name || '').toLowerCase(); for (const [re, g] of PER_CUP) if (re.test(n)) return g; return null; };

  // A number as a kitchen amount: "⅓", "1½"; marks it "about" when the fraction is a rough fit.
  const nice = q => {
    const s = U().fmtQty(q);
    const back = U().parseQty?.(s.replace(/(\d)([½⅓⅔¼¾⅛⅜⅝⅞])/, '$1 $2')) ?? q;
    return Math.abs(back - q) / q > .06 ? `about ${s}` : s;
  };
  const roundTo = (x, step) => Math.round(x / step) * step;
  const metric = (x, unit) => unit === 'ml' ? (x >= 1000 ? `${+(x / 1000).toFixed(2)} l` : `${x < 20 ? +roundTo(x, .5).toFixed(1) : roundTo(x, 5)} ml`)
    : (x >= 1000 ? `${+(x / 1000).toFixed(2)} kg` : `${x < 20 ? Math.round(x) : roundTo(x, 5)} g`);

  // Other ways to say an amount: ["1 tbsp", "15 ml"]. qty is already scaled to the servings shown.
  K.convert = (qty, unit, name) => {
    const u = U().normUnit(unit), out = [];
    if (qty == null || !(qty > 0)) return out;
    const perCup = K.perCup(name);
    let ml = null, g = null;
    if (ML[u]) ml = qty * ML[u];
    else if (G[u]) g = qty * G[u];
    else if (u === 'stick' && /butter/i.test(name || '')) { ml = qty * ML.cup / 2; g = qty * 113; }
    if (ml != null) {
      const tsp = ml / ML.tsp, tbsp = ml / ML.tbsp, cup = ml / ML.cup;
      if (u !== 'tsp' && tsp <= 12) out.push(`${nice(tsp)} tsp`);
      if (u !== 'tbsp' && tbsp >= 1 && tbsp <= 16) out.push(`${nice(tbsp)} tbsp`);
      if (u !== 'cup' && cup >= .125) out.push(`${nice(cup)} ${U().fmtUnit('cup', cup)}`);
      if (u !== 'ml' && u !== 'l') out.push(metric(ml, 'ml'));
      if (perCup && g == null) g = cup * perCup;
    } else if (g != null) {
      if (u !== 'g' && u !== 'kg') out.push(metric(g, 'g'));
      if (u !== 'oz' && g < 1000) { const oz = g / G.oz; out.push(oz >= 4 ? `${+roundTo(oz, .5).toFixed(1)} oz` : `${nice(oz)} oz`); }
      if (u !== 'lb' && g >= 225) out.push(`${nice(g / G.lb)} lb`);
      if (perCup) { const cup = g / perCup; if (cup >= .125) out.push(`${nice(cup)} ${U().fmtUnit('cup', cup)}`); }
      g = null;
    }
    if (g != null) out.push(metric(g, 'g'));
    return out;
  };
  // "400°F" → "200°C" (to the nearest 5); "180°C" → "355°F".
  K.convertTemp = t => {
    const m = String(t || '').match(/(\d{2,3})\s*°?\s*([FC])\b/i);
    if (!m) return '';
    const n = +m[1];
    return m[2].toUpperCase() === 'F' ? `${roundTo((n - 32) * 5 / 9, 5)}°C` : `${roundTo(n * 9 / 5 + 32, 5)}°F`;
  };

  K.cheatSheet = [
    ['3 tsp', '1 tbsp'], ['4 tbsp', '¼ cup'], ['16 tbsp', '1 cup'], ['1 cup', '240 ml'], ['1 tbsp', '15 ml'],
    ['1 stick butter', '½ cup · 113 g'], ['1 cup flour', '120 g'], ['1 cup sugar', '200 g'], ['1 oz', '28 g'], ['1 lb', '454 g'],
    ['350°F', '175°C'], ['400°F', '200°C'], ['425°F', '220°C'],
  ];

  // ---------- swaps ----------
  // match: ingredient name; skip: names that look like a match but aren't (already swapped, or different).
  // to/ratio/note: what "Make a vegan copy" changes the ingredient to.
  const VEGAN = [
    { match: /\b(butter)\b(?! ?milk)/, skip: /vegan|peanut|almond|nut butter|apple butter|cocoa butter/, text: 'Vegan butter, same amount. For cooking, olive oil works too (use ¾ as much).', to: 'vegan butter' },
    { match: /buttermilk/, text: 'Plant milk plus 1 tbsp lemon juice per cup. Let it sit 5 min.', to: 'oat milk', note: '+ 1 tbsp lemon juice per cup' },
    { match: /heavy cream|whipping cream|\bcream\b(?! cheese)/, skip: /coconut|cashew|vegan|sour|ice cream/, text: 'Full-fat coconut milk or cashew cream, same amount.', to: 'full-fat coconut milk' },
    { match: /sour cream/, skip: /vegan/, text: 'Plain vegan yogurt or cashew cream, same amount.', to: 'plain vegan yogurt' },
    { match: /cream cheese/, skip: /vegan/, text: 'Vegan cream cheese, same amount.', to: 'vegan cream cheese' },
    { match: /\byogh?urt\b/, skip: /vegan|soy|coconut|oat|almond/, text: 'Plain soy or coconut yogurt, same amount.', to: 'plain soy yogurt' },
    { match: /parmesan|pecorino/, skip: /vegan/, text: 'Nutritional yeast (about half as much) or vegan parmesan.', to: 'nutritional yeast', ratio: .5 },
    { match: /\bcheese\b|cheddar|mozzarella|feta|ricotta|gruy/, skip: /vegan|cream cheese/, text: 'Vegan cheese, same amount.', to: n => 'vegan ' + n },
    { match: /\bmilk\b/, skip: /coconut|almond|oat|soy|rice milk|cashew|plant|vegan|buttermilk|condensed/, text: 'Oat or soy milk, same amount.', to: 'oat milk' },
    { match: /\beggs?\b/, skip: /eggplant|vegan|flax/, text: 'Flax egg: 1 tbsp ground flax + 3 tbsp water per egg, rest 5 min. Best in baking.', to: 'flax eggs', note: '1 tbsp ground flax + 3 tbsp water each' },
    { match: /honey/, text: 'Maple syrup or agave, same amount.', to: 'maple syrup' },
    { match: /(chicken|beef|bone) (stock|broth|bouillon)/, text: 'Vegetable broth or bouillon, same amount.', to: n => n.replace(/chicken|beef|bone/, 'vegetable') },
    { match: /ground (beef|turkey|pork|chicken)|\bmince\b/, text: 'Cooked lentils or crumbled tempeh, same amount.', to: 'cooked lentils' },
    { match: /\bchicken\b|\bbeef\b|\bpork\b|\bsteak\b|\bbacon\b|\bsausage\b|\bturkey\b|\bham\b/, skip: /vegan|stock|broth|bouillon/, text: 'Extra-firm tofu, chickpeas or seitan. Press tofu first.', to: 'extra-firm tofu', note: 'pressed' },
    { match: /\bshrimp\b|\bfish\b(?! sauce)|salmon|\btuna\b/, skip: /vegan/, text: 'Firm tofu or hearts of palm.', to: 'firm tofu' },
    { match: /fish sauce/, skip: /vegan/, text: 'Soy sauce with a squeeze of lime, same amount.', to: 'soy sauce', note: '+ squeeze of lime' },
    { match: /worcestershire/, skip: /vegan/, text: 'Vegan Worcestershire (regular has anchovies).', to: 'vegan worcestershire sauce' },
    { match: /mayo/, skip: /vegan/, text: 'Vegan mayo, same amount.', to: 'vegan mayo' },
    { match: /gelatin/, text: 'Agar powder: 1 tsp per 1 tbsp gelatin.', to: 'agar powder', ratio: 1 / 3 },
    { match: /\bghee\b|\blard\b/, text: 'Coconut oil or vegan butter, same amount.', to: 'coconut oil' },
  ];
  const GF = [
    { match: /\bflour\b/, skip: /almond|rice flour|gluten|coconut flour|oat flour|chickpea|corn ?starch/, text: '1:1 gluten-free flour blend, same amount.' },
    { match: /soy sauce/, skip: /tamari|gluten/, text: 'Tamari or coconut aminos, same amount.' },
    { match: /pasta|spaghetti|penne|ziti|noodle|macaroni|fettuccine|linguine/, skip: /rice noodle|gluten|zucchini/, text: 'Gluten-free pasta. Cook a minute less and stir often.' },
    { match: /bread|bun|tortilla|panko|breadcrumb|naan|pita|crouton/, skip: /gluten|corn tortilla/, text: 'Gluten-free version, same amount. Corn tortillas for tortillas.' },
    { match: /couscous|bulgur|barley|farro/, text: 'Quinoa or rice, cooked the same way.' },
  ];
  const OUT = [
    { match: /buttermilk/, text: '1 cup milk + 1 tbsp lemon juice or vinegar. Let it sit 5 min.' },
    { match: /brown sugar/, text: '1 cup white sugar + 1 tbsp molasses, or just white sugar.' },
    { match: /baking powder/, text: 'Per 1 tsp: ¼ tsp baking soda + ½ tsp cream of tartar.' },
    { match: /self.rising flour/, text: 'Per cup: 1 cup flour + 1½ tsp baking powder + ¼ tsp salt.' },
    { match: /cake flour/, text: 'Per cup: 1 cup flour minus 2 tbsp, plus 2 tbsp cornstarch.' },
    { match: /corn ?starch/, text: '2 tbsp flour for each 1 tbsp cornstarch (for thickening).' },
    { match: /heavy cream|whipping cream/, text: 'Per cup: ¾ cup milk + ¼ cup melted butter (won\'t whip).' },
    { match: /sour cream/, text: 'Plain Greek yogurt, same amount.' },
    { match: /greek yogh?urt/, text: 'Sour cream, same amount.' },
    { match: /\beggs?\b/, skip: /eggplant/, text: 'In baking: ¼ cup applesauce or a flax egg per egg.' },
    { match: /shallot/, text: 'Onion, about the same amount.' },
    { match: /\bonions?\b/, skip: /green onion|powder|spring onion/, text: '1 tsp onion powder per onion.' },
    { match: /garlic/, skip: /powder/, text: '⅛ tsp garlic powder per clove.' },
    { match: /ginger/, skip: /ground/, text: '¼ tsp ground ginger per 1 tbsp fresh.' },
    { match: /lemon juice/, text: 'Lime juice, same amount, or half as much vinegar.' },
    { match: /lime juice/, text: 'Lemon juice, same amount.' },
    { match: /white wine/, skip: /vinegar/, text: 'Same amount of broth + 1 tsp white wine vinegar.' },
    { match: /red wine/, skip: /vinegar/, text: 'Same amount of broth + 1 tsp red wine vinegar.' },
    { match: /rice vinegar/, text: 'Apple cider vinegar, same amount.' },
    { match: /soy sauce/, text: 'Tamari or coconut aminos, same amount.' },
    { match: /tomato paste/, text: '3 tbsp tomato sauce per 1 tbsp paste, cooked down.' },
    { match: /red pepper flakes|chili flakes|crushed red pepper/, text: 'Cayenne, about half as much.' },
    { match: /honey/, text: 'Maple syrup, same amount.' },
    { match: /maple syrup/, text: 'Honey, same amount.' },
    { match: /coconut oil/, text: 'Any neutral oil, same amount.' },
    { match: /\bmilk\b/, skip: /coconut|buttermilk/, text: 'Half water, half cream or yogurt. Or any plant milk.' },
    { match: /fresh (basil|parsley|cilantro|thyme|oregano|rosemary|dill|mint|sage|tarragon|chives)/, text: 'Dried, about ⅓ as much.' },
    { match: /^(basil|parsley|cilantro|thyme|oregano|rosemary|dill|mint|sage|tarragon|chives)$/, text: 'Swap fresh and dried: dried is about 3 times as strong.' },
    { match: /dried (basil|parsley|thyme|oregano|rosemary|dill|mint|sage|tarragon)/, text: 'Fresh, about 3 times as much.' },
  ];
  const find = (list, name) => {
    const n = String(name || '').toLowerCase();
    return list.find(x => x.match.test(n) && !(x.skip && x.skip.test(n))) || null;
  };
  K.vegan = name => find(VEGAN, name);
  K.glutenFree = name => find(GF, name);
  K.outOf = name => find(OUT, name);

  // ---------- the ingredient sheet (tap an ingredient) ----------
  K.ingredientHtml = (ing, scale = 1, qtyOverride) => {
    const u = U();
    const qty = qtyOverride !== undefined ? qtyOverride : ing.qty == null ? null : ing.qty * scale;
    const unit = u.normUnit(ing.unit);
    const amt = qty != null || unit ? u.fmtAmount(qty, unit) : '';
    const conv = K.convert(qty, unit, ing.name);
    const vg = K.vegan(ing.name), gf = K.glutenFree(ing.name), out = K.outOf(ing.name);
    const row = (label, text) => `<div class="kn-row"><span class="kn-lab">${label}</span><span>${text}</span></div>`;
    const rows = [
      conv.length ? row('Same as', conv.map(u.esc).join(' · ')) : '',
      out ? row('Out of it', out.text) : '',
      vg ? row('Vegan', vg.text) : '',
      gf ? row('Gluten-free', gf.text) : '',
    ].filter(Boolean).join('');
    return `<div class="kn-pop"><div class="kn-head">${u.ingIconHtml(ing)}<span>${amt ? `<b>${u.esc(amt)}</b> ` : ''}${u.esc(ing.name)}</span></div>
      ${rows || '<div class="kn-row muted">No conversions or swaps for this one.</div>'}</div>`;
  };

  K.tempHtml = t => {
    const c = K.convertTemp(t), u = U();
    return `<div class="kn-pop"><div class="kn-head"><span class="ing-ico">${App.icon('thermo')}</span><span><b>${u.esc(t)}</b></span></div>
      ${c ? `<div class="kn-row"><span class="kn-lab">Same as</span><span>${c}</span></div>` : '<div class="kn-row muted">No conversion for this one.</div>'}</div>`;
  };
  // Tap (or Enter on) anything marked with data-kn-* to open its little sheet. Works with Sue off too.
  const open = el => {
    if (/^#\/edit\//.test(location.hash) || el.closest('.edit')) return;
    const d = el.dataset;
    const html = d.knTemp != null ? K.tempHtml(d.knTemp)
      : K.ingredientHtml({ name: d.knName, icon: d.knIco || undefined, unit: d.knU || '' }, 1, d.knQ != null ? +d.knQ : null);
    App.ui.popover(el, html, () => {});
  };
  document.addEventListener('click', e => { const el = e.target.closest('[data-kn-name],[data-kn-temp]'); if (el) open(el); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest?.('[data-kn-name],[data-kn-temp]');
    if (el && el === e.target) { e.preventDefault(); open(el); }
  });

  // ---------- vegan copy ----------
  const isVegan = r => App.util.tagIcons(r).some(t => t.icon === 'leaf');
  K.veganPlan = r => (r.ingredients || []).map(g => ({ g, s: K.vegan(g.name) })).filter(x => x.s);
  K.makeVeganCopy = r => {
    const copy = JSON.parse(JSON.stringify(r));
    for (const g of copy.ingredients) {
      const s = K.vegan(g.name);
      if (!s) continue;
      const was = g.name;
      g.name = typeof s.to === 'function' ? s.to(was) : s.to;
      if (s.ratio && g.qty != null) g.qty = +(g.qty * s.ratio).toFixed(3);
      if (s.note) g.note = [g.note, s.note].filter(Boolean).join(', ');
    }
    delete copy.id; delete copy.photo; delete copy.addedAt;
    copy.title = `${r.title} (vegan)`;
    copy.tags = [...new Set([...(r.tags || []).filter(t => !/^(vegetarian)$/i.test(t)), 'vegan'])];
    copy.author = App.store.me()?.id;
    copy.veganOf = r.id;
    return App.store.addRecipe(copy);
  };

  // ---------- Sue's panel sections ----------
  App.sue.section('out', r => {
    const u = App.util, list = (r.ingredients || []).map(g => ({ g, o: K.outOf(g.name) })).filter(x => x.o).slice(0, 6);
    if (!list.length) return null;
    return { title: 'Out of something?',
      html: `<ul class="sue-list swaps">${list.map(({ g, o }) => `<li>${u.ingIconHtml(g)}<span><b>${u.esc(g.name)}</b><small>${o.text}</small></span></li>`).join('')}</ul>` };
  });
  App.sue.section('vegan', r => {
    if (isVegan(r)) return null;
    const plan = K.veganPlan(r);
    if (!plan.length) return null;
    const u = App.util;
    return { title: 'Make it vegan',
      html: `<ul class="sue-list swaps">${plan.map(({ g, s }) => `<li>${u.ingIconHtml(g)}<span><b>${u.esc(g.name)}</b><small>${s.text}</small></span></li>`).join('')}</ul>
        <button class="btn block kn-vegan" data-kn="vegan-copy">${App.icon('leaf')}Make a vegan copy</button>
        <p class="muted sue-none small">Saves a second recipe with these swaps. This one stays as it is.</p>` };
  });
  App.sue.onClick('vegan', (e, r, ctx) => {
    if (!e.target.closest('[data-kn=vegan-copy]')) return false;
    if (App.needLogin()) return true;
    const id = K.makeVeganCopy(r);
    ctx.close();
    location.hash = '#/r/' + encodeURIComponent(id);
    App.ui.toast('Vegan copy saved', () => { App.store.deleteRecipe(id); location.hash = '#/r/' + encodeURIComponent(r.id); });
    return true;
  });
  App.sue.section('measure', () => ({ title: 'Measurements',
    html: `<p class="muted sue-none">Tap any amount or ingredient on a recipe to convert it.</p>
      <div class="kn-sheet">${K.cheatSheet.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>` }));
})();
