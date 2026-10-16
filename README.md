# Recipe App (no name yet)

Simple, symbol-based recipes with co-op cooking, a shopping list, and a cook log.

## Run it
- Recommended: run the local server (needed for importing from links, "keep screen awake", and testing on your phone):
  ```
  node serve.js
  ```
  then open http://localhost:5173. Your phone on the same Wi-Fi can open `http://<your-computer-IP>:5173`.
- Quick look without importing: double-click `index.html`.

## Files
- `index.html` — page shell + bottom nav
- `css/styles.css` — all styling (light + dark mode)
- `js/data.js` — verb icons, ingredient icons, store sections, starter recipe
- `js/util.js` — amounts/units, ingredient-line parser, co-op scheduler
- `js/store.js` — saving (browser localStorage for now)
- `js/importer.js` — turns a recipe from a link or pasted text into symbol steps
- `js/ui.js` — timers, bottom sheets, step rendering, notes
- `js/edit.js` — inline edit mode (tap-to-change words, drag ingredients) and co-op swapping
- `js/views/` — one file per screen (library, recipe, shopping, log)
- `js/app.js` — router

## Adding recipes
Tap **+** → paste a link, paste recipe text, or start blank. Imports save right away and open in
edit mode. Link import tries, in order: the local server (`serve.js`, uses curl), then the free
Jina Reader (r.jina.ai) so it also works on the public site. Some sites block both — then paste the text.

## Editing
✏️ turns the recipe page into edit mode — no pop-ups. Ingredients become bubbles (they wiggle so it's
clear they move): drag one onto another step or onto + Add step; tap its words to type. Drag a step by its
number (or press-and-hold anywhere on it) to move it up or down. Tap the action word to pick another, tap
note/time to type, tap heat to cycle. The tapped step shows ✕ and + ingredient.
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
Recipes live in the browser you use. Use **Cook log → Download backup** to save a copy.
