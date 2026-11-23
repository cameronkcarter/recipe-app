// Checks that everyday ingredients land in the right shopping-list aisle, so a new keyword can't
// quietly move another one (like "eggplant" once landing in dairy because of "egg").
// Run: node tests/ingredient-aisles.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { window: {} }; ctx.window.App = {}; ctx.App = ctx.window.App;
vm.createContext(ctx);
for (const f of ['icons.js', 'data.js', 'util.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const U = ctx.App.util;
// "name|qty|unit|note" when the amount or note matters (a spoon of "pepper" is black pepper)
const cases = {
  produce: ['eggplant','butternut squash','green beans','plum tomatoes','cauliflower','peas','asparagus','bok choy','arugula','leeks','mango','orange','pear','grapes','jalapeño','coriander','fresh thyme leaves','fresh basil','basil leaves','sage leaves','thyme|3|sprigs','rosemary||sprig','oregano|1|tbsp|fresh, chopped','basil|1|bunch','parsley','fresh parsley','mint leaves','chives','dill|2|tbsp|fresh','yellow onion','red bell peppers','2 peppers|2|','sweet potatoes','cilantro','limes','garlic','ginger','green onions','lemon juice'],
  dairy: ['salted butter','unsalted butter','goat cheese','eggs','parmesan cheese','sour cream','heavy cream','coconut yogurt','cream cheese','cheddar','greek yogurt','tofu'],
  pantry: ['dill pickles','cornmeal','powdered sugar','fish sauce','ketchup','mayo','mustard','yeast','baking soda','passata','coconut milk','coconut cream','black beans','diced tomatoes','chicken broth','vegetable stock','penne pasta','rolled oats','walnuts','peanut butter','tomato paste','maple syrup','unsweetened cocoa powder','water'],
  protein: ['lamb','ham','tuna','cod','chicken breast','skinless chicken thighs','ground beef','bacon','shrimp'],
  spices: ['dried oregano','dried thyme','oregano|2|tsp','thyme|1|tsp','basil|1|tsp','rosemary|1|tsp','sage|0.5|tsp','marjoram','tarragon','dill|1|tsp','bay leaves|2|','bay leaf','dried parsley','dried cilantro','dried mint','italian seasoning','herbes de provence','thyme|1|tsp|crushed','ground ginger','onion powder','garlic powder','black pepper','pepper|0.25|tsp','olive oil','kosher salt','smoked paprika','red wine vinegar','cayenne pepper','ground cumin','salt and pepper','crushed red pepper','tandoori masala powder','hot chilli powder'],
  bakery: ['naan bread','tortillas','crushed tortilla chips','baguette'],
  frozen: ['frozen peas','frozen corn'],
};
let bad = 0, n = 0;
for (const [want, list] of Object.entries(cases)) for (const c of list) {
  const [name, qty, unit, note] = c.split('|'); n++;
  const got = U.category({ name, qty: qty ? +qty : 1, unit: unit || '', note: note || '' });
  if (got !== want) { bad++; console.log(`✗ ${name}: ${got} (should be ${want})`); }
}
console.log(bad ? `${bad} of ${n} ingredients are in the wrong aisle.` : `All ${n} ingredients land in the right aisle.`);
process.exit(bad ? 1 : 0);
