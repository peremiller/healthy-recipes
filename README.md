# 🌿 NourishPlan — Healthy Recipes & Meal Planner

A dependency-free, local-first web app for planning healthy meals and turning them into a smart grocery list. It uses vanilla JavaScript modules, `localStorage` for offline continuity, and optional authenticated Supabase sync for cross-device access, with clean Vercel routes for every main page.

**Live:** https://healthy-recipes-murex.vercel.app

## Features

- **🗓️ Menu Planner** — plan breakfast / lunch / dinner / snack across an optimized **week view** or focused **day view**. The rolling plan prevents a recipe from repeating on consecutive days. Any planned meal containing hummus or turkey shows a one-click ingredient-free alternative. Recurring Google Calendar meals stay in compact per-slot selectors, while a Today shortcut and mobile-first Day view make navigation faster.
- **🧊 3D Meal Map** — explore the selected week as an interactive, auto-rotating meal network at `/planner/visualization`. It reads the same live Planner data, supports meal-type filters and week navigation, and opens details for every plotted recipe.
- **🥗 Recipe Library** — 136 unique seeded recipes with search, meal-type filters, ingredients, and steps. The library includes six pulp-retaining, no-added-sugar juice recipes adapted from the supplied Diet Juice Recipes image; medically loaded labels remain searchable aliases rather than health claims. It also includes 68 deduplicated additions from six attached PDFs: four carrot/eye-supportive recipes, 12 cookbook recipes, 22 menu dishes, five pantry recipes, 10 canonical sandwich spreads, and 15 healthy food pairings. Close spread variants remain searchable aliases instead of duplicate cards. Twelve recipes are designed around steadier blood sugar, heart and vascular health, liver-friendly preparation, and cholesterol- and uric-acid-conscious choices. All 32 Google Calendar meal definitions are represented by 29 canonical calendar recipes. Every managed recipe uses real food photography matched to its meal type. Add / edit / delete your own recipes and optionally provide a custom photo URL.
- **🧺 Grocery Inventory** — track what you already have at home, with quantity steppers and units.
- **🛒 Grocery "Need" List** — automatically sums every ingredient across the planned week, **subtracts your inventory**, and shows exactly what to buy (`buy 2.25 cup · need 2.25 · have 0`). Items fully covered by inventory move to a separate "Covered" section. Check items off and one-tap **restock them into inventory**. Add non-recipe extras too.

Ingredient names and units are normalized (cups↔cup, tbsp, tsp, pc…) so the plan and inventory match correctly.

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
