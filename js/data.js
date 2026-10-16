// Static data: verbs, ingredient icons, store categories, and the starter recipe.
window.App = window.App || {};

// Each verb has an icon. "passive" verbs (simmer, bake, rest...) run on their own,
// so in co-op mode the chef is free to do something else while they happen.
App.VERBS = [
  // Prep
  { id: 'chop',     label: 'Chop',     icon: '🔪', group: 'Prep' },
  { id: 'dice',     label: 'Dice',     icon: '🔪', group: 'Prep' },
  { id: 'mince',    label: 'Mince',    icon: '🔪', group: 'Prep' },
  { id: 'slice',    label: 'Slice',    icon: '🔪', group: 'Prep' },
  { id: 'grate',    label: 'Grate',    icon: '🧀', group: 'Prep' },
  { id: 'peel',     label: 'Peel',     icon: '🥔', group: 'Prep' },
  { id: 'rinse',    label: 'Rinse',    icon: '💧', group: 'Prep' },
  { id: 'drain',    label: 'Drain',    icon: '🚰', group: 'Prep' },
  { id: 'measure',  label: 'Measure',  icon: '🥄', group: 'Prep' },
  // Mix
  { id: 'add',      label: 'Add',      icon: '➕', group: 'Mix' },
  { id: 'mix',      label: 'Mix',      icon: '🥣', group: 'Mix' },
  { id: 'stir',     label: 'Stir',     icon: '🥄', group: 'Mix' },
  { id: 'whisk',    label: 'Whisk',    icon: '🥣', group: 'Mix' },
  { id: 'fold',     label: 'Fold',     icon: '🥄', group: 'Mix' },
  { id: 'season',   label: 'Season',   icon: '🧂', group: 'Mix' },
  { id: 'pour',     label: 'Pour',     icon: '🫗', group: 'Mix' },
  { id: 'blend',    label: 'Blend',    icon: '🌀', group: 'Mix' },
  { id: 'mash',     label: 'Mash',     icon: '🥔', group: 'Mix' },
  { id: 'knead',    label: 'Knead',    icon: '👐', group: 'Mix' },
  { id: 'marinate', label: 'Marinate', icon: '⏳', group: 'Mix', passive: true },
  // Stove
  { id: 'heat',     label: 'Heat',     icon: '🔥', group: 'Stove' },
  { id: 'saute',    label: 'Sauté',    icon: '🍳', group: 'Stove' },
  { id: 'fry',      label: 'Fry',      icon: '🍳', group: 'Stove' },
  { id: 'sear',     label: 'Sear',     icon: '🍳', group: 'Stove' },
  { id: 'cook',     label: 'Cook',     icon: '🍳', group: 'Stove' },
  { id: 'boil',     label: 'Boil',     icon: '♨️', group: 'Stove', passive: true },
  { id: 'simmer',   label: 'Simmer',   icon: '♨️', group: 'Stove', passive: true },
  { id: 'pressure', label: 'Pressure cook', icon: '⏲️', group: 'Stove', passive: true },
  { id: 'steam',    label: 'Steam',    icon: '♨️', group: 'Stove', passive: true },
  { id: 'melt',     label: 'Melt',     icon: '🧈', group: 'Stove' },
  // Oven
  { id: 'preheat',  label: 'Preheat',  icon: '🌡️', group: 'Oven', passive: true },
  { id: 'bake',     label: 'Bake',     icon: '🧁', group: 'Oven', passive: true },
  { id: 'roast',    label: 'Roast',    icon: '🍗', group: 'Oven', passive: true },
  { id: 'broil',    label: 'Broil',    icon: '🔥', group: 'Oven', passive: true },
  { id: 'grill',    label: 'Grill',    icon: '🔥', group: 'Oven' },
  { id: 'toast',    label: 'Toast',    icon: '🍞', group: 'Oven' },
  // Finish
  { id: 'rest',     label: 'Rest',     icon: '⏸️', group: 'Finish', passive: true },
  { id: 'chill',    label: 'Chill',    icon: '❄️', group: 'Finish', passive: true },
  { id: 'cool',     label: 'Cool',     icon: '❄️', group: 'Finish', passive: true },
  { id: 'spread',   label: 'Spread',   icon: '🧈', group: 'Finish' },
  { id: 'top',      label: 'Top',      icon: '✨', group: 'Finish' },
  { id: 'garnish',  label: 'Garnish',  icon: '🌿', group: 'Finish' },
  { id: 'serve',    label: 'Serve',    icon: '🍽️', group: 'Finish' },
];
App.verb = id => App.VERBS.find(v => v.id === id) || { id, label: id, icon: '•' };

