// Static data: verbs, ingredient icons, store categories, and the starter recipe.
window.App = window.App || {};

// Each verb has an icon. "passive" verbs (simmer, bake, rest...) run on their own,
// so in co-op mode the chef is free to do something else while they happen.
// A short list on purpose: one word per thing your hands actually do. How exactly (diced, minced,
// peeled, browned…) goes in the ingredient's note, not in a separate action.
App.VERBS = [
  // Prep
  { id: 'chop',     label: 'Chop',     icon: 'knife',    group: 'Prep' },
  { id: 'grate',    label: 'Grate',    icon: 'grater',   group: 'Prep' },
  { id: 'rinse',    label: 'Rinse',    icon: 'drop',     group: 'Prep' },
  { id: 'drain',    label: 'Drain',    icon: 'colander', group: 'Prep' },
  { id: 'marinate', label: 'Marinate', icon: 'hourglass', group: 'Prep', passive: true },
  // Mix
  { id: 'add',      label: 'Add',      icon: 'plus',     group: 'Mix' },
  { id: 'mix',      label: 'Mix',      icon: 'bowl',     group: 'Mix' },
  { id: 'season',   label: 'Season',   icon: 'salt',     group: 'Mix' },
  { id: 'blend',    label: 'Blend',    icon: 'blender',  group: 'Mix' },
  { id: 'mash',     label: 'Mash',     icon: 'masher',   group: 'Mix' },
  { id: 'shred',    label: 'Shred',    icon: 'fork',     group: 'Mix' },
  { id: 'knead',    label: 'Knead',    icon: 'dough',    group: 'Mix' },
  // Stove
  { id: 'heat',     label: 'Heat',     icon: 'flame',    group: 'Stove' },
  { id: 'saute',    label: 'Sauté',    icon: 'pan',      group: 'Stove' },
  { id: 'deglaze',  label: 'Deglaze',  icon: 'pitcher',  group: 'Stove' },
  { id: 'cook',     label: 'Cook',     icon: 'pot',      group: 'Stove' },
  { id: 'boil',     label: 'Boil',     icon: 'pot',      group: 'Stove', passive: true },
  { id: 'simmer',   label: 'Simmer',   icon: 'pot',      group: 'Stove', passive: true },
  { id: 'pressure', label: 'Pressure cook', icon: 'ip',  group: 'Stove', passive: true },
  // Oven
  { id: 'preheat',  label: 'Preheat',  icon: 'thermo',   group: 'Oven', passive: true },
  { id: 'bake',     label: 'Bake',     icon: 'oven',     group: 'Oven', passive: true },
  { id: 'broil',    label: 'Broil',    icon: 'flame',    group: 'Oven', passive: true },
  { id: 'grill',    label: 'Grill',    icon: 'grill',    group: 'Oven' },
  // Finish
  { id: 'rest',     label: 'Rest',     icon: 'hourglass', group: 'Finish', passive: true },
  { id: 'chill',    label: 'Chill',    icon: 'snow',     group: 'Finish', passive: true },
  { id: 'top',      label: 'Top',      icon: 'sparkle',  group: 'Finish' },
  { id: 'serve',    label: 'Serve',    icon: 'cloche',   group: 'Finish' },
];
// Actions from the longer, older list still show up right: each one maps to the action that replaced it.
App.VERB_ALIASES = {
  dice: 'chop', mince: 'chop', slice: 'chop', peel: 'chop', measure: 'add', pour: 'add',
  stir: 'mix', whisk: 'mix', fold: 'mix', fry: 'saute', sear: 'saute', brown: 'saute', steam: 'boil',
  melt: 'heat', roast: 'bake', toast: 'bake', cool: 'rest', spread: 'top', garnish: 'top',
};
App.verb = id => App.VERBS.find(v => v.id === (App.VERB_ALIASES[id] || id)) || { id, label: id, icon: 'cloche' };

