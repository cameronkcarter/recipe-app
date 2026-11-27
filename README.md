# Recipe App (no name yet)

Simple, symbol-based recipes, your own recipe book, and a shopping list.

## Run it
- Recommended: run the local server (needed for importing from links, "keep screen awake", and testing on your phone):
  ```
  node serve.js
  ```
  then open http://localhost:5173. Your phone on the same Wi-Fi can open `http://<your-computer-IP>:5173`.
- Quick look without importing: double-click `index.html`.

## Checks
- `node tests/ingredient-icons.js` checks that ~90 everyday ingredients get the right icon. Run it after changing App.ING_ICONS.
- `node tests/ingredient-aisles.js` checks that ~95 everyday ingredients land in the right shopping aisle. Run it after changing App.CAT_WORDS.
- `node tests/import.js` runs the importer on test recipes (`tests/import/`, written in the styles real sites use) and checks every ingredient lands in a step. Run it after changing the importer (`-v` prints each result).

## Files
- `index.html` — page shell + bottom nav
- `css/styles.css` — all styling: kawaii theme (Fredoka + Nunito), cream with one brown accent, night mode
- `js/icons.js` — the app's own kawaii icon set (SVG), the made-it seal, and small button glyphs
- `js/data.js` — which icon each verb / ingredient / dish uses, store sections, starter recipe
- `js/util.js` — amounts/units, ingredient-line parser, shopping aisles, total time
- `js/store.js` — app data (with an offline copy in the browser)
- `js/sync.js` — shares data across devices through Firebase
- `js/importer.js` — turns a recipe from a link or pasted text into symbol steps
- `js/ui.js` — timers, bottom sheets, step rendering, notes
- `js/kitchen.js` — kitchen help: tap an ingredient, amount or oven temperature for other units, stand-ins and vegan or gluten-free swaps; "Make a vegan copy"
- `js/photos.js` — recipe photos (add, frame with buttons, shrink, save free in Firestore) and the drawn cover for recipes with no photo
- `js/sue.js` — Sue, the helper (a wooden spoon in a chef's hat): her setting, speech bubbles, and her panel on each recipe
- `js/edit.js` — inline edit mode (tap-to-change words, drag ingredients)
- `js/views/` — one file per screen (library = recipe book, recipe, shopping, search + person, builder = new recipe)

## Tabs and accounts
- **Search** (left): every recipe on the site, with filter chips for cooks and tags. "+ Filter" narrows by cook or tag; the heart saves a recipe to your book (with Undo).
- **My Recipes** (middle): your recipe book in one grid: **Mine** (ones you added) and **Saved** (other people's, tinted rose). Chips on top show the counts and filter.
- **Shopping** (right): your own shopping list.

The button at the top right of every page is **Log in** (or your picture once logged in): name and picture,
night mode, Log out. No passwords yet: logging in means picking your profile. Only the person who added a recipe
can edit it. Saving, adding recipes and the shopping list ask you to log in first.

## Style rules (the whole point of the app)
- Few words: no "more" paragraphs; steps read at a glance.
- ONE knife step: chop/dice/mince/peel together; each ingredient's note says how ("peeled, 1" cubes", "minced", "2 wedges, 2 chopped").
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

## Data
One shared set of recipes for the whole site, stored online in Firebase (Firestore) — every visitor and
device sees the same recipes and profiles, and each person has their own shopping list. No sign-in. Each browser also keeps a copy so the
app opens instantly and works offline (`js/sync.js`).

## Sue, the helper
Sue is a wooden spoon in a chef's hat (`App.icon('sue')`, also the tab icon and `icon-180.png` for the home screen).
Everything she says comes from simple rules and tables in the app; nothing is sent anywhere and nothing costs money.
- **Tone**: cute icon, grown-up words. Tips are one short, plain line; no greetings, no exclamation marks, no bouncing.
- **Setting** (account panel, or the bottom of her panel; saved on this device): **All tips**,
  **Check-in only** (only asks how it went after you cook), **Off** (no tips and no Sue button).
- **Her panel**: the spoon button at the top of a recipe. Sections plug in with `App.sue.section(id, fn)`.
- **Before you start**: long waits (marinate, chill, rise, overnight), when to turn the oven on, Instant Pot pressure time.
  With All tips on, the first one shows as one quiet line on the recipe page, once per visit.

## Kitchen help

Tap any ingredient, amount or oven temperature on a recipe (in the list or in a step) to see it in other units (tsp, tbsp, cups, ml; g, oz, lb; cups to grams for flour, sugar, butter and the like; °F and °C), plus a stand-in if you're out of it and vegan and gluten-free swaps. This works with Sue off too. Sue's panel adds "Out of something?" for the recipe's ingredients, "Make it vegan" (with a button that saves a vegan copy and leaves the original alone) and a measurements cheat sheet. All of it comes from small tables in `js/kitchen.js`.

## Photos
- One hero photo per recipe, added in the app by the cook who added the recipe: the camera button on the recipe's cover
  (cooking view or edit mode). The phone offers the camera or the photo library. The importer never takes photos from other sites.
- Framing uses zoom and nudge buttons (no dragging). Replace or remove from the same button, with Undo.
- Each photo is shrunk to 1200×800 (about 150 KB) and saved in Firestore, one document per photo
  (`photos/{recipeId}`), because Firebase Storage needs a card on file. The recipe keeps `photo: { at, thumb }`:
  `at` is the version and `thumb` a tiny copy so cards show instantly. Each device keeps its own copy (IndexedDB).
- No photo: a drawn cover in the recipe's color with a dot pattern and its icon on a plate.