// Keyword → icon. Checked in order, so put specific phrases first.
App.ING_ICONS = [
  ['butternut', '🎃'], ['squash', '🎃'], ['pumpkin seed', '🌰'], ['pumpkin', '🎃'], ['sweet potato', '🍠'], ['green onion', '🌱'], ['scallion', '🌱'], ['bell pepper', '🫑'],
  ['chili powder', '🌶️'], ['black bean', '🫘'], ['olive oil', '🫒'], ['sour cream', '🥛'],
  ['cornbread', '🍞'], ['soy sauce', '🫗'], ['maple', '🍁'], ['peanut', '🥜'],
  ['ketchup', '🍅'], ['tomato', '🍅'], ['mustard', '🟡'], ['onion', '🧅'], ['garlic', '🧄'], ['shallot', '🧅'], ['potato', '🥔'],
  ['avocado', '🥑'], ['cilantro', '🌿'], ['parsley', '🌿'], ['basil', '🌿'], ['thyme', '🌿'],
  ['rosemary', '🌿'], ['sage', '🌿'], ['oregano', '🌿'], ['mint', '🌿'], ['dill', '🌿'],
  ['jalapeño', '🌶️'], ['jalapeno', '🌶️'], ['chili', '🌶️'], ['paprika', '🌶️'], ['cayenne', '🌶️'],
  ['salt', '🧂'], ['cumin', '🫙'], ['cinnamon', '🫙'], ['nutmeg', '🫙'], ['turmeric', '🫙'], ['curry', '🫙'], ['vanilla', '🫙'], ['pepper', '🧂'], ['bean', '🫘'], ['lentil', '🫘'], ['chickpea', '🫘'],
  ['broth', '🍲'], ['stock', '🍲'], ['water', '💧'], ['oil', '🫒'],
  ['butter', '🧈'], ['cheese', '🧀'], ['parmesan', '🧀'], ['milk', '🥛'], ['cream', '🥛'], ['yogurt', '🥛'],
  ['egg', '🥚'], ['flour', '🌾'], ['oat', '🌾'], ['sugar', '🍬'], ['honey', '🍯'],
  ['lemon', '🍋'], ['lime', '🍋'], ['orange', '🍊'], ['apple', '🍎'], ['banana', '🍌'], ['berr', '🫐'],
  ['chicken', '🍗'], ['turkey', '🍗'], ['beef', '🥩'], ['steak', '🥩'], ['pork', '🥓'], ['bacon', '🥓'], ['sausage', '🌭'],
  ['salmon', '🐟'], ['fish', '🐟'], ['tuna', '🐟'], ['shrimp', '🦐'], ['tofu', '⬜'],
  ['rice', '🍚'], ['pasta', '🍝'], ['spaghetti', '🍝'], ['noodle', '🍜'], ['tortilla', '🫓'], ['bread', '🍞'],
  ['corn', '🌽'], ['carrot', '🥕'], ['mushroom', '🍄'], ['broccoli', '🥦'], ['spinach', '🥬'], ['kale', '🥬'],
  ['lettuce', '🥬'], ['cabbage', '🥬'], ['cucumber', '🥒'], ['zucchini', '🥒'], ['eggplant', '🍆'], ['ginger', '🫚'],
  ['coconut', '🥥'], ['chocolate', '🍫'], ['wine', '🍷'], ['vinegar', '🫗'], ['nut', '🥜'],
];

