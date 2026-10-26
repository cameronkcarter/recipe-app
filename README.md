# Recipe App (no name yet)

Simple, symbol-based recipes with co-op cooking, your own recipe book, and a shopping list.

## Run it
- Recommended: run the local server (needed for importing from links, "keep screen awake", and testing on your phone):
  ```
  node serve.js
  ```
  then open http://localhost:5173. Your phone on the same Wi-Fi can open `http://<your-computer-IP>:5173`.
- Quick look without importing: double-click `index.html`.

## Checks
`node tests/ingredient-icons.js` checks that ~90 everyday ingredients get the right icon. Run it after changing App.ING_ICONS.

## Files
- `index.html` — page shell + bottom nav
- `css/styles.css` — all styling: kawaii theme (Fredoka + Nunito), night mode, a page tint per tab
- `js/icons.js` — the app's own kawaii icon set (SVG), the made-it seal, and small button glyphs
- `js/data.js` — which icon each verb / ingredient / dish uses, store sections, starter recipe
- `js/util.js` — amounts/units, ingredient-line parser, co-op scheduler
- `js/store.js` — app data (with an offline copy in the browser)
- `js/sync.js` — shares data across devices through Firebase
- `js/importer.js` — turns a recipe from a link or pasted text into symbol steps
- `js/ui.js` — timers, bottom sheets, step rendering, notes
- `js/edit.js` — inline edit mode (tap-to-change words, drag ingredients) and co-op swapping
- `js/views/` — one file per screen (library = recipe book, recipe, shopping, search + person, builder = new recipe)

## Tabs and accounts
- **Search** (left): every recipe on the site, with filter chips for cooks and tags. "+ Filter" narrows by cook or tag; the heart saves a recipe to your book (with Undo).
- **Recipes** (middle): your recipe book in one grid: **Mine** (ones you added) and **Saved** (other people's, tinted rose). Chips on top show the counts and filter.
- **Shopping** (right): your own shopping list.

The button at the top right of every page is **Log in** (or your picture once logged in): name and picture,
night mode, Log out. No passwords yet: logging in means picking your profile. Only the person who added a recipe
can edit it. Saving, adding recipes and the shopping list ask you to log in first.

## Style rules (the whole point of the app)
- Few words: no "more" paragraphs; steps read at a glance.
- ONE knife step: chop/dice/mince/peel together; each ingredient's note says how ("peeled, 1" cubes", "diced").
- Size / drained / prep notes live on the ingredient in the step ("2 cans black beans · drained, rinsed").
- Back-to-back same steps are combined; tips, options and storage advice are dropped.

## Saving a recipe
Save tidies the recipe the way a careful cook would: "until…/then…" notes move from the ingredient to the
step, misspelled ingredients get the usual spelling, amounts use the tidiest unit (6 tsp → 2 tbsp), a note like
"splash" becomes the amount, and the ingredient list follows the order of the steps.

## Adding recipes
Tap **+** → paste a link, paste recipe text, or **Start from scratch** (a guided builder: name and how it's cooked → steps one at a time, from standard steps like "Cook rice" or an action, with earlier ingredients ready to tap → review and save). Imports save right away and open in
edit mode. Link import tries, in order: the local server (`serve.js`, uses curl), then the free
Jina Reader (r.jina.ai) so it also works on the public site. Some sites block both — then paste the text.

## Editing
The pencil turns the recipe page into edit mode — no pop-ups. Ingredients become bubbles (they wiggle so it's
clear they move): drag one onto another step or onto + Add step; tap its words to type. Drag a step by its
number (or press-and-hold anywhere on it) to move it up or down. Tap the action word to pick another, tap
note/time to type, tap heat to cycle. The tapped step shows ✕, + note and + ingredient. Changes save on Done; Cancel discards them.
In co-op (normal view), tap a step number to swap chefs; ↺ Auto-split resets.

## How co-op works
Each step can say which earlier steps it needs (kept automatically when steps move).
The app tries splitting the steps between Chef A and Chef B and keeps the split that:
1. finishes the meal soonest,
2. gives both chefs a similar amount of hands-on work,
3. keeps one chef at the pot instead of handing it back and forth.
Passive steps (simmer, bake, rest) free the chef up while they run.
Group similar actions into one step (e.g. one "Dice" step for all the veg) — that's how
people actually cook, and it gives co-op cleaner jobs to hand out.

## Data
One shared set of recipes for the whole site, stored online in Firebase (Firestore) — every visitor and
device sees the same recipes, cook log and shopping list. No sign-in. Each browser also keeps a copy so the
app opens instantly and works offline (`js/sync.js`).