// Keyword → icon name (see js/icons.js). Checked in order, so put specific phrases first.
App.ING_ICONS = [
  ['butternut', 'squash'], ['celery', 'celery'], ['red potato', 'redpotato'], ['bouillon', 'bouillon'], ['bullion', 'bouillon'], ['boullion', 'bouillon'], ['bouillion', 'bouillon'], ['boulion', 'bouillon'], ['bouleon', 'bouillon'], ['better than bouillon', 'bouillon'], ['white wine', 'wine'], ['cooking wine', 'wine'], ['squash', 'squash'], ['pumpkin seed', 'seeds'], ['pumpkin', 'pumpkin'], ['sweet potato', 'spud'], ['green onion', 'scallion'], ['scallion', 'scallion'],
  ['bell pepper', 'bellpep'], ['red pepper flake', 'chili'], ['black pepper', 'pepper'], ['coconut milk', 'can'],
  ['chili powder', 'jar'], ['black bean', 'bean'], ['olive oil', 'oil'], ['sour cream', 'tub'],
  ['cornbread', 'bread'], ['soy sauce', 'bottle'], ['maple', 'maple'], ['peanut', 'peanut'],
  ['diced tomato', 'can'], ['crushed tomato', 'can'], ['tomato paste', 'can'], ['tomato sauce', 'can'],
  ['ketchup', 'bottle'], ['tomato', 'tomato'], ['mustard', 'mustard'], ['onion', 'onion'], ['garlic', 'garlic'], ['shallot', 'onion'], ['potato', 'potato'],
  ['avocado', 'avo'], ['cilantro', 'herb'], ['parsley', 'herb'], ['basil', 'herb'], ['thyme', 'herb'],
  ['rosemary', 'herb'], ['sage', 'herb'], ['oregano', 'herb'], ['mint', 'herb'], ['dill', 'herb'], ['tyme', 'herb'], ['bay leaf', 'herb'], ['bay leaves', 'herb'],
  ['jalapeño', 'chili'], ['jalapeno', 'chili'], ['chili', 'chili'], ['paprika', 'jar'], ['cayenne', 'jar'],
  ['salt', 'salt'], ['cumin', 'jar'], ['cinnamon', 'jar'], ['nutmeg', 'jar'], ['turmeric', 'jar'], ['curry', 'jar'], ['vanilla', 'bottle'], ['pepper', 'pepper'], ['bean', 'bean'], ['lentil', 'bean'], ['chickpea', 'bean'],
  ['broth', 'carton'], ['stock', 'carton'], ['water', 'drop'], ['oil', 'oil'],
  ['butter', 'butter'], ['cheese', 'cheese'], ['parmesan', 'cheese'], ['milk', 'milk'], ['cream', 'milk'], ['yogurt', 'tub'],
  ['egg', 'egg'], ['flour', 'wheat'], ['oat', 'wheat'], ['sugar', 'sugar'], ['honey', 'honey'],
  ['lemon', 'lemon'], ['lime', 'lime'], ['orange', 'orange'], ['apple', 'apple'], ['banana', 'banana'], ['berr', 'berries'],
  ['chicken', 'drum'], ['turkey', 'drum'], ['beef', 'steak'], ['steak', 'steak'], ['pork', 'bacon'], ['bacon', 'bacon'], ['sausage', 'sausage'],
  ['salmon', 'fish'], ['fish', 'fish'], ['tuna', 'fish'], ['shrimp', 'shrimp'], ['tofu', 'tofu'],
  ['rice', 'rice'], ['pasta', 'noodle'], ['spaghetti', 'noodle'], ['noodle', 'noodle'], ['tortilla', 'tortilla'], ['bread', 'bread'],
  ['corn', 'corn'], ['carrot', 'carrot'], ['mushroom', 'mushroom'], ['broccoli', 'broccoli'], ['spinach', 'greens'], ['kale', 'greens'],
  ['lettuce', 'greens'], ['cabbage', 'greens'], ['cucumber', 'cucumber'], ['zucchini', 'cucumber'], ['eggplant', 'eggplant'], ['ginger', 'ginger'],
  ['coconut', 'coconut'], ['chocolate', 'choc'], ['wine', 'wine'], ['vinegar', 'bottle'], ['almond', 'nut'], ['walnut', 'nut'], ['pecan', 'nut'], ['nut', 'nut'],
];

