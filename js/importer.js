// Turns a recipe from a website (ingredient lines + instruction sentences) into this app's
// step format: one verb, the ingredients it uses, plus time / heat when the step is timed.
// Principles: few words, ONE knife step with prep as ingredient notes, back-to-back steps combined,
// no tips or "more" text. Rule-based, so the result opens in edit mode to check.
window.App = window.App || {};
App.importer = (() => {
  const U = App.util;

  // Words in instructions → verb ids from App.VERBS
  const SYN = {
    'sauté': 'saute', saute: 'saute', sautee: 'saute', cook: 'cook', fry: 'fry', brown: 'cook', sear: 'sear',
    heat: 'heat', boil: 'boil', bring: 'boil', simmer: 'simmer', steam: 'steam', melt: 'melt',
    preheat: 'preheat', bake: 'bake', roast: 'roast', broil: 'broil', grill: 'grill', toast: 'toast',
    add: 'add', pour: 'pour', place: 'add', put: 'add', transfer: 'pour', combine: 'mix', mix: 'mix', toss: 'mix',
    stir: 'stir', whisk: 'whisk', beat: 'whisk', fold: 'fold', blend: 'blend', puree: 'blend', 'purée': 'blend',
    mash: 'mash', knead: 'knead', season: 'season', sprinkle: 'season', marinate: 'marinate',
    drain: 'drain', rinse: 'rinse', chop: 'chop', dice: 'dice', mince: 'mince', slice: 'slice', cut: 'chop',
    grate: 'grate', shred: 'grate', peel: 'peel', rest: 'rest', chill: 'chill', refrigerate: 'chill', cool: 'cool',
    spread: 'spread', top: 'top', garnish: 'garnish', serve: 'serve',
  };
  const STOP = new Set(['fresh', 'large', 'medium', 'small', 'vegan', 'ground', 'dried', 'extra', 'virgin', 'kosher', 'sea', 'smoked', 'unsalted', 'salted', 'whole', 'raw', 'boneless', 'skinless', 'plain', 'light', 'dark', 'frozen', 'canned', 'low-sodium', 'of', 'mild', 'hot', 'sweet', 'extra-virgin', 'fire-roasted', 'yellow', 'white', 'freshly']);
  const GENERIC = new Set(['powder', 'sauce', 'paste', 'seed', 'seeds', 'leaf', 'leaves', 'juice', 'flakes', 'extract', 'mix', 'chips', 'zest']);

  const singular = w => /oes$/.test(w) ? w.slice(0, -2) : /ies$/.test(w) ? w.slice(0, -3) + 'y' : /[^s]s$/.test(w) ? w.slice(0, -1) : w;
  const singularPhrase = p => { const ws = p.split(' '); ws[ws.length - 1] = singular(ws[ws.length - 1]); return ws.join(' '); };
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  // ---------- Prep descriptors ----------
  // Knife / prep work never becomes its own sentence-step. It becomes a short note on the
  // ingredient ("peeled, 1" cubes") inside ONE combined knife step — whether the recipe wrote it
  // in the ingredient list ("1 onion, diced") or in the instructions ("Peel and dice the onion").
  const PREP_WORDS = {
    peel: 'peeled', core: 'cored', seed: 'seeds removed', deseed: 'seeds removed', halve: 'halved', quarter: 'quartered',
    trim: 'trimmed', stem: 'stemmed', pit: 'pitted', chop: 'chopped', dice: 'diced', mince: 'minced', slice: 'sliced',
    grate: 'grated', shred: 'grated', cube: 'cubed', julienne: 'julienned', cut: '',
  };
  const DESC_ORDER = ['peeled', 'trimmed', 'stemmed', 'cored', 'pitted', 'seeds removed', 'halved', 'quartered'];
  const CUT_VERB = { diced: 'dice', chopped: 'chop', minced: 'mince', sliced: 'slice', grated: 'grate', cubed: 'dice', julienned: 'slice', peeled: 'peel' };
  const isSize = s => /^(small|medium|large|big|extra[- ]large|jumbo)$/i.test(s.trim());
  const isPrepText = s => /\b(diced|chopped|minced|sliced|grated|shredded|peeled|cubed|seeded|cored|halved|quartered|trimmed|stemmed|pitted|julienned|cut into|seeds removed)\b/i.test(s);
  const isDrainText = s => /\b(drained|rinsed)\b/i.test(s);

  // "1-inch cubes", "½" pieces" → '1" cubes'
  const sizeDesc = text => {
    const m = text.match(/(\d+\s*\/\s*\d+|\d*\s*[½¼¾⅓⅔]|\d+(?:\.\d+)?)\s*-?\s*(?:inch(?:es)?|in\b\.?|")\s*(cubes?|pieces?|chunks?|dice|slices?|rounds?|strips?|thick)?/i);
    if (!m) return null;
    return `${m[1].replace(/\s+/g, '')}" ${(m[2] || 'pieces').toLowerCase()}`;
  };
  // Pull prep descriptors out of a phrase (ingredient note part or instruction clause).
  function prepDescs(text) {
    const t = text.toLowerCase();
    const out = new Set();
    const size = sizeDesc(t);
    for (const [w, past] of Object.entries(PREP_WORDS)) {
      if (!past) continue;
      if (new RegExp(`\\b(${w}s?|${w}d|${w}ed|${past})\\b`).test(t)) out.add(past);
    }
    if (/\b(scoop|remove|discard)\b[^.]*\bseeds?\b|\bseeded\b/.test(t)) out.add('seeds removed');
    if (/\bfinely\b/.test(t)) { for (const c of ['chopped', 'minced', 'diced']) if (out.has(c)) { out.delete(c); out.add('finely ' + c); } }
    if (/\bdiced small\b|\bsmall dice\b/.test(t) && out.has('diced')) { out.delete('diced'); out.add('diced small'); }
    if (size) { for (const d of ['cubed', 'chopped', 'diced', 'halved', 'quartered', 'trimmed']) out.delete(d); out.add(size); }
    return [...out].sort((a, b) => rank(a) - rank(b));
  }
  const rank = d => { const i = DESC_ORDER.indexOf(d); return i < 0 ? 100 + (/"/.test(d) ? 1 : 0) : i; };
  const drainDescs = text => {
    const t = text.toLowerCase();
    return [/\bdrained\b|\bdrain\b/.test(t) && 'drained', /\brinsed\b|\brinse\b/.test(t) && 'rinsed'].filter(Boolean);
  };

  // ---------- Ingredients ----------
  // Pick one option from "X or Y": "yellow or white onion" → "yellow onion",
  // "water or vegetable broth" → "water", "greek yogurt or sour cream" → "greek yogurt".
  function orName(name) {
    const m = name.match(/^(.+?)\s+or\s+(.+)$/);
    if (!m) return name;
    const left = m[1].trim(), right = m[2].trim();
    // keep the left option; borrow the noun from the right if the left one ends in a describing word
    if (U.ingIcon(left.split(' ').pop()) || !right.includes(' ')) return left;
    return left + ' ' + right.split(' ').pop();
  }

  function buildIngredients(lines) {
    return lines.map(line => {
      const p = U.parseIngredientLine(line);
      if (!p) return null;
      p.name = orName(p.name.replace(/\*/g, '').replace(/\s*\/.*$/, '').toLowerCase()).replace(/\s+(from|for)\s+.*$/i, '').trim();
      p._size = []; p._prep = []; p._drain = [];
      const keep = [];
      for (let part of (p.note || '').split(/,\s*/)) {
        part = part.replace(/\*/g, '').replace(/^and\s+/i, '').replace(/\s+or\s+.*$/i, '').trim();
        if (!part) continue;
        if (isSize(part)) p._size.push(part.toLowerCase());
        else if (isPrepText(part) || isDrainText(part)) {
          p._prep.push(...prepDescs(part));
          p._drain.push(...drainDescs(part));
        }
        else if (!/^(or|optional|plus|about|to taste|for serving|for garnish|garnish|divided)\b/i.test(part)) keep.push(part);
      }
      p.note = keep.join(', ') || undefined; // stays in the ingredient list (e.g. "15-ounce"), not in steps
      return p;
    }).filter(Boolean);
  }
  const addDescs = (ing, list) => {
    for (const d of list) if (!ing._prep.includes(d)) ing._prep.push(d);
    // once there's a final size ('1" chunks'), the in-between steps aren't worth saying
    if (ing._prep.some(d => d.includes('"'))) ing._prep = ing._prep.filter(d => !['cubed', 'chopped', 'diced', 'halved', 'quartered', 'trimmed'].includes(d));
    ing._prep.sort((a, b) => rank(a) - rank(b));
  };

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
      if (trimmed.includes(' ') && first.length >= 4 && !GENERIC.has(first) && !/^(diced|chopped|crushed|sliced|minced|grated|shredded|ground|whole|canned|cooked|vegetable|roasted|toasted|baby|green|red)$/.test(first) && !titleWords.has(first) && !titleWords.has(first + 's')) ks.add(first);
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
  function findVerb(text, skipPrep = false) {
    const cleaned = text.toLowerCase()
      .replace(/\b(low|medium|med|high|medium[- ]high|medium[- ]low)\s+heat\b/g, ' ')
      .replace(/\b(the|from|off|raise|reduce|lower|increase|up|down)\s+(?:the\s+)?heat\b/g, ' ')
      .replace(/\bsteam (?:to )?escape\b|\b(let|allow|release|vent) (?:the |some )?steam\b/g, ' ')
      .replace(/\bon top\b|\bthe rest\b|\bgolden brown\b|\bcut side\b/g, ' ');
    if (/\b(high|low) pressure\b|\bpressure[- ]cook(?!er)/.test(cleaned)) return 'pressure';
    const words = cleaned.match(/[a-zé]+/g) || [];
    for (const w of words) if (SYN[w] && !(skipPrep && App.verb(SYN[w]).group === 'Prep')) return SYN[w];
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
      let phrase = until[1].trim().replace(/^(the|it|they)\s+(?:[a-z]+\s+){0,2}?(is|are|has|have|looks?|becomes?)\s+/i, '').replace(/^(starting|beginning|just starting) to\s+(\w+)/i, (m, a, v) => v.replace(/e$/, '') + 'ed').replace(/^(begins?|starts?) to\s+(\w+)/i, (m, a, v) => v.replace(/e$/, '') + 'ed');
      let words = phrase.split(/\s+/).slice(0, 4);
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
  // Sentences that are tips, options or storage advice — not cooking steps.
  const SKIP = /^(if\b|it will|it takes|this will|when the cook time|quick release|natural(ly)? release|lock the lid|seal|optional|note|tip|store|storage|leftover|to store|make[- ]ahead|to make ahead|you can|feel free|for best|enjoy|reheat|freeze|nutrition|this recipe|recipe)/i;
  const PREP_START = /^(peel|core|seed|deseed|halve|quarter|trim|stem|pit|cube|scoop|remove|cut|chop|dice|mince|slice|grate|shred|julienne|drain|rinse|wash|pat)\b/i;

  function convert(data) {
    data = { ...data, steps: (data.steps || []).filter(p => !/^(storage|notes?|tips?|make[- ]ahead|leftovers?|recipe notes?|to store|freezing)\b/i.test(p.trim())) };
    const ings = buildIngredients(data.ingredients || []);
    const keys = buildKeys(ings, data.name);
    const byId = Object.fromEntries(ings.map(i => [i.id, i]));
    // Cheese is usually bought grated, canned things come ready — neither is knife work.
    const knifeOk = i => !(U.category(i) === 'dairy' && i._prep.every(d => d === 'grated')) && U.normUnit(i.unit) !== 'can';

    // 1) Read the instructions. Prep sentences only add notes to ingredients; everything else
    //    becomes a step with one action, its ingredients, and a short note / time / heat.
    const instr = [];
    let lastPrep = [];
    for (const { text, parallel } of clauses(data.steps || [])) {
      if (SKIP.test(text)) continue;
      const uses = findIngs(text, keys);
      const verb = findVerb(text);
      const first = (text.match(/^[a-z]+/i) || [''])[0].toLowerCase();
      const seen = id => instr.some(st => st.uses.some(u => u.ing === id));
      let prepish = PREP_START.test(text) || !!(verb && App.verb(verb).group === 'Prep');
      // "Drain the beans" before using them is a note; "drain the pasta" after cooking is a step.
      if (['drain', 'rinse', 'wash'].includes(first) || ['drain', 'rinse'].includes(verb)) prepish = uses.length > 0 && !uses.some(seen);
      // "Remove from heat" isn't prep; "remove the seeds" is.
      if (['remove', 'discard'].includes(first) && !/\b(seeds?|stems?|skin|core|pits?|peel)\b/i.test(text)) prepish = false;
      if (prepish) {
        const targets = uses.length ? uses : lastPrep;
        const descs = prepDescs(text), drains = drainDescs(text);
        for (const id of targets) { addDescs(byId[id], descs); for (const d of drains) if (!byId[id]._drain.includes(d)) byId[id]._drain.push(d); }
        lastPrep = targets;
        // "Dice the onion and add it to the pot" also has a cooking action — keep going with that.
        const cook = findVerb(text.replace(PREP_START, ''), true);
        if (!cook) continue;
      } else lastPrep = [];

      const v0 = prepish ? findVerb(text.replace(PREP_START, ''), true) : verb;
      const time = findTime(text), heat = findHeat(text), temp = findTemp(text);
      const last = instr[instr.length - 1];
      // Clauses that add nothing new ("Stir to combine", "cook until soft") fold into the step before.
      const filler = !v0 || (['stir', 'mix', 'cook'].includes(v0) && last && uses.every(id => last.uses.some(u => u.ing === id)) && (!time || !last.time));
      if (filler) {
        if (last) {
          if (!last.time && time) last.time = time;
          if (!last.text) last.text = findShort(text);
          if (!last.heat && heat) last.heat = heat;
        }
        continue;
      }
      let v = v0;
      const allFat = uses.length && uses.every(id => /\b(oil|butter|ghee)\b/.test(byId[id].name));
      if ((v === 'add' || v === 'pour') && allFat && heat) v = 'heat';
      if ((v === 'add' || v === 'stir') && uses.length && uses.every(id => U.category(byId[id]) === 'spices' && !/oil/.test(byId[id].name))) v = 'season';
      const vd = App.verb(v);
      instr.push({
        id: U.uid('s'), verb: v, uses: uses.map(ing => ({ ing })),
        text: findShort(text) || (uses.length ? undefined : objectOf(text, v0)),
        parallel, time: time || undefined, heat, temp: vd.group === 'Oven' ? temp : undefined,
      });
    }

    // 2) Combine back-to-back steps with the same action ("Season: salt" + "Season: pepper").
    for (let k = instr.length - 1; k > 0; k--) {
      const a = instr[k - 1], b = instr[k];
      // a timed step, or one that goes "until …", is its own stage
      if (a.verb !== b.verb || b.parallel || App.verb(a.verb).passive || a.time || b.time || /until/.test((a.text || '') + (b.text || ''))) continue;
      for (const u of b.uses) if (!a.uses.some(x => x.ing === u.ing)) a.uses.push(u);
      a.text = [...new Set([a.text, b.text].filter(Boolean))].join(', ') || undefined;
      a.time = a.time || b.time; a.heat = a.heat || b.heat;
      instr.splice(k, 1);
    }

    // 3) Toppings: ingredients first used when serving, or listed after everything the steps use.
    const firstUse = {};
    instr.forEach((s, i) => s.uses.forEach(u => { if (firstUse[u.ing] == null) firstUse[u.ing] = i; }));
    const toppingIds = new Set(ings.filter(i => firstUse[i.id] != null && ['serve', 'top', 'garnish'].includes(instr[firstUse[i.id]].verb)).map(i => i.id));
    const lastUsed = Math.max(-1, ...ings.map((i, k) => firstUse[i.id] != null ? k : -1));
    ings.forEach((i, k) => { if (lastUsed >= 0 && k > lastUsed && firstUse[i.id] == null) toppingIds.add(i.id); });
    ings.forEach(i => { if (toppingIds.has(i.id)) i.group = 'Toppings'; });
    const ordered = [...ings.filter(i => !toppingIds.has(i.id)), ...ings.filter(i => toppingIds.has(i.id))];

    // 4) ONE knife step for everything that needs prep. The action is the shared cut if they all
    //    match (all diced → "Dice"), otherwise "Chop"; each ingredient's note says how.
    const knife = ordered.filter(i => i._prep.length && knifeOk(i));
    let knifeStep = null;
    if (knife.length) {
      const cutOf = i => CUT_VERB[i._prep.find(d => CUT_VERB[d] && d !== 'peeled') || (i._prep.includes('peeled') ? 'peeled' : '')] || null;
      const cuts = [...new Set(knife.map(cutOf))];
      const verb = cuts.length === 1 && cuts[0] ? cuts[0] : 'chop';
      const bare = Object.keys(CUT_VERB).filter(d => CUT_VERB[d] === verb && d !== 'julienned');
      knifeStep = {
        id: U.uid('s'), verb, after: [],
        uses: knife.map(i => {
          const note = [...i._size, ...i._prep.filter(d => !bare.includes(d))].join(', ');
          return note ? { ing: i.id, note } : { ing: i.id };
        }),
      };
    }
    // Everyone else gets their size / drained note on the first step that uses them.
    const noted = new Set(knifeStep ? knifeStep.uses.map(u => u.ing) : []);
    for (const s of instr) for (const u of s.uses) {
      const g = byId[u.ing];
      if (noted.has(g.id)) continue;
      noted.add(g.id);
      const note = [...g._size, ...(knifeOk(g) ? [] : g._prep.filter(d => d !== 'grated')), ...g._drain].join(', ');
      if (note) u.note = note;
    }

    // 5) Dependencies: each step follows the one before it, plus the knife step if it needs it.
    let chainPrev = null, preheat = null;
    const touch = {}; // stepId → ingredients it (or the step it continues) handled
    for (const s of instr) {
      const after = [];
      if (s.verb === 'preheat') { s.after = []; preheat = s.id; delete s.parallel; continue; }
      if (chainPrev && !s.parallel) after.push(chainPrev);
      // Also wait for the last earlier step that used any of the same ingredients (e.g. the drained pasta).
      const before = instr.slice(0, instr.indexOf(s));
      for (const u of s.uses) {
        const prev = [...before].reverse().find(p => touch[p.id]?.has(u.ing));
        if (prev && !after.includes(prev.id)) after.push(prev.id);
      }
      touch[s.id] = s.uses.length ? new Set(s.uses.map(u => u.ing)) : new Set(s.parallel ? [] : touch[chainPrev] || []);
      if (preheat && ['bake', 'roast', 'broil'].includes(s.verb)) after.push(preheat);
      if (knifeStep && s.uses.some(u => knifeStep.uses.some(k => k.ing === u.ing))) after.push(knifeStep.id);
      s.after = after;
      delete s.parallel;
      chainPrev = s.id;
    }

    // 6) A "serve with toppings" step lists the toppings.
    const serve = instr.find(s => ['serve', 'top', 'garnish'].includes(s.verb));
    if (serve && !serve.uses.length && toppingIds.size) {
      serve.uses = [...toppingIds].map(ing => ({ ing }));
      serve.text = /toppings/.test(serve.text || '') ? undefined : serve.text;
      if (knifeStep && !serve.after.includes(knifeStep.id)) serve.after.push(knifeStep.id);
    }

    const steps = [knifeStep, ...instr].filter(Boolean);
    steps.forEach(s => Object.keys(s).forEach(k => s[k] === undefined && delete s[k]));
    return {
      title: data.name || 'Imported recipe',
      emoji: guessEmoji(data.name || '', ordered),
      servings: data.servings || 4,
      source: data.source || '',
      tags: [],
      ingredients: ordered.map(({ _size, _prep, _drain, ...rest }) => rest),
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
