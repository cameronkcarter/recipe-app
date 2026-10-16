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
  ['rosemary', '🌿'], ['oregano', '🌿'], ['mint', '🌿'], ['dill', '🌿'],
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
    // Grouped the way you'd actually cook it: all the chopping happens at once, etc.
    steps: [
      { id: 's1',  verb: 'dice',   uses: [{ ing: 'onion', note: 'small' }, { ing: 'garlic', note: 'minced' }, { ing: 'sweet', note: 'peeled, ½" cubes' }], after: [] },
      { id: 's2',  verb: 'rinse',  uses: [{ ing: 'beans', note: 'drained' }], after: [] },
      { id: 's3',  verb: 'heat',   uses: [{ ing: 'oil' }], text: 'large pot', heat: 2, after: [] },
      { id: 's4',  verb: 'saute',  uses: [{ ing: 'onion' }], text: 'until clear', heat: 2, time: 4, after: ['s1', 's3'] },
      { id: 's5',  verb: 'add',    uses: [{ ing: 'garlic' }, { ing: 'sweet' }], text: 'cook, stirring', heat: 2, time: 2, after: ['s4'] },
      { id: 's6',  verb: 'season', uses: [{ ing: 'chili' }, { ing: 'cumin' }, { ing: 'paprika' }, { ing: 'salt' }], text: 'stir in', after: ['s5'] },
      { id: 's7',  verb: 'add',    uses: [{ ing: 'tomato', note: 'with juice' }, { ing: 'beans' }, { ing: 'broth' }], text: 'stir', after: ['s2', 's6'] },
      { id: 's8',  verb: 'simmer', uses: [], text: 'uncovered, until potato is soft', heat: 1, time: 20, after: ['s7'], detail: '20–25 min total.' },
      { id: 's9',  verb: 'chop',   uses: [{ ing: 'avocado' }, { ing: 'cilantro' }, { ing: 'green' }], text: 'toppings', after: [] },
      { id: 's10', verb: 'mash',   uses: [{ ing: 'sweet', note: 'some' }], text: 'optional — makes it thicker', after: ['s8'], detail: 'Back of a spoon against the side of the pot.' },
      { id: 's11', verb: 'serve',  uses: [{ ing: 'avocado' }, { ing: 'cilantro' }, { ing: 'green' }, { ing: 'sour' }], text: 'top with', after: ['s9', 's10'] },
    ],
    notes: [],
  },
];
