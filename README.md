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
- `js/views/` — one file per screen (library, recipe, editor, shopping, log)
- `js/app.js` — router

## Adding recipes from a link
Tap **+** → paste a link. The local server (`serve.js`) downloads the page with `curl` and reads the
recipe data most sites embed; `js/importer.js` converts it into steps, and it opens in the editor to check.
Needs `node serve.js` running (not double-clicking index.html). Some sites block automated downloads —
then use **Paste recipe text** instead (also works with text copied from a photo of a printed recipe).

## How co-op works
Each step can say which earlier steps it needs ("Must happen after" in the editor).
The app tries splitting the steps between Chef A and Chef B and keeps the split that:
1. finishes the meal soonest,
2. gives both chefs a similar amount of hands-on work,
3. keeps one chef at the pot instead of handing it back and forth.
Passive steps (simmer, bake, rest) free the chef up while they run.
Group similar actions into one step (e.g. one "Dice" step for all the veg) — that's how
people actually cook, and it gives co-op cleaner jobs to hand out.

## Data
Recipes live in the browser you use. Use **Cook log → Download backup** to save a copy.