// Dish words in a recipe title → the recipe's suggested icon.
App.DISH_ICONS = [['soup', 'pot'], ['stew', 'pot'], ['chili', 'chili'], ['curry', 'curry'], ['salad', 'salad'], ['pasta', 'noodle'], ['spaghetti', 'noodle'],
  ['noodle', 'noodle'], ['ramen', 'noodle'], ['pizza', 'pizza'], ['taco', 'taco'], ['burrito', 'taco'], ['burger', 'burger'], ['sandwich', 'toast'], ['toast', 'toast'],
  ['cake', 'cake'], ['cookie', 'cookie'], ['brownie', 'choc'], ['pie', 'pie'], ['bread', 'bread'], ['muffin', 'muffin'], ['pancake', 'pancake'], ['waffle', 'pancake'],
  ['rice', 'rice'], ['egg', 'friedegg'], ['chicken', 'drum'], ['salmon', 'fish'], ['shrimp', 'shrimp'], ['smoothie', 'smoothie']];

// Icons to pick from for a recipe, dishes first.
App.RECIPE_ICON_CHOICES = ['pot', 'chili', 'curry', 'salad', 'noodle', 'rice', 'pizza', 'taco', 'burger', 'toast', 'friedegg', 'pancake', 'muffin', 'cake', 'cookie', 'pie', 'choc',
  'bread', 'smoothie', 'ip', 'pan', 'oven', 'drum', 'steak', 'fish', 'shrimp', 'tofu', 'bean', 'squash', 'pumpkin', 'spud', 'potato', 'avo', 'tomato', 'carrot', 'broccoli',
  'mushroom', 'corn', 'greens', 'eggplant', 'bellpep', 'onion', 'garlic', 'lemon', 'apple', 'banana', 'berries', 'coconut', 'cheese', 'egg', 'cloche'];

// Recipes saved before the icon set used emoji; this maps those to the new icons.
App.EMOJI_ICONS = { '🎃': 'squash', '🌰': 'seeds', '🍠': 'spud', '🌱': 'scallion', '🫑': 'bellpep', '🌶': 'chili', '🫘': 'bean', '🫒': 'oil', '🥛': 'milk', '🍞': 'bread',
  '🫗': 'bottle', '🍁': 'maple', '🥜': 'peanut', '🍅': 'tomato', '🧅': 'onion', '🧄': 'garlic', '🥔': 'potato', '🥑': 'avo', '🌿': 'herb', '🧂': 'salt', '🫙': 'jar',
  '🍲': 'pot', '🧈': 'butter', '🧀': 'cheese', '🥚': 'egg', '🍯': 'honey', '🍋': 'lemon', '🍊': 'orange', '🍎': 'apple', '🍌': 'banana', '🫐': 'berries', '🍗': 'drum',
  '🥩': 'steak', '🥓': 'bacon', '🌭': 'sausage', '🐟': 'fish', '🦐': 'shrimp', '🍤': 'shrimp', '🍚': 'rice', '🍝': 'noodle', '🍜': 'noodle', '🫓': 'tortilla', '🌽': 'corn',
  '🥕': 'carrot', '🍄': 'mushroom', '🥦': 'broccoli', '🥬': 'greens', '🥒': 'cucumber', '🍆': 'eggplant', '🫚': 'ginger', '🥥': 'coconut', '🍫': 'choc', '🍷': 'wine',
  '🍛': 'curry', '🥗': 'salad', '🍕': 'pizza', '🌮': 'taco', '🌯': 'taco', '🍔': 'burger', '🥪': 'toast', '🍰': 'cake', '🍪': 'cookie', '🥧': 'pie', '🧁': 'muffin',
  '🥞': 'pancake', '🧇': 'pancake', '🍳': 'friedegg', '🥤': 'smoothie' };