// Store sections for the shopping list (in walking order).
App.CATEGORIES = [
  { id: 'produce', label: '🥬 Produce' },
  { id: 'protein', label: '🍗 Meat & protein' },
  { id: 'dairy',   label: '🥛 Dairy & fridge' },
  { id: 'bakery',  label: '🍞 Bakery' },
  { id: 'pantry',  label: '🥫 Pantry & cans' },
  { id: 'spices',  label: '🧂 Spices & oils' },
  { id: 'frozen',  label: '❄️ Frozen' },
  { id: 'other',   label: '🛒 Other' },
];
App.CAT_KEYWORDS = [
  ['spices', ['chili powder', 'powder', 'cumin', 'paprika', 'cayenne', 'cinnamon', 'oregano dried', 'salt', 'pepper flakes', 'black pepper', 'olive oil', 'oil', 'vinegar', 'vanilla', 'nutmeg', 'turmeric', 'curry']],
  ['pantry',  ['broth', 'stock', 'diced tomatoes', 'crushed tomatoes', 'tomato paste', 'tomato sauce', 'canned', 'bean', 'lentil', 'chickpea', 'rice', 'pasta', 'noodle', 'flour', 'sugar', 'honey', 'maple', 'soy sauce', 'oat', 'nut', 'coconut milk', 'chocolate']],
  ['dairy',   ['sour cream', 'butter', 'cheese', 'parmesan', 'mozzarella', 'cheddar', 'feta', 'ricotta', 'milk', 'cream', 'yogurt', 'egg', 'tofu']],
  ['bakery',  ['cornbread', 'bread', 'tortilla', 'bun', 'roll', 'bagel']],
  ['protein', ['chicken', 'beef', 'pork', 'bacon', 'sausage', 'turkey', 'salmon', 'fish', 'shrimp', 'steak']],
  ['frozen',  ['frozen']],
  ['produce', ['potato', 'onion', 'garlic', 'shallot', 'tomato', 'avocado', 'cilantro', 'parsley', 'basil', 'thyme', 'rosemary', 'mint', 'lemon', 'lime', 'pepper', 'jalapeño', 'carrot', 'celery', 'mushroom', 'broccoli', 'spinach', 'kale', 'lettuce', 'cabbage', 'cucumber', 'zucchini', 'ginger', 'apple', 'banana', 'berr', 'corn', 'scallion']],
];

// ---------- Starter recipe ----------
// Imported from https://www.noracooks.com/vegan-sweet-potato-black-bean-chili/
// "after" lists which steps must be done first (empty = can start any time).
// That's what lets co-op mode split the work between two chefs.
// Bump when the starter recipe changes so existing browsers pick up the new version.
App.SEED_VERSION = 3;
App.SEED_RECIPES = [
  {
    id: 'sweet-potato-chili',
    title: 'Sweet Potato Black Bean Chili',
    emoji: '🌶️',
    servings: 6,
    source: 'https://www.noracooks.com/vegan-sweet-potato-black-bean-chili/',
    tags: ['vegan', 'soup', 'weeknight'],
    ingredients: [
      { id: 'oil',     qty: 1.5, unit: 'tbsp',  name: 'olive oil' },
      { id: 'onion',   qty: 1,   unit: '',      name: 'onion', note: 'medium' },
      { id: 'garlic',  qty: 2,   unit: 'clove', name: 'garlic' },
      { id: 'sweet',   qty: 1,   unit: '',      name: 'sweet potato', note: 'large' },
      { id: 'chili',   qty: 2,   unit: 'tbsp',  name: 'chili powder', note: 'mild' },
      { id: 'cumin',   qty: 2,   unit: 'tsp',   name: 'cumin' },
      { id: 'paprika', qty: 2,   unit: 'tsp',   name: 'smoked paprika' },
      { id: 'salt',    qty: 1,   unit: 'tsp',   name: 'salt' },
      { id: 'tomato',  qty: 28,  unit: 'oz',    name: 'diced tomatoes', note: 'with juice', cat: 'pantry' },
      { id: 'beans',   qty: 2,   unit: 'can',   name: 'black beans', note: '15 oz' },
      { id: 'broth',   qty: 2,   unit: 'cup',   name: 'vegetable broth' },
      { id: 'avocado', qty: 1,   unit: '',      name: 'avocado', group: 'Toppings' },
      { id: 'cilantro', qty: null, unit: '',    name: 'cilantro', group: 'Toppings' },
      { id: 'green',   qty: null, unit: '',     name: 'green onions', group: 'Toppings' },
      { id: 'sour',    qty: null, unit: '',     name: 'vegan sour cream', group: 'Toppings' },
    ],
    // One knife step for all the prep; how each thing is cut lives in its note.
    steps: [
      { id: 's1', verb: 'chop',   uses: [{ ing: 'onion', note: 'medium, diced small' }, { ing: 'garlic', note: 'minced' }, { ing: 'sweet', note: 'large, peeled, ½" cubes' }, { ing: 'avocado' }, { ing: 'cilantro' }, { ing: 'green' }], after: [] },
      { id: 's2', verb: 'heat',   uses: [{ ing: 'oil' }], text: 'large pot', heat: 2, after: [] },
      { id: 's3', verb: 'saute',  uses: [{ ing: 'onion' }], text: 'until clear', heat: 2, time: 4, after: ['s1', 's2'] },
      { id: 's4', verb: 'add',    uses: [{ ing: 'garlic' }, { ing: 'sweet' }], heat: 2, time: 2, after: ['s3'] },
      { id: 's5', verb: 'season', uses: [{ ing: 'chili' }, { ing: 'cumin' }, { ing: 'paprika' }, { ing: 'salt' }], after: ['s4'] },
      { id: 's6', verb: 'add',    uses: [{ ing: 'tomato' }, { ing: 'beans', note: 'drained, rinsed' }, { ing: 'broth' }], after: ['s5'] },
      { id: 's7', verb: 'simmer', uses: [], text: 'uncovered', heat: 1, time: 20, after: ['s6'] },
      { id: 's8', verb: 'mash',   uses: [{ ing: 'sweet', note: 'some' }], text: 'optional', after: ['s7'] },
      { id: 's9', verb: 'serve',  uses: [{ ing: 'avocado' }, { ing: 'cilantro' }, { ing: 'green' }, { ing: 'sour' }], after: ['s8', 's1'] },
    ],
    notes: [],
  },
];

