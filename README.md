# 🌿 NourishPlan — Healthy Recipes & Meal Planner

A local-first web app for planning healthy meals and turning them into a smart grocery list. Its browser uses vanilla JavaScript modules, `localStorage` for offline continuity, and optional authenticated Supabase sync for cross-device access, with clean Vercel routes for every main page. A small Node.js API evaluates nearby restaurants' published opening hours.

**Live:** https://healthy-recipes-murex.vercel.app

## Features

- **Nearby restaurants displayed directly** — one list in each planner timeslot shows actual restaurant names, straight-line distances, addresses, published hours and directions after **Use my location** or an explicit area selection. A server-bundled official merchant directory (812 Philippine McDonald’s and Denny’s branches, retrieved November 7, 2026) works without an API key or upstream availability. Ordinary schedules are evaluated in the venue's timezone. Open options appear first; when none are open, nearby names retain explicit unknown/closed labels. This is limited directory coverage, not a complete restaurant or exact-dish search. A configured Google Places key supplies wider live coverage, with the official directory as an outage fallback. Results expire after five minutes and clear offline. Previously granted location permission is reused at startup without prompting; GPS, results and manual area selections are never saved to meal-plan storage.
- **🗓️ Menu Planner** — plan breakfast / lunch / dinner / snack across an optimized **week view** or focused **day view**. Meals without an explicit blood-sugar-friendly tag show a diabetic-friendly alternative in the same slot, selected from tagged recipes of the same meal type. Suggestions preserve the original plan until tapped, respect adjacent-day repeat rules, and update calories and groceries through the normal saved-plan flow. No suggestion is inferred from a low-calorie or sugar-free label alone. The rolling plan prevents a recipe from repeating on consecutive days. Any planned meal containing hummus or turkey shows a one-click ingredient-free alternative. Recurring Google Calendar meals stay in compact per-slot selectors, while a Today shortcut and mobile-first Day view make navigation faster.
- **🧊 3D Meal Map** — explore the selected week as an interactive, auto-rotating meal network at `/planner/visualization`. It reads the same live Planner data, supports meal-type filters and week navigation, and opens details for every plotted recipe.
- **🥗 Recipe Library** — 152 unique seeded recipes with search, meal-type filters, ingredients, and steps. The library includes six pulp-retaining, no-added-sugar juice recipes adapted from the supplied Diet Juice Recipes image; medically loaded labels remain searchable aliases rather than health claims. It also includes 68 deduplicated additions from six attached PDFs: four carrot/eye-supportive recipes, 12 cookbook recipes, 22 menu dishes, five pantry recipes, 10 canonical sandwich spreads, and 15 healthy food pairings. Close spread variants remain searchable aliases instead of duplicate cards. Twelve recipes are designed around steadier blood sugar, heart and vascular health, liver-friendly preparation, and cholesterol- and uric-acid-conscious choices. All 32 Google Calendar meal definitions are represented by 29 canonical calendar recipes. All 152 managed recipes have individually matched and reviewed generated recipe illustrations, labeled clearly in the interface. Ten local WebP atlases total about 3.5 MB, work offline and are cropped without stretching in every planner, recipe, picker and 3D-map view. Changing ingredients or preparation invalidates the old image instead of substituting an unrelated photo. Custom photo URLs require a confirmation bound to the exact recipe and URL. Illustrations are not portion-measurement guides. Add / edit / delete your own recipes and optionally provide a custom photo URL.
- **🧺 Grocery Inventory** — track what you already have at home, with quantity steppers and units.
- **🛒 Grocery "Need" List** — automatically sums every ingredient across the planned week, **subtracts your inventory**, and shows exactly what to buy (`buy 2.25 cup · need 2.25 · have 0`). Items fully covered by inventory move to a separate "Covered" section. Check items off and one-tap **restock them into inventory**. Add non-recipe extras too.

Ingredient names and units are normalized (cups↔cup, tbsp, tsp, pc…) so the plan and inventory match correctly.

The recipe collection excludes citrus. Savory dishes use rice vinegar and herbs; teas and fruit drinks use ginger, mint, apple, pear or carrot. Existing device, cloud and imported data receive matching replacements while recipe IDs and planner links are preserved. Citrus pantry items and grocery extras are removed rather than relabeled as substitute stock. Unrecognized custom recipes containing citrus are removed. Recipe, inventory and grocery forms prevent citrus from being added again.

## Other

- Automatic **dark mode**, mobile-first layout.
- **Cross-device cloud sync** — email/password accounts sync recipes, planner selections, inventory, grocery extras, and completion state. The first signed-in device uploads its current local copy; later devices load the account's cloud copy.
- **Conflict protection** — monotonic revisions prevent a stale device from silently overwriting a newer cloud state. Visible tabs refresh from cloud every 30 seconds and on focus/reconnection.
- **Secure shared backend** — NourishPlan uses its own `nourishplan_states` table in Supabase with RLS, authenticated-only privileges, per-row ownership checks, and a 2 MB payload limit. No Reality Studio tables or records are shared.
- **localStorage** persistence — changes remain usable offline and queue for upload after reconnection.
- **JSON export / import / reset** in the ⋯ menu to move data between devices.

## Run locally

Serve the folder with any static web server:

```bash
python3 -m http.server 4630
# then visit http://localhost:4630
```

## Deploy

Zero-config static deploy on Vercel:

```bash
vercel --prod
```

## Nearby restaurant provider setup

Direct restaurant lists work immediately from the bundled official directory. Optional wider live Google coverage requires the owner’s restricted server-only `GOOGLE_PLACES_API_KEY` and Places API (New). No key or paid account was created. See `docs/nearby-restaurants-setup.md` for provenance, limits and verification.
