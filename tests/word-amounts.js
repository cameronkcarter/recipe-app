// Checks that word amounts ("a splash", "a pinch", "to taste") show on the shopping list and add up.
// Run: node tests/word-amounts.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { window: {} }; ctx.window.App = {}; ctx.App = ctx.window.App;
vm.createContext(ctx);
for (const f of ['icons.js', 'data.js', 'util.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const U = ctx.App.util;
const cases = [
  [[{ qty: null, unit: 'splash' }], 'a splash'],
  [[{ qty: null, unit: 'splash' }, { qty: null, unit: 'splash' }], '2 splashes'],
  [[{ qty: null, unit: 'pinch' }, { qty: null, unit: 'pinch' }], '2 pinches'],
  [[{ qty: null, unit: 'dash' }], 'a dash'],
  [[{ qty: null, unit: 'handful' }, { qty: 1, unit: 'handful' }], '2 handfuls'],
  [[{ qty: 1, unit: 'cup' }, { qty: null, unit: 'splash' }], '1 cup + a splash'],
  [[{ qty: null, unit: 'to taste' }], 'to taste'],
  [[{ qty: null, unit: 'to taste' }, { qty: null, unit: 'to taste' }], 'to taste'],
  [[{ qty: 1, unit: 'tsp' }, { qty: null, unit: 'to taste' }], '1 tsp'],
  [[{ qty: null, unit: '' }], ''],
  [[{ qty: 2, unit: 'cup' }], '2 cups'],
];
let bad = 0;
for (const [items, want] of cases) {
  const got = U.mergeAmounts(items);
  if (got !== want) { bad++; console.log('FAIL', JSON.stringify(items), 'got', JSON.stringify(got), 'want', JSON.stringify(want)); }
}
console.log(bad ? bad + ' of ' + cases.length + ' failed' : 'all ' + cases.length + ' word amounts ok');
process.exit(bad ? 1 : 0);
