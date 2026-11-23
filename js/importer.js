// Turns a recipe from a website (ingredient lines + instruction sentences) into this app's
// step format: one verb, the ingredients it uses, plus time / heat when the step is timed.
// tests/import.js checks it on recipes written in the styles real sites use.
// Principles: few words, ONE knife step with prep as ingredient notes, back-to-back steps combined,
// no tips or "more" text. Rule-based, so the result opens in edit mode to check.
window.App = window.App || {};
App.importer = (() => {
  const U = App.util;

  // Words in instructions → verb ids from App.VERBS
  const SYN = {
    'sauté': 'saute', saute: 'saute', sautee: 'saute', cook: 'cook', fry: 'saute', brown: 'saute', sear: 'saute',
    heat: 'heat', boil: 'boil', bring: 'boil', simmer: 'simmer', steam: 'boil', melt: 'heat', deglaze: 'deglaze',
    preheat: 'preheat', bake: 'bake', roast: 'bake', broil: 'broil', grill: 'grill', toast: 'bake',
    add: 'add', pour: 'add', place: 'add', put: 'add', transfer: 'add', combine: 'mix', mix: 'mix', toss: 'mix',
    stir: 'mix', whisk: 'mix', beat: 'mix', fold: 'mix', blend: 'blend', puree: 'blend', 'purée': 'blend',
    mash: 'mash', knead: 'knead', season: 'season', sprinkle: 'season', marinate: 'marinate',
    drain: 'drain', rinse: 'rinse', chop: 'chop', dice: 'chop', mince: 'chop', slice: 'chop', cut: 'chop',
    grate: 'grate', shred: 'shred', peel: 'chop', rest: 'rest', chill: 'chill', refrigerate: 'chill', cool: 'rest',
    spread: 'top', top: 'top', garnish: 'top', serve: 'serve',
    drizzle: 'add', pulse: 'blend', blitz: 'blend', process: 'blend', float: 'top', layer: 'top', sit: 'rest', stand: 'rest',
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
  const CUT_VERB = { diced: 'chop', chopped: 'chop', minced: 'chop', sliced: 'chop', grated: 'grate', cubed: 'chop', julienned: 'chop', peeled: 'chop' };
  const isSize = s => /^(small|medium|large|extra[- ]large|jumbo)$/i.test(s.trim());
  const isPrepText = s => /\b(diced|chopped|minced|sliced|grated|shredded|peeled|cubed|seeded|cored|halved|quartered|trimmed|stemmed|pitted|julienned|cut into|cut \w+ into|seeds removed)\b/i.test(s);
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
    // "cut into large chunks" → "large chunks"
    const into = t.match(/\bcut (?:\w+ )?into ((?:large |small |thin |thick |bite[- ]size(?:d)? |big )?(?:wedges|chunks|strips|rings|pieces|cubes|halves|quarters|florets|matchsticks|rounds|slices))\b/);
    if (into) { out.delete('cubed'); out.delete('sliced'); out.delete('quartered'); out.add(into[1]); }
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
  // Pick one option from "X or Y" and keep the other as a note: "yellow or white onion" → "yellow onion",
  // "chicken or vegetable stock" → "chicken stock", "water or vegetable broth" → "water".
  const OR_HEAD = /^(stock|broth|oil|vinegar|cheese|sugar|flour|beans?|milk|wine|onions?|peppers?|potato(?:es)?|rice|pasta|yogurt|cream|butter|juice|tomato(?:es)?)$/;
  function orName(name) {
    const m = name.match(/^(.+?)\s+or\s+(.+)$/);
    if (!m) return { name };
    const left = m[1].trim(), right = m[2].trim(), rw = right.split(' ');
    if (!left.includes(' ') && rw.length > 1 && OR_HEAD.test(rw[rw.length - 1]) && left !== 'water') return { name: left + ' ' + rw.slice(1).join(' '), alt: right };
    // keep the left option; borrow the noun from the right if the left one ends in a describing word
    if (U.ingIcon(left.split(' ').pop()) || rw.length === 1) return { name: left, alt: right };
    return { name: left + ' ' + rw[rw.length - 1], alt: right };
  }

  function buildIngredients(lines) {
    return lines.map(line => {
      const p = U.parseIngredientLine(line);
      if (!p) return null;
      const or = orName(p.name.replace(/\*/g, '').replace(/\s+or\s+[\d½¼¾⅓⅔].*$/i, '').replace(/\s*\/.*$/, '').toLowerCase());
      p.name = or.name.replace(/\s+(from|for)\s+.*$/i, '').trim();
      p._size = []; p._prep = []; p._drain = [];
      const keep = [];
      for (let part of (p.note || '').split(/,\s*/)) {
        part = part.replace(/\*/g, '').replace(/^and\s+/i, '').replace(/\s+or\s+.*$/i, '').replace(/\s+until\b.*$/i, '').trim();
        if (!part || /\b(your choice|of choice|such as|to serve|plus extra|optional)\b|^big$/i.test(part)) continue;
        // "4 onions, 2 cut into wedges, 2 chopped" → "2 wedges, 2 chopped"
        const count = part.match(/^(\d+)\s+(?=\D)/);
        const body = count ? part.slice(count[0].length) : part;
        if (isSize(part)) p._size.push(part.toLowerCase());
        else if (isPrepText(body) || isDrainText(body)) {
          p._prep.push(...prepDescs(body).map(d => count ? count[1] + ' ' + d : d));
          p._drain.push(...drainDescs(body));
        }
        else if (!/^(or|optional|plus|about|to taste|for serving|for garnish|garnish|divided)\b/i.test(part)) keep.push(part);
      }
      if (or.alt) keep.push('or ' + or.alt);
      p.note = keep.join(', ') || undefined; // stays in the ingredient list (e.g. "15-ounce"), not in steps
      return p;
    }).filter(Boolean);
  }
  const isCut = d => /^(?:finely |roughly )?(diced|chopped|minced|sliced|cubed|julienned)\b/.test(d) || /"|chunks|wedges|strips|pieces/.test(d);
  const addDescs = (ing, list) => {
    // the ingredient list says how it's cut ("sliced") — an instruction's "dice the onions" doesn't add a second cut
    const hasCut = ing._prep.some(isCut);
    for (const d of list) if (!ing._prep.includes(d) && !(hasCut && isCut(d))) ing._prep.push(d);
    // once there's a final size ('1" chunks'), the in-between steps aren't worth saying
    if (ing._prep.some(d => d.includes('"'))) ing._prep = ing._prep.filter(d => !['cubed', 'chopped', 'diced', 'halved', 'quartered', 'trimmed'].includes(d));
    ing._prep.sort((a, b) => rank(a) - rank(b));
  };

  // Words that identify each ingredient inside an instruction sentence.
  const CHEESES = /\b(cheddar|parmesan|parmigiano|mozzarella|gruy[eè]re|feta|swiss|provolone|monterey jack|pepper jack|ricotta|goat cheese|halloumi|paneer|gouda|brie)\b/;
  function buildKeys(ings) {
    // rank 0: the whole name, 1: its last word (the thing itself), 2: a describing first word or a short form
    const keysOf = ings.map(ing => {
      const name = ing.name.toLowerCase();
      const ks = new Map([[singularPhrase(name), 0]]);
      const add = (k, r) => { if (k && !ks.has(k)) ks.set(k, r); };
      const words = name.split(' ').filter(w => !STOP.has(w));
      const trimmed = words.join(' ');
      if (trimmed) add(singularPhrase(trimmed), 0);
      const last = singular(name.split(' ').pop());
      if (last.length >= 3 && !GENERIC.has(last)) add(last, 1);
      // "unsweetened cocoa powder" → "cocoa powder"
      if (words.length >= 3) add(singularPhrase(words.slice(-2).join(' ')), 1);
      const first = singular(trimmed.split(' ')[0] || '');
      // "onion powder" and "tomato paste" are a powder and a paste: "the onion" isn't them
      const lastGeneric = /^(powder|paste|sauce|extract|flakes|chips|mix|stock|broth)$/.test(name.split(' ').pop());
      if (trimmed.includes(' ') && first.length >= 4 && !GENERIC.has(first) && !lastGeneric && !/^(diced|chopped|crushed|sliced|minced|grated|shredded|ground|whole|canned|cooked|vegetable|roasted|toasted|baby|green|red|fire|chicken|beef|pork)$/.test(first)) add(first, 2);
      if (/^chicken|^beef|^pork/.test(trimmed) && !lastGeneric && !/\b(broth|stock|bouillon|sausage)\b/.test(name)) add(trimmed.split(' ')[0], 2);
      // "toast slices", "the cheese"
      if (/\b(bread|baguette|sourdough|loaf)\b/.test(name)) { add('toast', 2); add('bread', 2); }
      if (CHEESES.test(name)) add('cheese', 2);
      return ks;
    });
    // A short key shared by several ingredients goes to the one it names best ("onion" → yellow onion,
    // not onion powder), then to the one listed first — main ingredients come before toppings.
    const owner = {}, best = {};
    keysOf.forEach((ks, i) => ks.forEach((r, k) => { if (best[k] == null || r < best[k]) { owner[k] = i; best[k] = r; } }));
    const list = [];
    // Plural "the beans" means kidney AND pinto when they're listed next to each other.
    const sharers = {};
    keysOf.forEach((ks, i) => ks.forEach((r, k) => (sharers[k] ||= []).push(i)));
    keysOf.forEach((ks, i) => ks.forEach((r, k) => {
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
  // "ten minutes", "a couple minutes", "half an hour" → numbers the time finder can read
  const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, sixty: 60, 'a couple': 2, 'a couple of': 2, 'a few': 3 };
  const numWords = text => text.replace(/\bhalf an hour\b/gi, '30 minutes')
    .replace(/\b(a couple(?: of)?|a few|forty-five|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)\s+(?=(?:more\s+)?(?:minutes?|mins?|hours?|hrs?)\b)/gi, (m, w) => NUMW[w.toLowerCase()] + ' ');
  const findTime = text => {
    const m = numWords(text).match(/(\d+(?:\.\d+)?)\s*(?:[-–]|to)?\s*(?:\d+)?\s*(?:more\s+)?(minutes?|mins?|hours?|hrs?)\b/i);
    if (!m) return null;
    return Math.round(+m[1] * (/^h/i.test(m[2]) ? 60 : 1));
  };
  const LEVEL = '(medium[- ]high|medium[- ]low|low|medium|med|high)';
  const findHeat = text => {
    const t = text.toLowerCase();
    // "over medium-high heat", "over medium-high", "reduce the heat to medium low", "turn the heat down to low"
    const m = t.match(new RegExp(`\\b${LEVEL}\\s+heat\\b`)) || t.match(new RegExp(`\\bheat\\s+(?:(?:down|up)\\s+)?to\\s+${LEVEL}\\b`)) || t.match(new RegExp(`\\bover\\s+${LEVEL}\\b`));
    if (!m) return undefined;
    return /medium[- ]high|^high/.test(m[1]) ? 3 : /medium[- ]low|^low/.test(m[1]) ? 1 : 2;
  };
  const findTemp = text => {
    const m = text.match(/(\d{3})\s*°?\s*(F|C)\b|(\d{3})\s*degrees/i) || text.match(/\boven to (\d{3})\b()/i);
    if (!m) return undefined;
    const n = m[1] || m[3];
    return `${n}°${(m[2] || (+n < 250 ? 'C' : 'F')).toUpperCase()}`;
  };
  const findShort = text => {
    const bits = [];
    if (/\buncovered\b|\buncover\b/i.test(text)) bits.push('uncovered');
    else if (/\bcovered\b|\bcover\b/i.test(text)) bits.push('covered');
    if (/\bovernight\b/i.test(text)) bits.push('overnight');
    const until = text.match(/\buntil ([^,.;–—(]+)/i);
    // "until combined / evenly coated" says nothing a cook needs
    if (until && !/\b(?:combined|incorporated|coated|mixed|blended|distributed)\b/i.test(until[1])) {
      // keep it short: "until no longer pink in the center" → "until no longer pink"
      let phrase = until[1].trim().replace(/^just\s+/i, '')
        .replace(/^(?:(?:the|it|they)\s+)?(?:[a-z]+\s+){0,3}?(?=(?:just\s+)?(?:begins?|starts?|beginning|starting) to\s)/i, '')
        .replace(/^(?:(?:the|it|they)\s+)?(?:[a-z]+\s+){0,3}?(?:is|are|has|have|looks?|becomes?|turns?|gets?)\s+(?:been\s+)?/i, '')
        .replace(/^just\s+/i, '')
        .replace(/^(starting|beginning|just starting) to\s+(\w+)/i, (m, a, v) => v.replace(/e$/, '') + 'ed').replace(/^(begins?|starts?) to\s+(\w+)/i, (m, a, v) => v.replace(/e$/, '') + 'ed')
        .replace(/^(?:some |a little )?colou?r\b.*/i, 'browned');
      let words = phrase.split(/\s+/).slice(0, 4);
      const cut = words.findIndex((w, k) => k > 0 && /^(in|about|or|and|on|at|to|into|with|from|so)$/i.test(w));
      if (cut > 0) words = words.slice(0, cut);
      while (words.length > 1 && /^(the|a|an|of|is|are)$/i.test(words[words.length - 1])) words.pop();
      if (words.join('')) bits.push('until ' + words.join(' '));
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
      if (/^[\d½¼¾-]+$|^(minutes?|mins?|hours?|hrs?)$/i.test(w)) break;
      if (/^(the|a|an|it|them)$/i.test(w) && !out.length) continue;
      out.push(w.toLowerCase());
      if (out.length >= 5) break;
    }
    return out.join(' ') || undefined;
  }

  function clauses(steps) {
    const out = [];
    for (let s of steps) {
      s = s.replace(/\s*\([^)]*\)/g, '')                                   // asides: "(I used 1 tsp salt)"
        .replace(/^[A-Z][\w']*(?: [\w']+){0,3}:\s+(?=[A-Z])/, '')                // "Make soup: Preheat…"
        .replace(/([a-z])\s+(?=(?:Reduce|Remove|Bring|Add|Stir|Cook|Simmer|Let|Once|Return|Serve|Transfer|Top|Season|Pour|Place|Heat)\b)/g, '$1. '); // a missing full stop
      for (const sentence of s.split(/(?<=[.!?])\s+(?=[A-Z(])/)) {
        for (const c of sentence.split(/,?\s+(?:and\s+)?then\s+|;\s+/i)) {
          // "Meanwhile, melt the butter" happens alongside the previous steps, not after them.
          const parallel = /^(meanwhile|while\b|at the same time)/i.test(c.trim());
          const t = c.trim().replace(/^(next|then|finally|meanwhile|at the same time),?\s+/i, '')
            .replace(/\bremove the lid\b/gi, 'uncover').replace(/\b(?:place|put|add|set)\s+(?:a|the)\s+lid(?:\s+on(?:\s+top)?)?/gi, 'cover')
            .replace(/^once (?:boiling|it(?:'s| is) boiling|hot|melted),?\s+/i, '');
          if (t) out.push({ text: t, parallel });
        }
      }
    }
    return out;
  }

  // ---------- Convert ----------
  // Sentences that are tips, options or storage advice — not cooking steps.
  const SKIP = /^(if\b|it will|it takes|this will|leave (?:it )?chunky|or\b|do ahead|depending|when the cook time|quick release|natural(ly)? release|lock the lid|seal|optional|note|tip|store|storage|leftover|to store|make[- ]ahead|to make ahead|you can|feel free|for best|enjoy|reheat|freeze|nutrition|this recipe|recipe)/i;
  const PREP_START = /^(peel|core|seed|deseed|halve|quarter|trim|stem|pit|cube|scoop|remove|cut|chop|dice|mince|slice|grate|shred|julienne|drain|rinse|wash|pat)\b/i;

  function convert(data) {
    data = { ...data, steps: (data.steps || []).filter(p => !/^(storage|notes?|tips?|make[- ]ahead|do[- ]ahead|leftovers?|recipe notes?|to store|freezing)\b/i.test(p.trim())) };
    const ings = buildIngredients(data.ingredients || []);
    const keys = buildKeys(ings, data.name);
    const byId = Object.fromEntries(ings.map(i => [i.id, i]));
    // Cheese is usually bought grated, canned things come ready — neither is knife work.
    const knifeOk = i => !(U.category(i) === 'dairy' && i._prep.every(d => d === 'grated')) && U.normUnit(i.unit) !== 'can';

    // 1) Read the instructions. Prep sentences only add notes to ingredients; everything else
    //    becomes a step with one action, its ingredients, and a short note / time / heat.
    // Words that stand for several ingredients: "the cajun seasoning mix" / "the spice mix" (the dry
    // spices the steps never name one by one), "the pastes" (every "… paste").
    const allClauses = clauses(data.steps || []);
    const named = new Set(allClauses.flatMap(c => findIngs(c.text, keys)));
    const spiceGroup = ings.filter(i => U.category(i) === 'spices' && !/\b(oil|vinegar|sauce|wine)\b/.test(i.name) && !named.has(i.id)).map(i => i.id);
    const refs = text => {
      const t = text.toLowerCase(), out = [];
      if (/\b(?:spice|seasoning)s? (?:mix|mixture|blend|rub)\b|\b(?:the|all the|remaining) spices\b|\bdry rub\b/.test(t)) out.push(...spiceGroup);
      for (const g of ['paste', 'sauce', 'powder']) if (new RegExp(`\\b${g}s\\b`).test(t)) out.push(...ings.filter(i => i.name.endsWith(' ' + g)).map(i => i.id));
      return out;
    };
    const instr = [];
    let pendingHeat;
    // Is the pan already hot by this step (or, with null, by now)?
    const atStove = s => instr.slice(0, s ? instr.indexOf(s) + 1 : instr.length)
      .some(p => ['heat', 'saute', 'cook', 'fry', 'sear', 'melt'].includes(p.verb) || p.heat);
    let lastPrep = [];
    for (const { text, parallel } of allClauses) {
      if (SKIP.test(text)) continue;
      const uses = findIngs(text, keys);
      for (const id of refs(text)) if (!uses.includes(id)) uses.push(id);
      // "the chicken and veg" → the vegetables that went in with the chicken earlier
      if (/\b(veg|veggies|vegetables)\b/i.test(text) && uses.length) {
        const with_ = [...instr].reverse().find(p => p.uses.some(u => uses.includes(u.ing)));
        for (const u of with_?.uses || []) if (!uses.includes(u.ing) && U.category(byId[u.ing]) === 'produce' && !/\b(garlic|ginger|lemon|lime|cilantro|coriander|parsley|basil|mint|thyme|chive|dill)\b/.test(byId[u.ing].name)) uses.push(u.ing);
      }
      const verb = findVerb(text);
      const first = (text.match(/^[a-z]+/i) || [''])[0].toLowerCase();
      const seen = id => instr.some(st => st.uses.some(u => u.ing === id));
      let prepish = PREP_START.test(text) || !!(verb && App.verb(verb).group === 'Prep' && verb !== 'marinate');
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

      let v0 = prepish ? findVerb(text.replace(PREP_START, ''), true) : verb;
      const time = findTime(text), temp = findTemp(text);
      let heat = findHeat(text);
      // "Reduce the heat to medium low." on its own is for the next step
      if (!v0 && heat && /\b(reduce|lower|turn|raise|increase)\b/i.test(text)) { pendingHeat = heat; continue; }
      if (heat == null && pendingHeat) heat = pendingHeat;
      pendingHeat = undefined;
      if (/\b(?:pre-?heat|heat)\s+(?:the\s+|your\s+)?oven\b/i.test(text)) v0 = 'preheat';
      else if (/^taste\b|\badjust (?:the )?seasonings?\b|\bseason to taste\b/i.test(text)) v0 = 'season';
      else if (['add', 'mix'].includes(v0) && /\b(blender|food processor|pur[eé]e)\b/i.test(text) && !/\bimmersion\b/i.test(text)) v0 = 'blend';
      else if (v0 === 'top' && /^spread\b[^.]*\b(?:on|onto)\s+(?:a|the)\s+(?:\w+\s+)?(?:tray|sheet|pan|dish)\b/i.test(text)) v0 = 'add';
      if (v0 === 'season' && /\btaste\b|\badjust\b/i.test(text)) { const sp = uses.filter(id => U.category(byId[id]) === 'spices' && !/oil|vinegar/.test(byId[id].name)); uses.splice(0, uses.length, ...sp); }
      // "Top the pasta with green onions": the toppings are what comes after "with"
      if (['top', 'serve'].includes(v0)) { const w = text.match(/\bwith\b(.+)$/i); const after = w && findIngs(w[1], keys); if (after?.length) uses.splice(0, uses.length, ...after); }
      const last = instr[instr.length - 1];
      // Clauses that add nothing new ("Stir to combine", "cook until soft") fold into the step before.
      const filler = !v0 || (['stir', 'mix', 'cook'].includes(v0) && last && uses.every(id => last.uses.some(u => u.ing === id)) && (!time || !last.time));
      if (filler) {
        if (last) {
          if (!last.time && time) last.time = time;
          if (!last.text) last.text = findShort(text);
          if (!last.heat && heat) last.heat = heat;
          // "Add the onion… Cook, stirring, until soft" — that's a sauté, so call it one.
          if (last.verb === 'add' && ['cook', 'stir', 'saute', 'fry'].includes(v0) && (last.time || /until/.test(last.text || '')) && atStove(last) && instr[instr.length - 2]?.verb !== 'saute') last.verb = 'saute';
        }
        continue;
      }
      let v = v0;
      const allFat = uses.length && uses.every(id => /\b(oil|butter|ghee)\b/.test(byId[id].name));
      if ((v === 'add' || v === 'pour') && allFat && heat) v = 'heat';
      if ((v === 'add' || v === 'stir') && uses.length && uses.every(id => U.category(byId[id]) === 'spices' && !/oil/.test(byId[id].name))) v = 'season';
      // "Add the garlic and cook 2 minutes" in a hot pan is a sauté too.
      if (v === 'add' && !/\bpour\b/i.test(text) && /\b(cook|saut|fry|stir)\w*/i.test(text.replace(/^.*?\badd\b/i, '')) && (time || /\buntil\b/i.test(text)) && atStove(null) && instr[instr.length - 1]?.verb !== 'saute') v = 'saute'; // already sautéing → it's just "Add"
      const vd = App.verb(v);
      instr.push({
        id: U.uid('s'), verb: v, uses: uses.map(ing => ({ ing })), _text: text,
        text: v === 'preheat' ? undefined : v === 'season' && /taste/i.test(text) && !uses.length ? 'to taste' : findShort(text) || (uses.length ? undefined : objectOf(text, v0)),
        parallel, time: time || undefined, heat, temp: vd.group === 'Oven' ? temp : undefined,
      });
    }

    // 2) Combine back-to-back steps with the same action ("Season: salt" + "Season: pepper").
    for (let k = instr.length - 1; k > 0; k--) {
      const a = instr[k - 1], b = instr[k];
      // a timed step, or one that goes "until …", is its own stage
      if (a.verb !== b.verb || b.parallel || App.verb(a.verb).passive || a.time || b.time || /until/.test((a.text || '') + (b.text || ''))) continue;
      for (const u of b.uses) if (!a.uses.some(x => x.ing === u.ing)) a.uses.push(u);
      a._text += ' ' + b._text;
      a.text = [...new Set([a.text, b.text].filter(Boolean))].join(', ') || undefined;
      a.time = a.time || b.time; a.heat = a.heat || b.heat;
      instr.splice(k, 1);
    }

    // 2b) "Add the oil… Heat the oil" is one Heat; "bring to a boil… simmer 30 min" is one Simmer.
    const same = (a, b) => a.uses.length && a.uses.every(u => b.uses.some(x => x.ing === u.ing));
    const cue = t => t && /covered|until|overnight/.test(t) ? t : undefined;
    for (let k = instr.length - 1; k > 0; k--) {
      const a = instr[k - 1], b = instr[k];
      const take = () => { b._text = a._text + ' ' + b._text; b.uses = [...a.uses, ...b.uses.filter(u => !a.uses.some(x => x.ing === u.ing))]; b.parallel = a.parallel; b.heat ??= a.heat; instr.splice(k - 1, 1); };
      if (a.verb === 'add' && b.verb === 'heat' && same(a, b)) take();
      else if (a.verb === 'boil' && b.verb === 'simmer' && !a.time) { b.text = cue(b.text) || cue(a.text); take(); }
      else if (a.verb === 'simmer' && b.verb === 'simmer' && !a.time && !b.uses.length) { b.text = [cue(a.text), cue(b.text)].filter(Boolean).join(', ') || undefined; take(); }
    }

    // 3) Toppings: ingredients first used when serving, or listed after everything the steps use.
    const firstUse = {};
    instr.forEach((s, i) => s.uses.forEach(u => { if (firstUse[u.ing] == null) firstUse[u.ing] = i; }));
    const toppingIds = new Set(ings.filter(i => firstUse[i.id] != null && ['serve', 'top', 'garnish'].includes(instr[firstUse[i.id]].verb)).map(i => i.id));
    const lastUsed = Math.max(-1, ...ings.map((i, k) => firstUse[i.id] != null ? k : -1));
    ings.forEach((i, k) => { if (lastUsed >= 0 && k > lastUsed && firstUse[i.id] == null) toppingIds.add(i.id); });
    // the end of the list is toppings ("Sliced avocado, crushed tortilla chips, lime wedges"): unused ones there are too
    if (toppingIds.size) for (let k = ings.length - 1; k >= 0 && (firstUse[ings[k].id] == null || toppingIds.has(ings[k].id)); k--) toppingIds.add(ings[k].id);
    ings.forEach(i => { if (toppingIds.has(i.id)) i.group = 'Toppings'; });
    const ordered = [...ings.filter(i => !toppingIds.has(i.id)), ...ings.filter(i => toppingIds.has(i.id))];

    // 4) ONE knife step for everything that needs prep. The action is the shared cut if they all
    //    match (all diced → "Dice"), otherwise "Chop"; each ingredient's note says how.
    //    The exception is a Veggie mix: three or more vegetables cut and then added together get
    //    their own Chop step that "makes Veggie mix", and the later step uses the mix.
    const knife = ordered.filter(i => i._prep.length && knifeOk(i));
    const firstStep = {};
    instr.forEach(s => s.uses.forEach(u => { firstStep[u.ing] ??= s; }));
    const veg = new Map(); // instr step → the vegetables cut for it
    for (const i of knife) {
      const s = firstStep[i.id];
      if (s && U.category(i) === 'produce' && !['serve', 'top', 'garnish'].includes(s.verb)) veg.set(s, [...(veg.get(s) || []), i]);
    }
    for (const [s, list] of veg) if (list.length < 3) veg.delete(s);
    const knifeStepFor = (items, makes) => {
      const cutOf = i => CUT_VERB[i._prep.find(d => CUT_VERB[d] && d !== 'peeled') || (i._prep.includes('peeled') ? 'peeled' : '')] || null;
      const cuts = [...new Set(items.map(cutOf))];
      const verb = cuts.length === 1 && cuts[0] ? cuts[0] : 'chop';
      // the step says Chop, so "chopped" goes without saying; "minced", "cubed", "2 wedges" stay as notes
      const bare = verb === 'grate' ? ['grated'] : ['chopped'];
      return {
        id: U.uid('s'), verb, after: [], makes,
        uses: items.map(i => {
          const note = [...i._size, ...i._prep.filter(d => !bare.includes(d))].join(', ');
          return note ? { ing: i.id, note } : { ing: i.id };
        }),
      };
    };
    const mixNames = new Set();
    const nameMix = base => { let n = base, k = 2; while (mixNames.has(n)) n = `${base} ${k++}`; mixNames.add(n); return n; };
    const knifeSteps = [];
    const inMix = new Set([...veg.values()].flat().map(i => i.id));
    const rest = knife.filter(i => !inMix.has(i.id));
    if (rest.length) knifeSteps.push(knifeStepFor(rest));
    const vegSteps = new Map();
    for (const [s, list] of veg) { const k = knifeStepFor(list, nameMix('Veggie mix')); vegSteps.set(s, k); knifeSteps.push(k); }
    // in the order they're needed
    const firstAt = k => Math.min(...k.uses.map(u => instr.indexOf(firstStep[u.ing])).filter(n => n >= 0), 1e9);
    knifeSteps.sort((a, b) => firstAt(a) - firstAt(b));
    const knifeOf = id => knifeSteps.find(k => k.uses.some(u => u.ing === id));

    // Everyone else gets their size / drained note on the first step that uses them.
    const noted = new Set(knifeSteps.flatMap(k => k.uses.map(u => u.ing)));
    for (const s of instr) for (const u of s.uses) {
      const g = byId[u.ing];
      if (noted.has(g.id)) continue;
      noted.add(g.id);
      const note = [...g._size, ...(knifeOk(g) ? [] : g._prep.filter(d => d !== 'grated')), ...g._drain].join(', ');
      if (note) u.note = note;
    }

    // 4b) Mixes, the way people actually cook: measure the spices into a bowl, chop the veg into
    //     one pile, whisk the sauce ahead. A later step then uses "Spice mix", in the place the
    //     recipe adds it, instead of listing everything again.
    const useMix = (s, ids, mix) => {
      const at = Math.max(0, s.uses.findIndex(u => ids.includes(u.ing)));
      s.uses = s.uses.filter(u => !ids.includes(u.ing));
      s.uses.splice(at, 0, { from: mix.id });
    };
    for (const [s, k] of vegSteps) useMix(s, k.uses.map(u => u.ing), k);
    // Spice mix: three or more dry spices that go in together (not "season to taste" at the end).
    const dry = id => { const g = byId[id]; return U.category(g) === 'spices' && !/\b(oil|vinegar|sauce|wine|broth|stock|paste|extract)\b/.test(g.name); };
    const extraDry = id => /\b(cocoa|brown sugar|cornstarch)\b/.test(byId[id].name);
    const mixSteps = [];
    for (const s of instr) {
      if (s.verb === 'season' && /\btaste\b|\badjust\b/i.test(s._text)) continue;
      const spices = s.uses.filter(u => u.ing && dry(u.ing));
      if (spices.length < 3) continue;
      const ids = s.uses.filter(u => u.ing && (dry(u.ing) || extraDry(u.ing))).map(u => u.ing);
      // a step that is only the spices, in a bowl, already is the mix
      if (s.uses.every(u => ids.includes(u.ing)) && ['mix', 'season'].includes(s.verb) && !atStove(s)) { s.verb = 'mix'; s.makes = nameMix('Spice mix'); continue; }
      const m = { id: U.uid('s'), verb: 'mix', after: [], makes: nameMix('Spice mix'), uses: s.uses.filter(u => ids.includes(u.ing)) };
      mixSteps.push(m);
      useMix(s, ids, m);
    }
    // A sauce, dressing or marinade whisked in a bowl, that a later step pours in as "the sauce".
    const MIX_WORD = /\b(sauce|dressing|marinade|glaze|batter|slurry)\b/i;
    const REF = /\b(?:the|that|this)\s+(?:\w+\s+)?(sauce|dressing|marinade|glaze|batter|slurry|mixture)\b/i;
    for (const [n, s] of instr.entries()) {
      if (s.makes || s.verb !== 'mix' || s.uses.length < 2 || !/\b(bowl|jar|jug|whisk|together)\b/i.test(s._text) || atStove(s)) continue;
      if (s.uses.some(u => u.ing && ['protein', 'produce'].includes(U.category(byId[u.ing])) && !/\b(garlic|ginger|lemon|lime|orange)\b/.test(byId[u.ing].name))) continue;
      const later = instr.slice(n + 1).filter(t => REF.test(t._text));
      if (!later.length) continue;
      const word = (s._text.match(MIX_WORD) || later[0]._text.match(REF))[1].toLowerCase();
      s.makes = nameMix(word === 'mixture' ? (s.uses.every(u => u.ing && dry(u.ing)) ? 'Spice mix' : 'Sauce') : word[0].toUpperCase() + word.slice(1));
      for (const t of later) { const ids = s.uses.map(u => u.ing); if (t.uses.some(u => ids.includes(u.ing))) useMix(t, ids, s); else t.uses.push({ from: s.id }); }
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
        if (u.from) { if (!after.includes(u.from)) after.push(u.from); continue; }
        const prev = [...before].reverse().find(p => touch[p.id]?.has(u.ing));
        if (prev && !after.includes(prev.id)) after.push(prev.id);
      }
      touch[s.id] = s.uses.some(u => u.ing) ? new Set(s.uses.map(u => u.ing).filter(Boolean)) : new Set(s.parallel ? [] : touch[chainPrev] || []);
      if (preheat && ['bake', 'roast', 'broil'].includes(s.verb)) after.push(preheat);
      for (const u of s.uses) { const k = u.ing && knifeOf(u.ing); if (k && !after.includes(k.id)) after.push(k.id); }
      s.after = after;
      delete s.parallel;
      chainPrev = s.id;
    }

    // 6) A "serve with toppings" step lists the toppings.
    const serve = instr.find(s => ['serve', 'top', 'garnish'].includes(s.verb));
    if (serve && toppingIds.size && (!serve.uses.length || serve.uses.every(u => toppingIds.has(u.ing)))) {
      serve.uses = [...serve.uses, ...[...toppingIds].filter(id => !serve.uses.some(u => u.ing === id)).map(ing => ({ ing }))];
      serve.text = /toppings/.test(serve.text || '') ? undefined : serve.text;
      for (const u of serve.uses) { const k = knifeOf(u.ing); if (k && !serve.after.includes(k.id)) serve.after.push(k.id); }
    }

    // "Float a slice on each bowl": a Top with nothing on it says nothing
    const steps = [...knifeSteps, ...mixSteps, ...instr.filter(st => !(st.verb === 'top' && !st.uses.length))];
    steps.forEach(s => { delete s._text; Object.keys(s).forEach(k => s[k] === undefined && delete s[k]); });
    return {
      title: data.name || 'Imported recipe',
      icon: U.suggestIcon({ title: data.name || '', ingredients: ordered }),
      servings: data.servings || 4,
      source: data.source || '',
      tags: [],
      ingredients: ordered.map(({ _size, _prep, _drain, ...rest }) => rest),
      steps,
      notes: [],
    };
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
  // Uses "Ingredients" / "Instructions" headings when present, otherwise finds the block of
  // ingredient lines: what comes before it is the title and blurb, what comes after is the method.
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
    const servOf = l => (l.match(/^(?:serves|servings|yield|makes)\s*:?\s*(\d+)/i) || [])[1];
    const looksIng = l => /^([\d½¼¾⅓⅔⅛]|a pinch|pinch|a handful|handful|big bunch|bunch|a few)/i.test(l) && l.length < 300 && !/^\d+\s*(?:minutes?|mins?|hours?)\b/i.test(l);
    const isGroup = l => !looksIng(l) && l.length < 40 && l.split(' ').length <= 4 && !/[.!?]$/.test(l);
    let title = meta.title || '', servings = null;
    // A full web page mentions "Ingredients" more than once — use the last heading that's
    // followed by an Instructions heading (that's the recipe card). The title and "Serves 4" come before it.
    let start = -1;
    lines.forEach((l, i) => { if (isIngHead(l) && lines.slice(i + 1).some(isStepHead)) start = i; });
    if (start > 0) {
      for (const l of lines.slice(0, start)) { const n = servOf(l); if (n) servings = +n; }
      if (!title && !looksIng(lines[0]) && lines[0].length < 80) title = lines[0];
      lines = lines.slice(start);
    }
    const ingredients = [], steps = [];
    if (lines.some(isIngHead) || lines.some(isStepHead)) {
      let mode = null;
      lines.forEach((l, i) => {
        const n = servOf(l);
        if (n && l.length < 80) { servings = +n; return; }
        if (isIngHead(l)) { mode = 'ing'; return; }
        if (isStepHead(l)) { mode = 'step'; return; }
        if (/^(notes?|nutrition|video|equipment)\b/i.test(l)) { mode = 'skip'; return; }
        if (/^for the\b/i.test(l) || mode === 'skip') return;
        if (!title && i === 0 && !looksIng(l) && l.length < 80) { title = l; return; }
        if (mode === 'ing' && isGroup(l)) return;      // "Soup", "Sauce" — a group name
        if (mode === 'ing' || (!mode && looksIng(l))) ingredients.push(l);
        else if (mode === 'step' || l.split(' ').length > 4) steps.push(l);
      });
    } else {
      // No headings: the ingredient block runs from the first to the last ingredient-looking line.
      const idx = lines.map((l, i) => looksIng(l) ? i : -1).filter(i => i >= 0);
      const first = idx[0] ?? lines.length, last = idx[idx.length - 1] ?? -1;
      lines.forEach((l, i) => {
        const n = servOf(l);
        if (i < first) { if (n) servings = +n; else if (!title && i === 0 && l.length < 80) title = l; return; } // blurb
        if (i <= last) { if (looksIng(l)) ingredients.push(l); return; }        // group names in between are skipped
        if (n && l.length < 80) { servings = +n; return; }
        if (l.split(' ').length > 3) steps.push(l);
      });
    }
    if (!ingredients.length && !steps.length) throw new Error('Couldn’t find ingredients or steps in that text.');
    return convert({ name: title || 'Pasted recipe', servings, ingredients, steps, source: meta.source || '' });
  }

  return { convert, fromUrl, fromText };
})();
