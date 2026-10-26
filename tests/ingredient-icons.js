// Checks that everyday ingredient names get the right icon, so a new keyword can't quietly break
// another one (like "sausage" once matching "sage"). Run: node tests/ingredient-icons.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { window: {} }; ctx.window.App = {}; ctx.App = ctx.window.App;
vm.createContext(ctx);
for (const f of ['icons.js', 'data.js', 'util.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const U = ctx.App.util;

const expect = {
  // meat & fish
  'sausage': 'sausage', '1 lb italian sausage': 'sausage', 'chicken breasts': 'drum', 'chicken thighs': 'drum', 'ground beef': 'steak', 'pork chops': 'bacon',
  'bacon': 'bacon', 'salmon fillets': 'fish', 'shrimp': 'shrimp', 'ground turkey': 'drum', 'pepperoni': 'sausage',
  // herbs & spices
  'sage leaves': 'herb', 'fresh thyme': 'herb', 'basil': 'herb', 'cilantro': 'herb', 'cumin': 'jar', 'smoked paprika': 'jar', 'black pepper': 'pepper', 'salt': 'salt',
  'kosher salt': 'salt', 'red pepper flakes': 'chili', 'cinnamon': 'jar', 'nutmeg': 'jar', 'chicken bouillon powder': 'bouillon', 'tyme': 'herb',
  // produce
  'yellow onion': 'onion', 'green onions': 'scallion', 'garlic cloves': 'garlic', 'celery': 'celery', 'carrots': 'carrot', 'red potatoes': 'redpotato',
  'sweet potato': 'spud', 'russet potatoes': 'potato', 'eggplant': 'eggplant', 'pineapple chunks': 'pineapple', 'apple': 'apple', 'cauliflower florets': 'cauliflower',
  'frozen peas': 'peas', 'green beans': 'greenbean', 'red thai chiles': 'chili', 'jalapeño': 'chili', 'bell pepper': 'bellpep', 'tomatoes': 'tomato', 'avocado': 'avo',
  'lemon juice': 'lemon', 'lime': 'lime', 'spinach': 'greens', 'mushrooms': 'mushroom', 'broccoli': 'broccoli', 'corn': 'corn', 'grapes': 'grapes', 'strawberries': 'strawberry',
  'kalamata olives': 'olive', 'butternut squash': 'squash', 'ginger': 'ginger', 'zucchini': 'cucumber',
  // dairy & eggs
  'parmesan cheese': 'cheese', 'parmesan': 'cheese', 'mozzarella': 'cheese', 'goat cheese': 'cheese', 'butter': 'butter', 'buttermilk': 'milk', 'heavy cream': 'milk',
  'sour cream': 'tub', 'greek yogurt': 'tub', 'eggs': 'egg',
  // pantry
  'olive oil': 'oil', 'sesame oil': 'oil', 'ziti': 'noodle', '16 oz ziti pasta noodles': 'noodle', 'penne': 'noodle', 'spaghetti': 'noodle', 'basmati rice': 'rice',
  'rice vinegar': 'bottle', 'soy sauce': 'bottle', 'fish sauce': 'bottle', 'coconut milk': 'can', 'diced tomatoes': 'can', 'tomato paste': 'can', 'black beans': 'bean',
  'chickpeas': 'bean', 'vegetable broth': 'carton', 'flour': 'wheat', 'rolled oats': 'wheat', 'cornstarch': 'jar', 'sugar': 'sugar', 'honey': 'honey', 'maple syrup': 'maple',
  'peanut butter': 'jar', 'walnuts': 'nut', 'white wine': 'wine', 'water': 'drop', 'tofu': 'tofu',
};
let bad = 0;
for (const [name, want] of Object.entries(expect)) {
  const got = U.ingIcon(name);
  if (got !== want) { bad++; console.log(`✗ "${name}" → ${got} (expected ${want})`); }
}
console.log(bad ? `${bad} of ${Object.keys(expect).length} wrong` : `All ${Object.keys(expect).length} ingredients get the right icon.`);
process.exit(bad ? 1 : 0);
