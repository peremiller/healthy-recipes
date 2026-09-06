# 🌿 NourishPlan — Healthy Recipes & Meal Planner

A dependency-free, offline-first web app for planning healthy meals and turning them into a smart grocery list. It uses vanilla JavaScript modules and `localStorage`, with clean Vercel routes for every main page.

**Live:** https://healthy-recipes-murex.vercel.app

## Features

- **🗓️ Menu Planner** — plan breakfast / lunch / dinner / snack across an optimized **week view** or focused **day view**. The rolling plan prevents a recipe from repeating on consecutive days. Any planned meal containing hummus shows a one-click, hummus-free alternative. Recurring Google Calendar meals stay in compact per-slot selectors, while a Today shortcut and mobile-first Day view make navigation faster.
- **🧊 3D Meal Map** — explore the selected week as an interactive, auto-rotating meal network at `/planner/visualization`. It reads the same live Planner data, supports meal-type filters and week navigation, and opens details for every plotted recipe.
- **🥗 Recipe Library** — 130 unique seeded recipes with search, meal-type filters, ingredients, and steps. The library includes 68 deduplicated additions from six attached PDFs: four carrot/eye-supportive recipes, 12 cookbook recipes, 22 menu dishes, five pantry recipes, 10 canonical sandwich spreads, and 15 healthy food pairings. Close spread variants remain searchable aliases instead of duplicate cards. Twelve recipes are designed around steadier blood sugar, heart and vascular health, liver-friendly preparation, and cholesterol- and uric-acid-conscious choices. All 32 Google Calendar meal definitions are represented by 29 canonical calendar recipes. Every managed recipe uses real food photography matched to its meal type. Add / edit / delete your own recipes and optionally provide a custom photo URL.
- **🧺 Grocery Inventory** — track what you already have at home, with quantity steppers and units.
- **🛒 Grocery "Need" List** — automatically sums every ingredient across the planned week, **subtracts your inventory**, and shows exactly what to buy (`buy 2.25 cup · need 2.25 · have 0`). Items fully covered by inventory move to a separate "Covered" section. Check items off and one-tap **restock them into inventory**. Add non-recipe extras too.

Ingredient names and units are normalized (cups↔cup, tbsp, tsp, pc…) so the plan and inventory match correctly.

## Other

- Automatic **dark mode**, mobile-first layout.
- **localStorage** persistence (per-device) — survives reloads.
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
