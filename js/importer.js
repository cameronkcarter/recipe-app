// Turns a recipe from a website (ingredient lines + instruction sentences) into this app's
// step format: one verb, the ingredients it uses, plus time / heat when the step is timed.
// It's rule-based, so it gets close but not perfect — the result opens in the editor to check.
window.App = window.App || {};
App.importer = (() => {
  const U = App.util;

  // Words in instructions → verb ids from App.VERBS
  const SYN = {
    'sauté': 'saute', saute: 'saute', sautee: 'saute', cook: 'cook', fry: 'fry', brown: 'cook', sear: 'sear',
    heat: 'heat', boil: 'boil', bring: 'boil', simmer: 'simmer', pressure: 'pressure', steam: 'steam', melt: 'melt',
    preheat: 'preheat', bake: 'bake', roast: 'roast', broil: 'broil', grill: 'grill', toast: 'toast',
    add: 'add', pour: 'pour', place: 'add', put: 'add', transfer: 'pour', combine: 'mix', mix: 'mix', toss: 'mix',
    stir: 'stir', whisk: 'whisk', beat: 'whisk', fold: 'fold', blend: 'blend', puree: 'blend', 'purée': 'blend',
    mash: 'mash', knead: 'knead', season: 'season', sprinkle: 'season', marinate: 'marinate',
    drain: 'drain', rinse: 'rinse', chop: 'chop', dice: 'dice', mince: 'mince', slice: 'slice', cut: 'chop',
    grate: 'grate', shred: 'grate', peel: 'peel', rest: 'rest', chill: 'chill', refrigerate: 'chill', cool: 'cool',
    spread: 'spread', top: 'top', garnish: 'garnish', serve: 'serve',
  };
  // Prep words found on ingredient lines ("1 onion, diced") → verb
  const PREP = { diced: 'dice', chopped: 'chop', minced: 'mince', sliced: 'slice', grated: 'grate', shredded: 'grate', peeled: 'peel', cubed: 'dice' };
  const CUT_ORDER = ['dice', 'chop', 'mince', 'slice', 'grate', 'peel'];
  const STOP = new Set(['fresh', 'large', 'medium', 'small', 'vegan', 'ground', 'dried', 'extra', 'virgin', 'kosher', 'sea', 'smoked', 'unsalted', 'salted', 'whole', 'raw', 'boneless', 'skinless', 'plain', 'light', 'dark', 'frozen', 'canned', 'low-sodium', 'of', 'mild', 'hot', 'sweet', 'extra-virgin', 'fire-roasted', 'yellow', 'white', 'freshly']);
  const GENERIC = new Set(['powder', 'sauce', 'paste', 'seed', 'seeds', 'leaf', 'leaves', 'juice', 'flakes', 'extract', 'mix', 'chips', 'zest']);

  const singular = w => /oes$/.test(w) ? w.slice(0, -2) : /ies$/.test(w) ? w.slice(0, -3) + 'y' : /[^s]s$/.test(w) ? w.slice(0, -1) : w;
  const singularPhrase = p => { const ws = p.split(' '); ws[ws.length - 1] = singular(ws[ws.length - 1]); return ws.join(' '); };
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  // ---------- Ingredients ----------
  function buildIngredients(lines) {
    return lines.map(line => {
      const p = U.parseIngredientLine(line);
      if (!p) return null;
      p.name = p.name.replace(/\*/g, '').replace(/\s+or\s+[a-z]+(?=\s+[a-z])/i, '').replace(/\s*\/.*$/, '').replace(/\s+(or|from|for)\s+.*$/i, '').trim().toLowerCase();
      // Split the note into "how to prep it" (→ prep step) and everything else (stays on the ingredient)
      const parts = (p.note || '').split(/,\s*/).filter(Boolean);
      const prepParts = [], keep = [];
      for (const part of parts) {
        if (/\b(diced|chopped|minced|sliced|grated|shredded|peeled|cubed|drained|rinsed)\b/i.test(part)) prepParts.push(part.toLowerCase().replace(/\s+or\s+.*$/, '').replace(/\*/g, '').trim());
        else if (!/^or\b/i.test(part)) keep.push(part);
      }
      // "chopped cilantro" — the parser moved "chopped" into the note already
      p.note = keep.join(', ') || undefined;
      const prepText = prepParts.join(', ');
      p._prep = Object.entries(PREP).filter(([w]) => new RegExp('\\b' + w + '\\b').test(prepText)).map(([, v]) => v);
      p._prepText = prepText;
      p._rinse = /\brinsed\b/.test(prepText) || (/\bdrained\b/.test(prepText) && /bean|chickpea|lentil|corn/.test(p.name));
      p._drained = /\bdrained\b/.test(prepText);
      return p;
    }).filter(Boolean);
  }

  // Words that identify each ingredient inside an instruction sentence.
  function buildKeys(ings, title = '') {
    const titleWords = new Set(title.toLowerCase().match(/[a-z]+/g) || []);
    const keysOf = ings.map(ing => {
      const name = ing.name.toLowerCase();
      const ks = new Set([singularPhrase(name)]);
      const trimmed = name.split(' ').filter(w => !STOP.has(w)).join(' ');
      if (trimmed) ks.add(singularPhrase(trimmed));
      const last = singular(name.split(' ').pop());
      if (last.length >= 3 && !GENERIC.has(last)) ks.add(last);
      const first = singular(trimmed.split(' ')[0] || '');
      if (trimmed.includes(' ') && first.length >= 4 && !GENERIC.has(first) && !titleWords.has(first) && !titleWords.has(first + 's')) ks.add(first);
      return ks;
    });
    // A short key shared by several ingredients ("onion" → yellow onion and pickled onions) goes to the
    // one listed first — main ingredients come before toppings in almost every recipe.
    const owner = {};
    keysOf.forEach((ks, i) => ks.forEach(k => { if (owner[k] == null) owner[k] = i; }));
    const list = [];
    // Plural "the beans" means kidney AND pinto when they're listed next to each other.
    const sharers = {};
    keysOf.forEach((ks, i) => ks.forEach(k => (sharers[k] ||= []).push(i)));
    keysOf.forEach((ks, i) => ks.forEach(k => {
      if (owner[k] !== i && k !== singularPhrase(ings[i].name)) return;
      const group = [i];
      for (const j of sharers[k]) if (j === group[group.length - 1] + 1) group.push(j);
      list.push({ k, id: ings[i].id, plural: group.slice(1).map(j => ings[j].id) });
    }));
    return list.sort((a, b) => b.k.length - a.k.length);
  }

  function findIngs(text, keys) {
    // A plain "pepper" ("salt and pepper", "a few grinds of pepper") means black pepper, not bell pepper.
    const hasBlack = keys.some(x => x.k === 'black pepper');
    let t = ' ' + text.toLowerCase().replace(/(?<!\b(?:bell|red|green|yellow|orange|black|chipotle|jalapeño|serrano|poblano|chili|cayenne|sweet|hot)\s)\bpepper\b(?!s)/g, hasBlack ? 'black pepper' : ' ') + ' ';
    const found = [];
    for (const { k, id, plural } of keys) {
      const re = new RegExp('\\b' + reEsc(k) + '(e?s)?\\b');
      const m = t.match(re);
      if (!m) continue;
      if (!found.some(f => f.id === id)) found.push({ id, at: m.index });
      if (m[1] && plural) plural.forEach((pid, n) => { if (!found.some(f => f.id === pid)) found.push({ id: pid, at: m.index + 0.1 * (n + 1) }); });
      t = t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length);
    }
    return found.sort((a, b) => a.at - b.at).map(f => f.id);
  }

  // ---------- Instruction sentences ----------
  function findVerb(text) {
    const cleaned = text.toLowerCase()
      .replace(/\b(low|medium|med|high|medium[- ]high|medium[- ]low)\s+heat\b/g, ' ')
      .replace(/\b(the|from|off|raise|reduce|lower|increase|up|down)\s+(?:the\s+)?heat\b/g, ' ')
      .replace(/\bsteam (?:to )?escape\b|\blet (?:the )?steam\b/g, ' ')
      .replace(/\bon top\b|\bthe rest\b|\bgolden brown\b|\bcut side\b/g, ' ');
    const words = cleaned.match(/[a-zé]+/g) || [];
    for (const w of words) if (SYN[w]) return SYN[w];
    return null;
  }
  const findTime = text => {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:[-–]|to)?\s*(?:\d+)?\s*(?:more\s+)?(minutes?|mins?|hours?|hrs?)\b/i);
    if (!m) return null;
    return Math.round(+m[1] * (/^h/i.test(m[2]) ? 60 : 1));
  };
  const findHeat = text => {
    const m = text.toLowerCase().match(/\b(medium[- ]high|medium[- ]low|low|medium|med|high)\s+heat\b/);
    if (!m) return undefined;
    return /medium[- ]high|^high/.test(m[1]) ? 3 : /medium[- ]low|^low/.test(m[1]) ? 1 : 2;
  };
  const findTemp = text => { const m = text.match(/(\d{3})\s*°?\s*(F|C)\b|(\d{3})\s*degrees/i); return m ? `${m[1] || m[3]}°${(m[2] || 'F').toUpperCase()}` : undefined; };
  const findShort = text => {
    const bits = [];
    if (/\buncovered\b/i.test(text)) bits.push('uncovered');
    else if (/\bcovered\b|\bcover\b/i.test(text)) bits.push('covered');
    const until = text.match(/\buntil ([^,.;–—(]+)/i);
    if (until) {
      // keep it short: "until no longer pink in the center" → "until no longer pink"
      let words = until[1].trim().split(/\s+/).slice(0, 4);
      const cut = words.findIndex((w, k) => k > 0 && /^(in|about|or|and|on|at|to)$/i.test(w));
      if (cut > 0) words = words.slice(0, cut);
      while (words.length > 1 && /^(the|a|an|of|is|are)$/i.test(words[words.length - 1])) words.pop();
      bits.push('until ' + words.join(' '));
    }
    return bits.join(', ') || undefined;
  };

  // For steps with no ingredients: a few words after the verb, e.g. "bring a large pot of salted
  // water to a boil" → "large pot of salted water".
  function objectOf(text, verbId) {
    const words = text.replace(/[.,;:!()"]/g, ' ').split(/\s+/).filter(Boolean);
    const at = words.findIndex(w => SYN[w.toLowerCase()] === verbId);
    if (at < 0) return undefined;
    const out = [];
    for (const w of words.slice(at + 1)) {
      if (/^(to|for|until|over|on|in|into|with|and|then|about|at|from)$/i.test(w)) { if (out.length) break; else continue; }
      if (/^(the|a|an|it|them)$/i.test(w) && !out.length) continue;
      out.push(w.toLowerCase());
      if (out.length >= 5) break;
    }
    return out.join(' ') || undefined;
  }

  function clauses(steps) {
    const out = [];
    for (const s of steps) {
      for (const sentence of s.split(/(?<=[.!?])\s+(?=[A-Z(])/)) {
        for (const c of sentence.split(/,?\s+(?:and\s+)?then\s+|;\s+/i)) {
          // "Meanwhile, melt the butter" happens alongside the previous steps, not after them.
          const parallel = /^(meanwhile|while\b|at the same time)/i.test(c.trim());
          const t = c.trim().replace(/^(next|then|finally|meanwhile|at the same time),?\s+/i, '');
          if (t) out.push({ text: t, parallel });
        }
      }
    }
    return out;
  }

  // ---------- Convert ----------
  function convert(data) {
    const ings = buildIngredients(data.ingredients || []);
    const keys = buildKeys(ings, data.name);
    const byId = Object.fromEntries(ings.map(i => [i.id, i]));
    // Cheese is usually bought grated/shredded, so that isn't a prep job.
    const cutIds = new Set(ings.filter(i => U.category(i) !== 'dairy' && U.normUnit(i.unit) !== 'can' && (i._prep.some(v => v !== 'peel') || (i._prep.length && !i._rinse))).map(i => i.id));

    // 1) Instruction steps
    const instr = [];
    for (const { text, parallel } of clauses(data.steps || [])) {
      const verb = findVerb(text);
      let uses = findIngs(text, keys);
      const time = findTime(text), heat = findHeat(text), temp = findTemp(text);
      const last = instr[instr.length - 1];
      const sentence = cap(text.replace(/\s+/g, ' ').replace(/\.?$/, '.'));
      // Fold clauses that add nothing new ("Stir to combine.") into the previous step's details.
      const filler = !verb || (['stir', 'mix', 'cook'].includes(verb) && last && uses.every(id => last.uses.some(u => u.ing === id)) && (!time || (!last.time && App.verb(last.verb).group !== 'Prep')));
      // Skip "Dice the onion" style sentences when the ingredient list already says "diced".
      const dupPrep = verb && App.verb(verb).group === 'Prep' && uses.length && uses.every(id => cutIds.has(id) || byId[id]._rinse);
      if ((filler || dupPrep) && last) {
        last.detail = (last.detail ? last.detail + ' ' : '') + sentence;
        if (!last.time && time && App.verb(last.verb).group !== 'Prep') last.time = time;
        if (!last.text) last.text = findShort(text);
        if (!last.heat && heat) last.heat = heat;
        continue;
      }
      if (!verb) continue;
      let v = verb;
      const allFat = uses.length && uses.every(id => /\b(oil|butter|ghee)\b/.test(byId[id].name));
      if ((v === 'add' || v === 'pour') && allFat && heat) v = 'heat';
      if ((v === 'add' || v === 'stir') && uses.length && uses.every(id => U.category(byId[id]) === 'spices' && !/oil/.test(byId[id].name))) v = 'season';
      const vd = App.verb(v);
      instr.push({
        id: U.uid('s'), verb: v, uses: uses.map(ing => ({ ing })),
        text: findShort(text) || (uses.length ? undefined : objectOf(text, verb)),
        parallel,
        time: time && vd.group !== 'Prep' ? time : undefined,
        heat, temp: vd.group === 'Oven' ? temp : undefined,
        detail: sentence,
      });
    }

    // 2) Toppings: ingredients that first show up in a serve / top / garnish step
    const firstUse = {};
    instr.forEach((s, i) => s.uses.forEach(u => { if (firstUse[u.ing] == null) firstUse[u.ing] = i; }));
    const toppingIds = new Set(ings.filter(i => firstUse[i.id] != null && ['serve', 'top', 'garnish'].includes(instr[firstUse[i.id]].verb)).map(i => i.id));
    const lastUsed = Math.max(-1, ...ings.map((i, k) => firstUse[i.id] != null ? k : -1));
    ings.forEach((i, k) => { if (lastUsed >= 0 && k > lastUsed && firstUse[i.id] == null) toppingIds.add(i.id); });
    ings.forEach(i => { if (toppingIds.has(i.id)) i.group = 'Toppings'; });

    // 3) Prep steps built from the ingredient list ("diced", "minced", "drained and rinsed")
    const prepStep = list => {
      if (!list.length) return null;
      const tally = {};
      list.forEach(i => i._prep.filter(v => v !== 'peel').forEach(v => tally[v] = (tally[v] || 0) + 1));
      const verb = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || CUT_ORDER.indexOf(a) - CUT_ORDER.indexOf(b))[0] || 'chop';
      const past = Object.keys(PREP).find(w => PREP[w] === verb);
      return {
        id: U.uid('s'), verb, after: [],
        uses: list.map(i => {
          const note = i._prepText.split(/,\s*/).map(x => x.replace(new RegExp('\\b' + past + '\\b'), '').replace(/\b(drained|rinsed)\b/g, '').replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ');
          return note ? { ing: i.id, note } : { ing: i.id };
        }),
      };
    };
    const cutMain = ings.filter(i => cutIds.has(i.id) && !toppingIds.has(i.id));
    const cutTop = ings.filter(i => cutIds.has(i.id) && toppingIds.has(i.id));
    const rinse = ings.filter(i => i._rinse);
    const mainPrep = prepStep(cutMain);
    const topPrep = prepStep(cutTop);
    if (topPrep) topPrep.text = 'toppings';
    const rinseStep = rinse.length ? { id: U.uid('s'), verb: 'rinse', after: [], uses: rinse.map(i => i._drained ? { ing: i.id, note: 'drained' } : { ing: i.id }) } : null;

    // 4) Dependencies: each instruction step follows the one before it, plus any prep it needs.
    let chainPrev = null, preheat = null;
    const touch = {}; // stepId → ingredients it (or the step it continues) handled
    for (const s of instr) {
      const after = [];
      if (s.verb === 'preheat') { s.after = []; preheat = s.id; continue; }
      if (chainPrev && !s.parallel) after.push(chainPrev);
      // Also wait for the last earlier step that used any of the same ingredients (e.g. the drained pasta).
      // Steps with no ingredients ("drain") carry on with whatever the step before them had.
      const before = instr.slice(0, instr.indexOf(s));
      for (const u of s.uses) {
        const prev = [...before].reverse().find(p => touch[p.id]?.has(u.ing));
        if (prev && !after.includes(prev.id)) after.push(prev.id);
      }
      touch[s.id] = s.uses.length ? new Set(s.uses.map(u => u.ing)) : new Set(s.parallel ? [] : touch[chainPrev] || []);
      if (preheat && ['bake', 'roast', 'broil'].includes(s.verb)) after.push(preheat);
      const used = new Set(s.uses.map(u => u.ing));
      for (const p of [mainPrep, rinseStep, topPrep]) if (p && p.uses.some(u => used.has(u.ing))) after.push(p.id);
      s.after = after;
      delete s.parallel;
      chainPrev = s.id;
    }

    // 5) Order: prep first, toppings prep just before the first step that uses toppings.
    const steps = [mainPrep, rinseStep].filter(Boolean);
    let topAt = instr.findIndex(s => s.uses.some(u => toppingIds.has(u.ing)));
    if (topAt < 0) topAt = instr.findIndex(s => ['serve', 'top', 'garnish'].includes(s.verb));
    const serve = instr[topAt];
    if (serve && ['serve', 'top', 'garnish'].includes(serve.verb) && !serve.uses.length && toppingIds.size) {
      serve.uses = [...toppingIds].map(ing => ({ ing }));
      if (/toppings/.test(serve.text || '')) serve.text = 'top with';
      if (topPrep) serve.after.push(topPrep.id);
    }
    instr.forEach((s, i) => { if (i === topAt && topPrep) steps.push(topPrep); steps.push(s); });
    if (topPrep && topAt < 0) steps.push(topPrep);

    // Tidy ingredients: toppings at the end, drop helper fields.
    const ordered = [...ings.filter(i => !toppingIds.has(i.id)), ...ings.filter(i => toppingIds.has(i.id))]
      .map(({ _prep, _prepText, _rinse, _drained, ...rest }) => rest);
    steps.forEach(s => Object.keys(s).forEach(k => s[k] === undefined && delete s[k]));

    return {
      title: data.name || 'Imported recipe',
      emoji: guessEmoji(data.name || '', ordered),
      servings: data.servings || 4,
      source: data.source || '',
      tags: [],
      ingredients: ordered,
      steps,
      notes: [],
    };
  }

  const DISH = [['soup', '🍲'], ['stew', '🍲'], ['chili', '🌶️'], ['curry', '🍛'], ['salad', '🥗'], ['pasta', '🍝'], ['spaghetti', '🍝'], ['noodle', '🍜'], ['ramen', '🍜'],
    ['pizza', '🍕'], ['taco', '🌮'], ['burrito', '🌯'], ['burger', '🍔'], ['sandwich', '🥪'], ['cake', '🍰'], ['cookie', '🍪'], ['brownie', '🍫'], ['pie', '🥧'],
    ['bread', '🍞'], ['muffin', '🧁'], ['pancake', '🥞'], ['waffle', '🧇'], ['rice', '🍚'], ['egg', '🍳'], ['chicken', '🍗'], ['salmon', '🐟'], ['shrimp', '🍤'], ['smoothie', '🥤']];
  function guessEmoji(title, ings) {
    const t = title.toLowerCase();
    for (const [k, e] of DISH) if (t.includes(k)) return e;
    return U.ingIcon(t) || (ings[0] && U.ingIcon(ings[0].name)) || '🍽️';
  }

  // ---------- Reading a web page ----------
  const decode = s => {
    const el = document.createElement('textarea');
    el.innerHTML = String(s ?? '').replace(/<[^>]+>/g, ' ');
    return el.value.replace(/\s+/g, ' ').trim();
  };
  function findRecipe(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
    const type = node['@type'];
    if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return node;
    return findRecipe(node['@graph']) || findRecipe(node.mainEntity) || null;
  }
  // Instructions come as strings, HowToStep objects, or HowToSection groups — flatten to strings.
  function flattenSteps(ins) {
    if (!ins) return [];
    if (typeof ins === 'string') return ins.split(/\n+|(?<=\.)\s+(?=\d+\.\s)/).map(decode).filter(Boolean);
    if (Array.isArray(ins)) return ins.flatMap(flattenSteps);
    if (ins.itemListElement) return flattenSteps(ins.itemListElement);
    return [decode(ins.text || ins.name || '')].filter(Boolean);
  }
  // Most recipe sites embed the recipe as structured data (schema.org "Recipe" JSON-LD).
  function recipeFromHtml(html, url) {
    for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
      let r = null;
      try { r = findRecipe(JSON.parse(m[1].trim())); } catch (e) { /* skip broken blocks */ }
      if (r) return normalize(r, url);
    }
    return null;
  }
  function normalize(r, url) {
    const yieldVal = [].concat(r.recipeYield || []).map(String).find(y => /\d/.test(y));
    return {
      name: decode(r.name),
      servings: yieldVal ? parseInt(yieldVal.match(/\d+/)[0], 10) : null,
      ingredients: [].concat(r.recipeIngredient || r.ingredients || []).map(decode).filter(Boolean),
      steps: flattenSteps(r.recipeInstructions),
      source: url,
    };
  }

  const isLocal = () => /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname);
  const READER = 'https://r.jina.ai/';
  const blocked = html => /<title>(just a moment|attention required|access denied)/i.test(html) || /performing security verification/i.test(html);

  // Tries, in order: this computer's server (when running locally), a public page reader
  // returning the page, then the same reader returning plain text for the paste converter.
  async function fromUrl(url) {
    url = url.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(url)) throw new Error('That doesn’t look like a web link.');
    if (/^https?:\/\/[^/]+\/?$/.test(url)) throw new Error('That’s a whole website. Open one recipe and copy its link.');

    if (location.protocol !== 'file:' && isLocal()) {
      try {
        const res = await fetch('api/page?url=' + encodeURIComponent(url));
        const data = await res.json();
        const found = data.html && recipeFromHtml(data.html, url);
        if (found && found.ingredients.length) return convert(found);
      } catch (e) { /* fall through to the reader */ }
    }

    try {
      const res = await fetch(READER + url, { headers: { 'X-Return-Format': 'html' } });
      if (res.ok) {
        const html = await res.text();
        const found = !blocked(html) && recipeFromHtml(html, url);
        if (found && found.ingredients.length) return convert(found);
      }
    } catch (e) { /* try plain text */ }

    try {
      const res = await fetch(READER + url);
      if (res.ok) {
        const md = await res.text();
        if (!blocked(md)) {
          const title = (md.match(/^Title:\s*(.+)$/m) || [])[1];
          const r = fromText(md.replace(/^(Title|URL Source|Published Time|Markdown Content):.*$/gm, ''), { title, source: url });
          if (r.ingredients.length >= 2 && r.steps.length) return r;
        }
      }
    } catch (e) { /* give up below */ }

    throw new Error('That site blocks importing. Copy the recipe and use “Paste recipe text”.');
  }

  // Pasted recipe text (copied from a page, or from a photo with the phone's "copy text").
  // Uses "Ingredients" / "Instructions" headings when present, otherwise guesses line by line.
  function fromText(text, meta = {}) {
    let lines = text.split(/\r?\n/)
      .map(l => l
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // markdown images
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')         // markdown links → text
        .replace(/^#+\s*/, '').replace(/[*_]{2,}/g, '')  // headings, bold
        .replace(/^\s*(?:[-•*▢□✓]|\d+[.)])\s+(?=\D)/, '')
        .trim())
      .filter(Boolean);
    const isIngHead = l => /^ingredients?\s*:?$/i.test(l);
    const isStepHead = l => /^(instructions?|directions?|method|steps?|preparation|how to make it)\s*:?$/i.test(l);
    // A full web page mentions "Ingredients" more than once — use the last heading that's
    // followed by an Instructions heading (that's the recipe card).
    let start = -1;
    lines.forEach((l, i) => { if (isIngHead(l) && lines.slice(i + 1).some(isStepHead)) start = i; });
    if (start > 0) lines = lines.slice(start);
    const looksIng = l => /^([\d½¼¾⅓⅔⅛]|a pinch|pinch)/i.test(l) && l.length < 90;
    let title = meta.title || '', servings = null, mode = null;
    const ingredients = [], steps = [];
    lines.forEach((l, i) => {
      const serv = l.match(/(?:serves|servings|yield)\s*:?\s*(\d+)/i);
      if (serv && l.length < 40) { servings = +serv[1]; return; }
      if (isIngHead(l)) { mode = 'ing'; return; }
      if (isStepHead(l)) { mode = 'step'; return; }
      if (/^(notes?|nutrition|video|equipment)\b/i.test(l)) { mode = 'skip'; return; }
      if (/^for the\b/i.test(l) || mode === 'skip') return;
      if (!title && i === 0 && !looksIng(l) && l.length < 80) { title = l; return; }
      if (mode === 'ing' || (!mode && looksIng(l))) ingredients.push(l);
      else if (mode === 'step' || l.split(' ').length > 4) steps.push(l);
    });
    if (!ingredients.length && !steps.length) throw new Error('Couldn’t find ingredients or steps in that text.');
    return convert({ name: title || 'Pasted recipe', servings, ingredients, steps, source: meta.source || '' });
  }

  return { convert, fromUrl, fromText };
})();
