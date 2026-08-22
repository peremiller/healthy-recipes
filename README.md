# 🌿 NourishPlan — Healthy Recipes & Meal Planner

A single-file, offline-first web app for planning healthy meals and turning them into a smart grocery list. No build step, no dependencies — one `index.html` with vanilla JS and `localStorage`.

**Live:** https://healthy-recipes-murex.vercel.app

## Features

- **🗓️ Menu Planner** — plan breakfast / lunch / dinner / snack across a **week view** (7 day-cards with per-day and weekly calorie totals) or a focused **day view**. Tap any slot to add, change, or remove a recipe.
- **🥗 Recipe Library** — 16 seeded healthy recipes with search, meal-type filters, ingredients, and steps. Add / edit / delete your own.
- **🧺 Grocery Inventory** — track what you already have at home, with quantity steppers and units.
- **🛒 Grocery "Need" List** — automatically sums every ingredient across the planned week, **subtracts your inventory**, and shows exactly what to buy (`buy 2.25 cup · need 2.25 · have 0`). Items fully covered by inventory move to a separate "Covered" section. Check items off and one-tap **restock them into inventory**. Add non-recipe extras too.

Ingredient names and units are normalized (cups↔cup, tbsp, tsp, pc…) so the plan and inventory match correctly.

## Other

- Automatic **dark mode**, mobile-first layout.
- **localStorage** persistence (per-device) — survives reloads.
- **JSON export / import / reset** in the ⋯ menu to move data between devices.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 4630
# then visit http://localhost:4630
```

## Deploy

Zero-config static deploy on Vercel:

```bash
vercel --prod
```