// Colors for the blob behind a recipe's icon (and behind profile pictures).
App.BLOB_COLORS = ['#F27B5B', '#F2A33A', '#F6C945', '#82C25E', '#3BAA9C', '#5AAADB', '#9B7BD4', '#E88AA8', '#A8683A'];

// Profiles (no real log-in yet: each device picks who it is). Shared by everyone, like recipes.
App.SEED_PROFILES = [
  { id: 'cameron', name: 'Cameron Carter', avatar: 'avo', color: '#82C25E' },
  { id: 'ellen', name: 'Ellen Moffatt', avatar: 'squash', color: '#F2A33A' },
];
// Who added the recipes that existed before profiles.
App.SEED_AUTHORS = { 'sweet-potato-chili': 'cameron', 'instant-pot-butternut-squash-soup': 'cameron', 'pasted-recipe': 'ellen' };

// Store sections for the shopping list (in walking order).
App.CATEGORIES = [
  { id: 'produce', icon: 'greens', label: 'Produce' },
  { id: 'protein', icon: 'drum',   label: 'Meat & protein' },
  { id: 'dairy',   icon: 'milk',   label: 'Dairy & fridge' },
  { id: 'bakery',  icon: 'bread',  label: 'Bakery' },
  { id: 'pantry',  icon: 'can',    label: 'Pantry & cans' },
  { id: 'spices',  icon: 'salt',   label: 'Spices & oils' },
  { id: 'frozen',  icon: 'snow',   label: 'Frozen' },
  { id: 'other',   icon: 'basket', label: 'Other' },
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
    icon: 'chili',
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
  'instant-pot-butternut-squash-soup': {"icon":"ip","servings":6,"source":"https://www.thekitchn.com/instant-pot-butternut-squash-soup-recipe-23100726","ingredients":[{"id":"q1","qty":4,"unit":"lb","name":"butternut squash","note":"2 medium"},{"id":"q2","qty":1,"unit":"","name":"Granny Smith apple"},{"id":"q3","qty":1,"unit":"","name":"yellow onion"},{"id":"q4","qty":2,"unit":"tbsp","name":"olive oil"},{"id":"q5","qty":10,"unit":"","name":"sage leaves","note":"fresh"},{"id":"q6","qty":1,"unit":"box","name":"low-sodium vegetable broth","note":"32-ounce"},{"id":"q7","qty":2,"unit":"tsp","name":"kosher salt"},{"id":"q8","qty":0.25,"unit":"tsp","name":"freshly ground black pepper"},{"id":"q9","qty":0.333,"unit":"cup","name":"heavy cream"},{"id":"q10","qty":0.5,"unit":"cup","name":"toasted pumpkin seeds","group":"Toppings"}],"steps":[{"id":"qs1","verb":"chop","after":[],"uses":[{"ing":"q1","note":"peeled, seeds removed, 1\" chunks"},{"ing":"q2","note":"large, peeled, cored, diced"},{"ing":"q3","note":"medium, diced"}]},{"id":"qs2","verb":"heat","uses":[{"ing":"q4"}],"after":[]},{"id":"qs3","verb":"saute","uses":[{"ing":"q2"},{"ing":"q3"},{"ing":"q5"}],"text":"until softened","time":5,"after":["qs2","qs1"]},{"id":"qs4","verb":"add","uses":[{"ing":"q1"},{"ing":"q6"},{"ing":"q7"},{"ing":"q8"}],"after":["qs3","qs1"]},{"id":"qs5","verb":"pressure","uses":[],"time":10,"after":["qs4"]},{"id":"qs6","verb":"stir","uses":[{"ing":"q9"}],"after":["qs5"]},{"id":"qs7","verb":"blend","uses":[],"text":"until smooth","after":["qs6"]},{"id":"qs8","verb":"season","uses":[{"ing":"q7"},{"ing":"q8"}],"after":["qs7","qs5"]},{"id":"qs9","verb":"serve","uses":[{"ing":"q10"},{"ing":"q9"},{"ing":"q8"}],"after":["qs8","qs7"]}]},
};