// One-time fixes to recipes imported before the converter followed the app's style
// (one knife step, prep as ingredient notes, no extra text). Applied once by store.js.
App.RECIPE_FIXES = {
  'instant-pot-butternut-squash-soup': {"emoji":"🍲","servings":6,"source":"https://www.thekitchn.com/instant-pot-butternut-squash-soup-recipe-23100726","ingredients":[{"id":"q1","qty":4,"unit":"lb","name":"butternut squash","note":"2 medium"},{"id":"q2","qty":1,"unit":"","name":"Granny Smith apple"},{"id":"q3","qty":1,"unit":"","name":"yellow onion"},{"id":"q4","qty":2,"unit":"tbsp","name":"olive oil"},{"id":"q5","qty":10,"unit":"","name":"sage leaves","note":"fresh"},{"id":"q6","qty":1,"unit":"box","name":"low-sodium vegetable broth","note":"32-ounce"},{"id":"q7","qty":2,"unit":"tsp","name":"kosher salt"},{"id":"q8","qty":0.25,"unit":"tsp","name":"freshly ground black pepper"},{"id":"q9","qty":0.333,"unit":"cup","name":"heavy cream"},{"id":"q10","qty":0.5,"unit":"cup","name":"toasted pumpkin seeds","group":"Toppings"}],"steps":[{"id":"qs1","verb":"chop","after":[],"uses":[{"ing":"q1","note":"peeled, seeds removed, 1\" chunks"},{"ing":"q2","note":"large, peeled, cored, diced"},{"ing":"q3","note":"medium, diced"}]},{"id":"qs2","verb":"heat","uses":[{"ing":"q4"}],"after":[]},{"id":"qs3","verb":"saute","uses":[{"ing":"q2"},{"ing":"q3"},{"ing":"q5"}],"text":"until softened","time":5,"after":["qs2","qs1"]},{"id":"qs4","verb":"add","uses":[{"ing":"q1"},{"ing":"q6"},{"ing":"q7"},{"ing":"q8"}],"after":["qs3","qs1"]},{"id":"qs5","verb":"pressure","uses":[],"time":10,"after":["qs4"]},{"id":"qs6","verb":"stir","uses":[{"ing":"q9"}],"after":["qs5"]},{"id":"qs7","verb":"blend","uses":[],"text":"until smooth","after":["qs6"]},{"id":"qs8","verb":"season","uses":[{"ing":"q7"},{"ing":"q8"}],"after":["qs7","qs5"]},{"id":"qs9","verb":"serve","uses":[{"ing":"q10"},{"ing":"q9"},{"ing":"q8"}],"after":["qs8","qs7"]}]},
};
