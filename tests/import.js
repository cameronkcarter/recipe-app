// Runs the importer on the recipes in tests/import/ and checks the result: every ingredient is used
// in a step, names and notes come out tidy, and the steps have the right action, ingredients, time and heat.
// The recipes there are written for this test in the styles real sites use (they aren't copied from them).
// Run: node tests/import.js            (add -v to print each converted recipe)
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { window: {}, console, location: { hostname: 'x', protocol: 'https:' } }; ctx.window.App = {}; ctx.App = ctx.window.App;
vm.createContext(ctx);
for (const f of ['icons.js', 'data.js', 'util.js', 'importer.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const App = ctx.App, U = App.util, verbose = process.argv.includes('-v');

const dir = path.join(__dirname, 'import');
let bad = 0, checks = 0;
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')), x = d.expect || {};
  const r = d.text ? App.importer.fromText(d.text) : App.importer.convert(d);
  const fails = [];
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
  const byName = n => r.ingredients.find(g => g.name === n);
  const nameOf = id => r.ingredients.find(g => g.id === id)?.name;

  if (x.title) ok(r.title === x.title, `title is "${r.title}"`);
  if (x.servings) ok(r.servings === x.servings, `serves ${r.servings}`);
  for (const n of x.names || []) ok(byName(n), `no ingredient named "${n}" (got: ${r.ingredients.map(g => g.name).join(', ')})`);
  for (const [n, want] of Object.entries(x.ingredients || {})) {
    const g = byName(n);
    ok(g, `no ingredient named "${n}"`);
    if (!g) continue;
    if ('qty' in want) ok(g.qty === want.qty, `${n}: qty ${g.qty}, want ${want.qty}`);
    if ('unit' in want) ok(U.normUnit(g.unit) === want.unit, `${n}: unit "${g.unit}", want "${want.unit}"`);
    if ('note' in want) ok(want.note ? (g.note || '').includes(want.note) : !/\$|\bg\b|\bml\b|about/.test(g.note || ''), `${n}: note "${g.note || ''}"${want.note ? `, want "${want.note}"` : ' has a price or metric repeat'}`);
  }
  const used = new Set(r.steps.flatMap(s => (s.uses || []).map(u => u.ing)));
  const unused = r.ingredients.filter(g => !used.has(g.id)).map(g => g.name);
  if (x.unused) ok(unused.length === x.unused.length, `never used in a step: ${unused.join(', ')}`);

  // expected steps must appear in this order (other steps may sit between them)
  let at = 0;
  for (const want of x.steps || []) {
    const match = s => {
      if (s.verb !== want.verb) return false;
      const names = (s.uses || []).filter(u => u.ing).map(u => nameOf(u.ing));
      const mixes = (s.uses || []).filter(u => u.from).map(u => r.steps.find(x => x.id === u.from)?.makes);
      if ('makes' in want && s.makes !== want.makes) return false;
      if (want.mixes && !(mixes.length === want.mixes.length && want.mixes.every(n => mixes.includes(n)))) return false;
      // a mix sits where the recipe adds it: "after" names the ingredient it comes right after
      if (want.mixAfter) { const k = (s.uses || []).findIndex(u => u.from); if (k < 1 || nameOf(s.uses[k - 1].ing) !== want.mixAfter) return false; }
      if (want.uses && !want.uses.every(n => names.includes(n))) return false;
      if (want.only && !(names.length === want.only.length && want.only.every(n => names.includes(n)))) return false;
      if ('time' in want && s.time !== want.time) return false;
      if ('heat' in want && s.heat !== want.heat) return false;
      if ('temp' in want && s.temp !== want.temp) return false;
      if ('text' in want && !(s.text || '').includes(want.text)) return false;
      for (const [n, note] of Object.entries(want.notes || {})) {
        const u = (s.uses || []).find(u => nameOf(u.ing) === n), got = u?.note || '';
        if (!u || (note.startsWith('!') ? got.includes(note.slice(1)) : !got.includes(note))) return false;
      }
      return true;
    };
    const k = r.steps.slice(at).findIndex(match);
    ok(k >= 0, `no ${App.verb(want.verb).label} step like ${JSON.stringify(want)} after step ${at}`);
    if (k >= 0) at += k + 1;
  }
  // knife work stays in one step; a second Chop step is only for one that makes a mix (Cam, Nov 23)
  const knifeSteps = r.steps.filter(s => ['chop', 'grate'].includes(s.verb) && (s.uses || []).every(u => u.ing));
  ok(knifeSteps.filter(s => !s.makes).length <= 1, `more than one knife step that makes no mix`);
  for (const v of x.noVerb || []) ok(!r.steps.some(s => s.verb === v), `has a ${v} step it shouldn't`);
  const all = JSON.stringify(r);
  for (const t of x.noText || []) ok(!all.includes(t), `kept "${t}"`);

  if (verbose || fails.length) {
    console.log(`\n${fails.length ? '✗' : '✓'} ${file}: ${r.title}`);
    for (const g of r.ingredients) console.log(`    ${U.fmtAmount(g.qty, U.normUnit(g.unit)) || '—'} ${g.name}${g.note ? ' (' + g.note + ')' : ''}`);
    r.steps.forEach((s, i) => console.log(`  ${i + 1}. ${App.verb(s.verb).label}: ${(s.uses || []).map(u => u.from ? `[${r.steps.find(x => x.id === u.from)?.makes}]` : nameOf(u.ing) + (u.note ? ' · ' + u.note : '')).join(', ') || '—'}${s.makes ? '  → makes ' + s.makes : ''}${[s.time && s.time + ' min', s.text, s.heat && ['', 'low', 'medium', 'high'][s.heat], s.temp].filter(Boolean).map(t => '  [' + t + ']').join('')}`));
    for (const f of fails) console.log('    ✗ ' + f);
  }
  bad += fails.length;
}
console.log(bad ? `\n${bad} of ${checks} import checks failed.` : `All ${checks} import checks pass.`);
process.exit(bad ? 1 : 0);
