"use strict";

import { haversineKm } from "./lib/geo.mjs";
import { fillRollingMealPlan, MEAL_TYPES } from "./lib/meal-plan.mjs";
import {
  CALENDAR_MEAL_DEFINITIONS,
  GOOGLE_CALENDAR_SOURCE,
  calendarMealNamesForDate
} from "./lib/calendar-meals.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));
const pad = (value) => String(value).padStart(2, "0");
const round1 = (value) => Math.round(value * 10) / 10;
const slugify = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0
});
const fmtPeso = (value) => pesoFormatter.format(Math.max(0, Math.round(Number(value) || 0)));

const INGREDIENT_COST_RULES = [
  { terms: ["salmon"], price: 150 },
  { terms: ["shrimp", "prawn"], price: 110 },
  { terms: ["beef"], price: 95 },
  { terms: ["tuna"], price: 85 },
  { terms: ["pork"], price: 75 },
  { terms: ["chicken", "turkey"], price: 60 },
  { terms: ["sardine", "bangus", "tilapia", "fish"], price: 55 },
  { terms: ["parmesan", "cheese"], price: 48 },
  { terms: ["avocado"], price: 45 },
  { terms: ["greek yogurt", "yogurt"], price: 38 },
  { terms: ["almond", "walnut", "cashew", "chia", "peanut"], price: 35 },
  { terms: ["tofu", "tokwa", "tempeh"], price: 28 },
  { terms: ["pasta", "spaghetti", "noodle", "bihon", "sotanghon"], price: 25 },
  { terms: ["oat", "barley", "adlai", "quinoa"], price: 22 },
  { terms: ["potato", "kamote", "sweet potato"], price: 22 },
  { terms: ["milk", "coconut milk"], price: 20 },
  { terms: ["rice", "bread", "tortilla"], price: 18 },
  { terms: ["pineapple", "mango", "apple", "banana", "berry", "papaya", "orange"], price: 18 },
  { terms: ["egg"], price: 12 },
  { terms: ["oil"], price: 10 },
  { terms: ["sauce", "vinegar", "broth", "juice"], price: 8 },
  { terms: ["garlic", "onion", "ginger", "pepper", "salt", "cinnamon", "powder"], price: 4 }
];

function ingredientCostEstimate(ingredient) {
  const name = String(ingredient?.name || "").toLowerCase();
  const unit = normUnit(ingredient?.unit);
  const quantity = Math.max(0, Number(ingredient?.qty) || 0);
  const rule = INGREDIENT_COST_RULES.find((candidate) => candidate.terms.some((term) => name.includes(term)));
  const referencePrice = rule?.price || 14;
  const factor = unit === "g"
    ? quantity / 100
    : unit === "kg"
      ? quantity * 10
      : unit === "tbsp"
        ? quantity / 6
        : unit === "tsp"
          ? quantity / 18
          : unit === "clove"
            ? quantity / 3
            : quantity;
  return referencePrice * Math.max(0.12, Math.min(3, factor || 0.12));
}

function mealCostPeso(item) {
  if (!item) return 0;
  const ingredientTotal = (item.ingredients || []).reduce((total, ingredient) => total + ingredientCostEstimate(ingredient), 0);
  return Math.max(35, Math.round((ingredientTotal + 8) / 5) * 5);
}

const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayISO = () => isoOf(new Date());
const dateFromISO = (iso) => new Date(`${iso}T00:00:00`);
const fmtDate = (iso) => dateFromISO(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtDow = (iso) => dateFromISO(iso).toLocaleDateString(undefined, { weekday: "short" });
const fmtLong = (iso) => dateFromISO(iso).toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric"
});
const fmtDateWithYear = (date = new Date()) => date.toLocaleDateString(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric"
});

function mondayOf(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

function weekDates(offset = 0) {
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    return isoOf(date);
  });
}

function toast(message) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  $("#toastRoot").appendChild(element);
  requestAnimationFrame(() => element.classList.add("visible"));
  setTimeout(() => {
    element.classList.remove("visible");
    setTimeout(() => element.remove(), 220);
  }, 2400);
}

const UNIT_ALIAS = {
  cups: "cup",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsps: "tsp",
  grams: "g",
  gram: "g",
  kilogram: "kg",
  pieces: "pc",
  piece: "pc",
  pcs: "pc",
  cans: "can",
  cloves: "clove",
  slices: "slice",
  heads: "head",
  bunches: "bunch",
  scoops: "scoop",
  liters: "l",
  liter: "l"
};
const KNOWN_UNITS = [
  "g", "kg", "ml", "l", "cup", "tbsp", "tsp", "oz", "lb", "pc", "can",
  "clove", "slice", "bunch", "head", "scoop", ...Object.keys(UNIT_ALIAS)
];
const normUnit = (unit) => {
  const normalized = String(unit || "").trim().toLowerCase();
  return UNIT_ALIAS[normalized] || normalized;
};
const normName = (name) => String(name || "").trim().toLowerCase().replace(/s$/, "");
const keyOf = (name, unit) => `${normName(name)}|${normUnit(unit)}`;

function allRecipeIngredients(recipes) {
  const catalog = new Map();
  (Array.isArray(recipes) ? recipes : []).forEach((recipeItem) => {
    const seenInRecipe = new Set();
    (Array.isArray(recipeItem.ingredients) ? recipeItem.ingredients : []).forEach((ingredient) => {
      const name = String(ingredient.name || "").trim();
      if (!name) return;
      const unit = normUnit(ingredient.unit);
      const key = keyOf(name, unit);
      if (!catalog.has(key)) {
        catalog.set(key, { key, name, unit, totalQty: 0, recipeCount: 0 });
      }
      const entry = catalog.get(key);
      entry.totalQty = round1(entry.totalQty + (Number(ingredient.qty) || 0));
      if (!seenInRecipe.has(key)) {
        entry.recipeCount += 1;
        seenInRecipe.add(key);
      }
    });
  });
  return [...catalog.values()].sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
}

function mergeRecipeIngredientsIntoInventory(recipes, inventory) {
  const merged = Array.isArray(inventory) ? inventory : [];
  const existingKeys = new Set(merged.map((item) => keyOf(item.name, item.unit)));
  allRecipeIngredients(recipes).forEach((ingredient) => {
    if (existingKeys.has(ingredient.key)) return;
    merged.push({ id: uid(), name: ingredient.name, qty: 0, unit: ingredient.unit });
    existingKeys.add(ingredient.key);
  });
  return merged;
}

function parseIngLine(line) {
  const text = line.trim();
  if (!text) return null;
  const match = text.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s+(.+)$/);
  if (!match) return { qty: 1, unit: "", name: text };
  const qty = match[1].includes("/")
    ? match[1].split("/").map(Number).reduce((a, b) => a / b)
    : Number(match[1]);
  const rest = match[2].trim();
  const firstSpace = rest.indexOf(" ");
  if (firstSpace > 0) {
    const first = rest.slice(0, firstSpace).toLowerCase();
    if (KNOWN_UNITS.includes(first)) {
      return { qty, unit: normUnit(first), name: rest.slice(firstSpace + 1).trim() };
    }
  }
  return { qty, unit: "", name: rest };
}

const ingToLine = (ingredient) => `${ingredient.qty} ${ingredient.unit ? `${ingredient.unit} ` : ""}${ingredient.name}`.trim();

const MEALS = MEAL_TYPES;
const MEAL_LABEL = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack"
};
const MEAL_ICON = {
  breakfast: "ph-sun-horizon",
  lunch: "ph-sun",
  dinner: "ph-moon-stars",
  snack: "ph-leaf"
};
const MEAL_VISUAL = {
  breakfast: { color: "#f2b84b", glow: "rgba(242, 184, 75, 0.35)" },
  lunch: { color: "#63c38b", glow: "rgba(99, 195, 139, 0.35)" },
  dinner: { color: "#91a5df", glow: "rgba(145, 165, 223, 0.35)" },
  snack: { color: "#e27d62", glow: "rgba(226, 125, 98, 0.35)" }
};
const CONTENT_VERSION = 10;

const PHOTOS = {
  oats: "https://images.unsplash.com/photo-1494390248081-4e521a5940db?auto=format&fit=crop&w=720&q=82",
  eggs: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=720&q=82",
  yogurt: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=720&q=82",
  salad: "https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&w=720&q=82",
  wrap: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=720&q=82",
  soup: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=720&q=82",
  salmon: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=720&q=82",
  tofu: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=720&q=82",
  chili: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=720&q=82",
  pesto: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=720&q=82",
  hummus: "https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=720&q=82",
  apple: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?auto=format&fit=crop&w=720&q=82",
  carbonara: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=720&q=82",
  pancakes: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=720&q=82",
  coconut: "https://images.unsplash.com/photo-1580984969071-a8da5656c2fb?auto=format&fit=crop&w=720&q=82",
  pancit: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=720&q=82",
  riceCake: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=720&q=82",
  adobo: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=720&q=82",
  oatmeal: "https://images.unsplash.com/photo-1497888329096-51c27beff665?auto=format&fit=crop&w=720&q=82",
  omelet: "https://images.unsplash.com/photo-1651442768184-a524a605c379?auto=format&fit=crop&w=720&q=82",
  filipinoSoup: "https://images.unsplash.com/photo-1534596382981-1974b10d4e1a?auto=format&fit=crop&w=720&q=82",
  proteinShake: "https://images.unsplash.com/photo-1775199603318-7f8a9a63b40d?auto=format&fit=crop&w=720&q=82",
  fishSalad: "https://images.unsplash.com/photo-1716816211582-ef70b1cd2e70?auto=format&fit=crop&w=720&q=82",
  salmonSweetPotato: "https://images.unsplash.com/photo-1602536959221-ebfb88533b4b?auto=format&fit=crop&w=720&q=82",
  chickenRice: "https://images.unsplash.com/photo-1670164747019-3b4d77128a71?auto=format&fit=crop&w=720&q=82",
  chiaPudding: "https://images.unsplash.com/photo-1651256785577-575d099f7223?auto=format&fit=crop&w=720&q=82",
  chickenSalad: "https://images.unsplash.com/photo-1781332149415-f420708ab98f?auto=format&fit=crop&w=720&q=82",
  salmonAvocado: "https://images.unsplash.com/photo-1777895816168-f9b6563826e5?auto=format&fit=crop&w=720&q=82",
  chickenVegetables: "https://images.unsplash.com/photo-1784902540665-f6ab6dfef921?auto=format&fit=crop&w=720&q=82",
  grilledChickenSalad: "https://images.unsplash.com/photo-1781332144017-776ef66c3ab9?auto=format&fit=crop&w=720&q=82",
  roastChickenSweetPotato: "https://images.unsplash.com/photo-1597377779407-51e50715cc7d?auto=format&fit=crop&w=720&q=82"
};
const IMAGE_BY_RECIPE = {
  "Overnight Oats with Berries": PHOTOS.oatmeal,
  "Veggie Egg Scramble": PHOTOS.omelet,
  "Greek Yogurt Parfait": PHOTOS.yogurt,
  "Quinoa Chickpea Salad": PHOTOS.salad,
  "Grilled Chicken Wrap": PHOTOS.wrap,
  "Hearty Lentil Soup": PHOTOS.soup,
  "Baked Salmon & Roasted Veggies": PHOTOS.salmon,
  "Tofu Stir-Fry with Brown Rice": PHOTOS.tofu,
  "Turkey & Bean Chili": PHOTOS.chili,
  "Zucchini Noodles with Pesto": PHOTOS.pesto,
  "Hummus & Veggie Sticks": PHOTOS.hummus,
  "Apple with Peanut Butter": PHOTOS.apple,
  "Healthy Carbonara": PHOTOS.carbonara,
  "Healthy Hot Pancakes": PHOTOS.pancakes,
  "Healthy Buko Coconut Bowl": PHOTOS.coconut,
  "Healthy Pancit Bihon": PHOTOS.pancit,
  "Healthy Rice Cake": PHOTOS.riceCake,
  "Healthy Chicken Adobo": PHOTOS.adobo,
  "Savory Oatmeal with Tofu & Pechay": PHOTOS.oatmeal,
  "Cherry Chia Yogurt Oats": PHOTOS.yogurt,
  "Malunggay Egg-White Omelet & Kamote": PHOTOS.omelet,
  "Monggo Malunggay Bowl": PHOTOS.filipinoSoup,
  "Tofu Pinakbet with Adlai": PHOTOS.tofu,
  "Lean Chicken Tinola Bowl": PHOTOS.filipinoSoup,
  "Calamansi Salmon with Okra & Barley": PHOTOS.salmonSweetPotato,
  "Tokwa Mushroom Sisig Lettuce Cups": PHOTOS.tofu,
  "Vegetable Kare-Kare with Brown Rice": PHOTOS.chili,
  "Apple Oat-Bran Yogurt Cup": PHOTOS.yogurt,
  "Green Papaya Cucumber Salad": PHOTOS.salad,
  "Soy Cacao Chia Pudding": PHOTOS.chiaPudding
};

const CALENDAR_PHOTO_BY_RECIPE = {
  "Breakfast (V-Taper Foundation)": PHOTOS.omelet,
  "Lunch (V-Taper Foundation)": PHOTOS.roastChickenSweetPotato,
  "Pre-Workout Snack (V-Taper Foundation)": PHOTOS.proteinShake,
  "Dinner (V-Taper Foundation)": PHOTOS.fishSalad,
  "Evening Snack (Sleep-Support)": PHOTOS.yogurt,
  "Breakfast (Recovery & Refine)": PHOTOS.omelet,
  "Lunch (Recovery & Refine)": PHOTOS.chickenSalad,
  "Mid-Afternoon Snack (Recovery & Refine)": PHOTOS.proteinShake,
  "Dinner (Sleep-Support Meal)": PHOTOS.salmonSweetPotato,
  "Evening Snack (Recovery & Refine)": PHOTOS.yogurt,
  "Breakfast: V-Taper Recovery Day": PHOTOS.omelet,
  "Lunch: V-Taper Recovery Day": PHOTOS.grilledChickenSalad,
  "Mid-Afternoon Snack: V-Taper Recovery Day": PHOTOS.proteinShake,
  "Dinner: Deep Sleep Support Meal": PHOTOS.salmon,
  "Evening Snack: V-Taper Recovery Day": PHOTOS.yogurt,
  "Breakfast: V-Taper Foundation Day": PHOTOS.omelet,
  "Breakfast (T-Boost)": PHOTOS.salmonAvocado,
  "Lunch: V-Taper Foundation Day": PHOTOS.chickenRice,
  "Lunch (T-Boost)": PHOTOS.chickenVegetables,
  "Pre-Workout Snack (T-Boost)": PHOTOS.apple,
  "Pre-Workout Snack: V-Taper Foundation Day": PHOTOS.proteinShake,
  "Dinner (T-Boost)": PHOTOS.salmonSweetPotato,
  "Dinner: V-Taper Foundation Day": PHOTOS.fishSalad,
  "Evening Snack: Sleep-Support": PHOTOS.yogurt,
  "Meal 1: The Breaking (Ghost Protocol)": PHOTOS.salmonAvocado,
  "Meal 2: The Monolith (Ghost Protocol)": PHOTOS.salmon,
  "Meal 3: The Restoration (Ghost Protocol)": PHOTOS.chickenSalad,
  "Breakfast: Accelerated 11% Cut": PHOTOS.omelet,
  "Lunch: Accelerated 11% Cut": PHOTOS.chickenVegetables,
  "Pre-Workout Snack: Accelerated 11% Cut": PHOTOS.proteinShake,
  "Dinner: Accelerated 11% Cut": PHOTOS.fishSalad,
  "Evening Snack: Accelerated 11% Cut": PHOTOS.yogurt
};

const MANAGED_PHOTO_URLS = new Set(Object.values(PHOTOS));
const MANAGED_RECIPE_NAMES = new Set([
  ...Object.keys(IMAGE_BY_RECIPE),
  ...CALENDAR_MEAL_DEFINITIONS.map((definition) => definition.name)
]);

function recipeNameKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recipeIngredientSignature(item) {
  const ingredients = (Array.isArray(item.ingredients) ? item.ingredients : [])
    .map((ingredient) => `${recipeNameKey(ingredient.name)}:${normUnit(ingredient.unit)}:${round1(Number(ingredient.qty) || 0)}`)
    .sort();
  return ingredients.length ? `${item.cat || "dinner"}|${ingredients.join("|")}` : "";
}

function dedupeRecipes(recipes) {
  const unique = [];
  const byName = new Map();
  const calendarByIngredients = new Map();
  const redirects = new Map();

  (Array.isArray(recipes) ? recipes : []).forEach((item) => {
    if (!item || !item.id || !String(item.name || "").trim()) return;
    const nameKey = recipeNameKey(item.name);
    const signature = item.source === "Google Calendar" ? recipeIngredientSignature(item) : "";
    const duplicate = byName.get(nameKey) || (signature ? calendarByIngredients.get(signature) : null);
    if (!duplicate) {
      item.aliases = [...new Set((item.aliases || []).filter(Boolean))];
      item.sourceNotes = [...new Set([...(item.sourceNotes || []), item.sourceNote].filter(Boolean))];
      unique.push(item);
      byName.set(nameKey, item);
      if (signature) calendarByIngredients.set(signature, item);
      return;
    }

    redirects.set(item.id, duplicate.id);
    duplicate.aliases = [...new Set([...(duplicate.aliases || []), item.name, ...(item.aliases || [])].filter(Boolean))];
    duplicate.sourceNotes = [...new Set([
      ...(duplicate.sourceNotes || []),
      duplicate.sourceNote,
      ...(item.sourceNotes || []),
      item.sourceNote
    ].filter(Boolean))];
    duplicate.tags = [...new Set([...(duplicate.tags || []), ...(item.tags || [])])];
  });

  return { recipes: unique, redirects };
}

function recipeImage(item) {
  if (!item) return "";
  if (item.visualMode === "custom" && item.image) return item.image;
  const mealFallback = PHOTOS[item.cat === "breakfast" ? "oatmeal" : item.cat === "lunch" ? "salad" : item.cat === "dinner" ? "tofu" : "apple"];
  return IMAGE_BY_RECIPE[item.name] || CALENDAR_PHOTO_BY_RECIPE[item.name] || item.image || mealFallback;
}

function recipe(name, cat, cal, time, tags, image, ingredients, steps) {
  return {
    id: uid(),
    name,
    cat,
    cal,
    time,
    tags,
    image,
    visualMode: "auto",
    ingredients: ingredients.map(([qty, unit, ingredientName]) => ({ qty, unit, name: ingredientName })),
    steps
  };
}

function calendarMealRecipes() {
  return CALENDAR_MEAL_DEFINITIONS.map((definition) => ({
    ...recipe(
      definition.name,
      definition.cat,
      definition.cal,
      definition.time,
      [...definition.tags, "estimated-calories"],
      PHOTOS[definition.imageKey] || PHOTOS.salad,
      definition.ingredients,
      definition.steps
    ),
    source: "Google Calendar",
    sourceCalendar: GOOGLE_CALENDAR_SOURCE,
    sourceNote: definition.calendarNote
  }));
}

function newHealthyRecipes() {
  return [
    recipe("Healthy Carbonara", "dinner", 450, 25, ["whole-grain", "vegetarian", "no-cream", "high-fiber"], PHOTOS.carbonara,
      [[60, "g", "whole-wheat spaghetti"], [1, "", "egg"], [0.25, "cup", "plain Greek yogurt"], [1, "cup", "button mushrooms"], [1, "cup", "baby spinach"], [0.25, "cup", "green peas"], [2, "tbsp", "grated parmesan"], [1, "tsp", "olive oil"], [1, "clove", "garlic"], [0.25, "tsp", "black pepper"]],
      ["Cook the whole-wheat spaghetti until al dente. Reserve half a cup of pasta water, then drain.", "Whisk the egg, Greek yogurt, parmesan and black pepper until smooth. Use a pasteurized egg when available.", "Heat olive oil in a pan. Sauté garlic and mushrooms for four to five minutes, then add peas and spinach until wilted.", "Add the drained spaghetti, toss, then remove the pan from the heat.", "Whisk two tablespoons of hot pasta water into the egg mixture. Pour it over the pasta while tossing continuously.", "Return to very low heat and toss for one to two minutes until the sauce is steaming and coats the pasta. Do not boil; add pasta water as needed."]),
    recipe("Healthy Hot Pancakes", "breakfast", 320, 20, ["whole-grain", "high-fiber", "no-refined-sugar", "quick"], PHOTOS.pancakes,
      [[0.5, "cup", "rolled oats"], [0.5, "pc", "ripe banana"], [1, "", "egg"], [0.25, "cup", "low-fat milk"], [0.5, "tsp", "baking powder"], [0.25, "tsp", "cinnamon"], [1, "tsp", "olive oil"], [0.25, "cup", "mixed berries"]],
      ["Blend the rolled oats into a fine flour.", "Mash the banana, then whisk it with the egg and low-fat milk.", "Stir in the oat flour, baking powder and cinnamon. Rest the batter for five minutes.", "Lightly coat a nonstick pan with olive oil and heat it over medium-low heat.", "Cook small pancakes for two to three minutes per side until golden and cooked through.", "Serve hot with mixed berries instead of syrup."]),
    recipe("Healthy Buko Coconut Bowl", "snack", 260, 10, ["no-added-sugar", "high-fiber", "refreshing", "vegetarian"], PHOTOS.coconut,
      [[0.5, "cup", "fresh buko meat"], [0.5, "cup", "unsweetened coconut water"], [0.5, "cup", "plain Greek yogurt"], [1, "tbsp", "chia seeds"], [0.25, "cup", "diced pineapple"], [0.25, "cup", "ice"]],
      ["Chill the buko meat, coconut water and Greek yogurt before assembling.", "Slice the fresh buko meat into thin strips.", "Stir the Greek yogurt, coconut water and chia seeds together until creamy.", "Fold in the buko strips and diced pineapple.", "Serve immediately over ice, or chill for 10 minutes to let the chia seeds thicken the bowl."]),
    recipe("Healthy Pancit Bihon", "lunch", 410, 30, ["high-protein", "veggie-packed", "lower-sodium", "Filipino"], PHOTOS.pancit,
      [[60, "g", "bihon noodles"], [80, "g", "skinless chicken breast"], [1, "cup", "cabbage"], [0.5, "cup", "carrot"], [0.5, "cup", "bell pepper"], [0.5, "cup", "snap peas"], [1, "tsp", "olive oil"], [1, "clove", "garlic"], [1, "tbsp", "low-sodium soy sauce"], [1, "cup", "unsalted chicken broth"], [1, "tbsp", "calamansi juice"]],
      ["Soak the bihon noodles according to package directions, then drain.", "Slice the chicken and vegetables thinly so they cook quickly and evenly.", "Heat olive oil in a wide pan. Sauté garlic and chicken until the chicken is fully cooked.", "Add cabbage, carrot, bell pepper and snap peas. Stir-fry for three to four minutes so the vegetables stay crisp.", "Pour in the unsalted broth and low-sodium soy sauce, then add the noodles.", "Toss until the noodles absorb the liquid. Finish with calamansi juice and serve hot."]),
    recipe("Healthy Rice Cake", "snack", 290, 40, ["Filipino", "gluten-free", "no-refined-sugar", "baked"], PHOTOS.riceCake,
      [[1, "cup", "brown rice flour"], [1, "tsp", "baking powder"], [1, "", "egg"], [0.75, "cup", "unsweetened light coconut milk"], [1, "tbsp", "honey"], [1, "tsp", "coconut oil"], [0.25, "cup", "fresh buko meat"], [0.25, "tsp", "cinnamon"]],
      ["Heat the oven to 180°C and lightly grease a small baking dish or four muffin cups with coconut oil.", "Whisk the brown rice flour, baking powder and cinnamon together in a bowl.", "In a separate bowl, whisk the egg, light coconut milk and honey until smooth.", "Fold the wet mixture into the dry ingredients just until combined, then stir in the sliced fresh buko meat.", "Pour into the prepared dish and bake for 24 to 28 minutes, until the center is set and the top is lightly golden.", "Cool for 10 minutes before slicing. Serve warm without additional syrup."]),
    recipe("Healthy Chicken Adobo", "dinner", 440, 40, ["Filipino", "high-protein", "lower-sodium", "no-added-sugar"], PHOTOS.adobo,
      [[150, "g", "skinless chicken breast"], [2, "tbsp", "low-sodium soy sauce"], [2, "tbsp", "cane vinegar"], [0.5, "cup", "water"], [2, "clove", "garlic"], [1, "pc", "bay leaf"], [0.25, "tsp", "black pepper"], [1, "tsp", "olive oil"], [1, "cup", "green beans"], [0.5, "cup", "brown rice"]],
      ["Marinate the chicken in low-sodium soy sauce, cane vinegar, garlic and black pepper for 10 minutes.", "Heat the olive oil in a pan over medium heat and brown the chicken on both sides.", "Pour in the marinade and water, then add the bay leaf.", "Cover and simmer for 12 to 15 minutes, until the chicken reaches 74°C in the thickest part.", "Add the green beans for the final four to five minutes, then uncover and reduce the sauce until lightly thickened.", "Discard the bay leaf and serve the adobo with cooked brown rice."])
  ];
}

const FOUR_GOAL_TAGS = Object.freeze([
  "steady-blood-sugar",
  "heart-healthy",
  "liver-friendly",
  "cholesterol-conscious",
  "uric-acid-conscious",
  "no-added-sugar",
  "estimated-calories"
]);

function healthGoalRecipes() {
  return [
    recipe("Savory Oatmeal with Tofu & Pechay", "breakfast", 300, 20, [...FOUR_GOAL_TAGS, "high-fiber", "plant-protein", "lower-sodium"], PHOTOS.oats,
      [[0.5, "cup", "rolled oats"], [100, "g", "firm tofu"], [1, "cup", "pechay"], [0.5, "cup", "tomato"], [1, "tsp", "olive oil"], [1, "clove", "garlic"], [1, "tsp", "low-sodium soy sauce"], [0.25, "tsp", "turmeric"], [0.25, "tsp", "black pepper"]],
      ["Cook the oats with one cup of water over medium-low heat until creamy, about five minutes.", "Pat the tofu dry, crumble it, and brown it in half of the olive oil for four to five minutes.", "Add the remaining oil, garlic, tomato and turmeric. Cook until the tomato softens.", "Fold in the pechay and low-sodium soy sauce, cooking just until the leaves wilt.", "Spoon the tofu and vegetables over the oats and finish with black pepper. Do not add sugar or salty toppings."]),
    recipe("Cherry Chia Yogurt Oats", "breakfast", 350, 8, [...FOUR_GOAL_TAGS, "high-fiber", "low-fat-dairy", "make-ahead"], PHOTOS.yogurt,
      [[0.33, "cup", "rolled oats"], [0.75, "cup", "plain low-fat Greek yogurt"], [0.5, "cup", "unsweetened tart cherries"], [1, "tbsp", "chia seeds"], [1, "tbsp", "ground flaxseed"], [0.25, "tsp", "cinnamon"], [0.25, "cup", "water"]],
      ["Stir the rolled oats, chia seeds, ground flaxseed and cinnamon together in a jar.", "Add the Greek yogurt and water, then mix until evenly combined.", "Fold in half of the unsweetened cherries.", "Cover and refrigerate for at least four hours or overnight.", "Top with the remaining cherries and serve without honey, syrup or sweetened granola."]),
    recipe("Malunggay Egg-White Omelet & Kamote", "breakfast", 290, 20, [...FOUR_GOAL_TAGS, "lean-protein", "vegetable-rich", "gluten-free"], PHOTOS.eggs,
      [[3, "", "egg white"], [1, "", "egg"], [1, "cup", "malunggay leaves"], [0.5, "cup", "tomato"], [0.25, "cup", "onion"], [1, "tsp", "olive oil"], [0.5, "cup", "roasted sweet potato"], [0.25, "tsp", "black pepper"]],
      ["Whisk the egg whites and whole egg with black pepper.", "Heat half of the olive oil in a nonstick pan and sauté the onion and tomato for three minutes.", "Add the malunggay leaves and cook until just wilted.", "Pour in the egg mixture and cook over low heat until set, folding once.", "Serve with the measured roasted sweet potato; skip ketchup and sweet sauces."]),
    recipe("Monggo Malunggay Bowl", "lunch", 350, 35, [...FOUR_GOAL_TAGS, "high-fiber", "plant-protein", "Filipino"], PHOTOS.soup,
      [[0.75, "cup", "cooked mung beans"], [1, "cup", "malunggay leaves"], [0.5, "cup", "squash"], [0.5, "cup", "tomato"], [0.25, "cup", "onion"], [1, "clove", "garlic"], [1, "cup", "unsalted vegetable broth"], [1, "tsp", "olive oil"], [0.33, "cup", "brown rice"], [0.25, "tsp", "black pepper"]],
      ["Heat the olive oil and sauté the onion, garlic and tomato until softened.", "Add the squash and unsalted broth, then simmer until the squash is almost tender.", "Stir in the cooked mung beans and simmer for eight to ten minutes.", "Fold in the malunggay leaves for the final two minutes and season with black pepper.", "Serve with one-third cup cooked brown rice. Keep the dish meat-free and do not add bagoong or processed meat."]),
    recipe("Tofu Pinakbet with Adlai", "lunch", 370, 30, [...FOUR_GOAL_TAGS, "plant-protein", "vegetable-rich", "lower-sodium", "Filipino"], PHOTOS.tofu,
      [[120, "g", "firm tofu"], [1, "cup", "eggplant"], [0.75, "cup", "okra"], [0.75, "cup", "squash"], [0.5, "cup", "sitaw"], [0.5, "cup", "tomato"], [0.25, "cup", "onion"], [1, "tsp", "canola oil"], [1, "tsp", "low-sodium soy sauce"], [0.5, "cup", "cooked adlai"]],
      ["Pat the tofu dry, cube it, and brown it in half of the canola oil. Set aside.", "Add the remaining oil, onion and tomato to the pan and cook until softened.", "Add the squash with a splash of water, cover, and cook for four minutes.", "Add the eggplant, okra and sitaw. Cook until tender-crisp, then return the tofu.", "Season with one teaspoon low-sodium soy sauce and serve over the measured adlai. This version intentionally omits bagoong."]),
    recipe("Lean Chicken Tinola Bowl", "lunch", 340, 40, [...FOUR_GOAL_TAGS, "lean-protein", "vegetable-rich", "lower-sodium", "Filipino"], PHOTOS.soup,
      [[100, "g", "skinless chicken breast"], [1, "cup", "sayote"], [1, "cup", "malunggay leaves"], [1, "tsp", "ginger"], [0.25, "cup", "onion"], [1, "clove", "garlic"], [1.5, "cup", "unsalted chicken broth"], [1, "tsp", "olive oil"], [0.33, "cup", "brown rice"], [1, "tbsp", "calamansi juice"]],
      ["Heat the olive oil and sauté the ginger, onion and garlic until fragrant.", "Add the chicken breast and cook until the outside is no longer pink.", "Pour in the unsalted broth and simmer gently for 12 minutes.", "Add the sayote and cook until tender, then fold in the malunggay leaves for two minutes.", "Check that the chicken reaches 74°C, finish with calamansi juice, and serve with one-third cup cooked brown rice."]),
    recipe("Calamansi Salmon with Okra & Barley", "dinner", 460, 35, [...FOUR_GOAL_TAGS, "omega-3", "high-fiber", "moderate-fish-portion"], PHOTOS.salmon,
      [[120, "g", "salmon fillet"], [0.5, "cup", "cooked pearl barley"], [1, "cup", "okra"], [1, "cup", "broccoli"], [1, "tsp", "olive oil"], [1, "tbsp", "calamansi juice"], [1, "tsp", "ginger"], [0.25, "tsp", "black pepper"]],
      ["Heat the oven to 200°C and line a tray with parchment.", "Arrange the salmon, okra and broccoli on the tray. Brush with olive oil and season with ginger and black pepper.", "Bake for 12 to 15 minutes, until the salmon flakes and reaches 63°C.", "Warm the cooked barley with a splash of water.", "Finish the salmon and vegetables with calamansi juice and serve with the measured barley. Keep the fish portion to 120 grams."]),
    recipe("Tokwa Mushroom Sisig Lettuce Cups", "dinner", 310, 30, [...FOUR_GOAL_TAGS, "plant-protein", "lower-sodium", "Filipino"], PHOTOS.tofu,
      [[150, "g", "firm tofu"], [1, "cup", "button mushrooms"], [0.5, "cup", "red bell pepper"], [0.25, "cup", "red onion"], [1, "tbsp", "calamansi juice"], [1, "tsp", "low-sodium soy sauce"], [1, "tsp", "olive oil"], [4, "pc", "lettuce leaves"], [0.33, "cup", "brown rice"], [0.25, "tsp", "black pepper"]],
      ["Pat the tofu dry, crumble it, and brown it in a nonstick pan with half of the olive oil.", "Add the remaining oil and mushrooms, cooking until their moisture evaporates.", "Stir in the bell pepper and red onion and cook for two minutes so they retain some crunch.", "Remove from heat and mix in the calamansi juice, low-sodium soy sauce and black pepper.", "Spoon into lettuce leaves and serve with one-third cup cooked brown rice. Do not add mayonnaise or processed meat."]),
    recipe("Vegetable Kare-Kare with Brown Rice", "dinner", 410, 45, [...FOUR_GOAL_TAGS, "plant-protein", "high-fiber", "lower-sodium", "Filipino"], PHOTOS.tofu,
      [[120, "g", "firm tofu"], [1, "cup", "eggplant"], [0.75, "cup", "sitaw"], [1, "cup", "pechay"], [0.75, "cup", "squash"], [1, "tbsp", "unsweetened peanut butter"], [1, "tbsp", "brown rice flour"], [1, "tsp", "canola oil"], [1, "clove", "garlic"], [0.25, "cup", "onion"], [1, "cup", "unsalted vegetable broth"], [0.33, "cup", "brown rice"]],
      ["Brown the cubed tofu in half of the canola oil and set aside.", "Sauté the garlic and onion in the remaining oil, then add the squash and unsalted broth.", "Whisk the peanut butter and brown rice flour with a little warm broth, then stir the mixture into the pot.", "Add the eggplant and sitaw and simmer until tender; return the tofu and fold in the pechay.", "Serve with one-third cup cooked brown rice. Skip bagoong to keep sodium lower."]),
    recipe("Apple Oat-Bran Yogurt Cup", "snack", 200, 5, [...FOUR_GOAL_TAGS, "high-fiber", "low-fat-dairy", "quick"], PHOTOS.apple,
      [[0.5, "pc", "apple"], [0.75, "cup", "plain low-fat Greek yogurt"], [2, "tbsp", "oat bran"], [1, "tbsp", "ground flaxseed"], [0.25, "tsp", "cinnamon"]],
      ["Dice the apple, keeping the peel for added fiber.", "Spoon the plain low-fat Greek yogurt into a bowl.", "Stir in the oat bran and ground flaxseed.", "Top with the apple and cinnamon and serve immediately without honey or syrup."]),
    recipe("Green Papaya Cucumber Salad", "snack", 120, 10, [...FOUR_GOAL_TAGS, "vegetable-rich", "lower-sodium", "refreshing"], PHOTOS.salad,
      [[1, "cup", "shredded green papaya"], [1, "cup", "cucumber"], [0.5, "cup", "tomato"], [1, "tbsp", "calamansi juice"], [1, "tbsp", "unsalted roasted peanuts"], [1, "tsp", "olive oil"], [0.25, "tsp", "black pepper"]],
      ["Combine the shredded green papaya, cucumber and tomato in a bowl.", "Whisk the calamansi juice, olive oil and black pepper.", "Toss the vegetables with the dressing and let them stand for five minutes.", "Top with unsalted roasted peanuts and serve chilled. Do not add sugar, fish sauce or bagoong."]),
    recipe("Soy Cacao Chia Pudding", "snack", 230, 5, [...FOUR_GOAL_TAGS, "plant-protein", "high-fiber", "make-ahead"], PHOTOS.yogurt,
      [[1, "cup", "unsweetened soy milk"], [2, "tbsp", "chia seeds"], [1, "tbsp", "unsweetened cocoa powder"], [0.25, "cup", "mixed berries"], [0.25, "tsp", "cinnamon"], [0.5, "tsp", "vanilla extract"]],
      ["Whisk the soy milk, chia seeds, cocoa powder, cinnamon and vanilla until no cocoa lumps remain.", "Rest for five minutes, whisk again, then cover.", "Refrigerate for at least four hours or overnight.", "Stir before serving and top with the mixed berries. Keep it unsweetened; do not add syrup or condensed milk."])
  ];
}

function seed() {
  const rawRecipes = [
    recipe("Overnight Oats with Berries", "breakfast", 320, 5, ["high-fiber", "make-ahead"], PHOTOS.oats,
      [[0.5, "cup", "rolled oats"], [0.75, "cup", "almond milk"], [1, "tbsp", "chia seeds"], [0.5, "cup", "mixed berries"], [1, "tsp", "honey"]],
      ["Combine oats, milk, chia seeds and honey in a jar.", "Refrigerate overnight for at least four hours.", "Top with berries before serving."]),
    recipe("Veggie Egg Scramble", "breakfast", 290, 15, ["high-protein", "vegetarian"], PHOTOS.eggs,
      [[3, "", "egg"], [0.5, "cup", "spinach"], [0.25, "cup", "bell pepper"], [0.25, "cup", "onion"], [1, "tsp", "olive oil"]],
      ["Sauté onion and pepper in olive oil for three minutes.", "Add spinach until wilted.", "Add beaten eggs and scramble until just set."]),
    recipe("Greek Yogurt Parfait", "breakfast", 280, 5, ["high-protein", "quick"], PHOTOS.yogurt,
      [[1, "cup", "greek yogurt"], [0.25, "cup", "granola"], [0.5, "cup", "mixed berries"], [1, "tsp", "honey"]],
      ["Layer yogurt, granola and berries in a glass.", "Drizzle with honey."]),
    recipe("Quinoa Chickpea Salad", "lunch", 420, 20, ["vegetarian", "meal-prep"], PHOTOS.salad,
      [[0.75, "cup", "quinoa"], [1, "can", "chickpeas"], [1, "cup", "cucumber"], [1, "cup", "cherry tomatoes"], [2, "tbsp", "olive oil"], [1, "tbsp", "lemon juice"], [0.25, "cup", "feta cheese"]],
      ["Cook quinoa and let it cool.", "Chop cucumber and halve tomatoes.", "Toss everything with olive oil and lemon juice."]),
    recipe("Grilled Chicken Wrap", "lunch", 450, 20, ["high-protein"], PHOTOS.wrap,
      [[150, "g", "chicken breast"], [1, "pc", "whole-wheat tortilla"], [0.5, "cup", "lettuce"], [0.25, "cup", "tomato"], [2, "tbsp", "greek yogurt"], [1, "tsp", "olive oil"]],
      ["Season and grill chicken for five to six minutes per side, then slice.", "Spread yogurt on the tortilla and add lettuce, tomato and chicken.", "Roll tightly and halve."]),
    recipe("Hearty Lentil Soup", "lunch", 380, 35, ["vegan", "high-fiber", "batch-cook"], PHOTOS.soup,
      [[1, "cup", "red lentils"], [1, "pc", "carrot"], [1, "pc", "celery stalk"], [0.5, "cup", "onion"], [2, "clove", "garlic"], [4, "cup", "vegetable broth"], [1, "tbsp", "olive oil"], [1, "tsp", "cumin"]],
      ["Sauté onion, carrot, celery and garlic in oil.", "Add lentils, cumin and broth, then simmer for 25 minutes.", "Season and serve."]),
    recipe("Baked Salmon & Roasted Veggies", "dinner", 520, 30, ["omega-3", "high-protein"], PHOTOS.salmon,
      [[180, "g", "salmon fillet"], [1, "cup", "broccoli"], [1, "pc", "zucchini"], [1, "cup", "sweet potato"], [2, "tbsp", "olive oil"], [1, "pc", "lemon"]],
      ["Toss vegetables with oil and roast at 200°C for 15 minutes.", "Add salmon, squeeze lemon over it, and bake for 12 to 14 minutes more."]),
    recipe("Tofu Stir-Fry with Brown Rice", "dinner", 470, 25, ["vegan", "high-protein"], PHOTOS.tofu,
      [[200, "g", "firm tofu"], [0.75, "cup", "brown rice"], [1, "cup", "broccoli"], [0.5, "cup", "bell pepper"], [2, "tbsp", "soy sauce"], [1, "tbsp", "sesame oil"], [1, "clove", "garlic"], [1, "tsp", "ginger"]],
      ["Cook brown rice.", "Pan-fry cubed tofu until golden.", "Stir-fry vegetables with garlic and ginger, then add tofu and soy sauce.", "Serve over rice."]),
    recipe("Turkey & Bean Chili", "dinner", 480, 40, ["high-protein", "batch-cook"], PHOTOS.chili,
      [[300, "g", "ground turkey"], [1, "can", "kidney beans"], [1, "can", "diced tomatoes"], [0.5, "cup", "onion"], [2, "clove", "garlic"], [1, "tbsp", "chili powder"], [1, "tsp", "cumin"], [1, "tbsp", "olive oil"]],
      ["Brown turkey with onion and garlic in oil.", "Add spices, beans and tomatoes.", "Simmer for 25 to 30 minutes."]),
    recipe("Zucchini Noodles with Pesto", "dinner", 390, 20, ["low-carb", "vegetarian"], PHOTOS.pesto,
      [[2, "pc", "zucchini"], [3, "tbsp", "pesto"], [1, "cup", "cherry tomatoes"], [2, "tbsp", "parmesan"], [1, "tbsp", "pine nuts"], [1, "tsp", "olive oil"]],
      ["Spiralize zucchini into noodles.", "Sauté for two minutes in olive oil.", "Toss with pesto and tomatoes, then top with parmesan and pine nuts."]),
    recipe("Hummus & Veggie Sticks", "snack", 180, 5, ["vegan", "quick"], PHOTOS.hummus,
      [[0.33, "cup", "hummus"], [1, "pc", "carrot"], [1, "pc", "celery stalk"], [0.5, "cup", "bell pepper"]],
      ["Cut vegetables into sticks.", "Serve with hummus."]),
    recipe("Apple with Peanut Butter", "snack", 210, 2, ["quick"], PHOTOS.apple,
      [[1, "pc", "apple"], [2, "tbsp", "peanut butter"]],
      ["Slice the apple.", "Serve with peanut butter for dipping."]),
    ...newHealthyRecipes(),
    ...healthGoalRecipes(),
    ...calendarMealRecipes()
  ];
  const { recipes } = dedupeRecipes(rawRecipes);

  const byName = (name) => recipes.find((item) => item.name === name).id;
  const dates = weekDates(0);
  const menus = [
    ["Overnight Oats with Berries", "Quinoa Chickpea Salad", "Baked Salmon & Roasted Veggies", "Apple with Peanut Butter"],
    ["Greek Yogurt Parfait", "Hearty Lentil Soup", "Tofu Stir-Fry with Brown Rice", "Hummus & Veggie Sticks"],
    ["Veggie Egg Scramble", "Grilled Chicken Wrap", "Turkey & Bean Chili", "Apple with Peanut Butter"],
    ["Overnight Oats with Berries", "Hearty Lentil Soup", "Zucchini Noodles with Pesto", "Hummus & Veggie Sticks"],
    ["Greek Yogurt Parfait", "Quinoa Chickpea Salad", "Tofu Stir-Fry with Brown Rice", null]
  ];
  const plan = {};
  dates.forEach((date, index) => {
    if (!menus[index]) return;
    plan[date] = {
      breakfast: byName(menus[index][0]),
      lunch: byName(menus[index][1]),
      dinner: byName(menus[index][2]),
      snack: menus[index][3] ? byName(menus[index][3]) : null
    };
  });
  const completedPlan = fillRollingMealPlan({ plan, recipes, weeks: 4, meals: MEALS }).plan;

  return {
    seeded: true,
    contentVersion: CONTENT_VERSION,
    recipes,
    plan: completedPlan,
    inventory: mergeRecipeIngredientsIntoInventory(recipes, [
      { id: uid(), name: "rolled oats", qty: 3, unit: "cup" },
      { id: uid(), name: "greek yogurt", qty: 2, unit: "cup" },
      { id: uid(), name: "olive oil", qty: 16, unit: "tbsp" },
      { id: uid(), name: "brown rice", qty: 2, unit: "cup" },
      { id: uid(), name: "egg", qty: 6, unit: "" },
      { id: uid(), name: "quinoa", qty: 1, unit: "cup" },
      { id: uid(), name: "honey", qty: 10, unit: "tsp" },
      { id: uid(), name: "soy sauce", qty: 8, unit: "tbsp" }
    ]),
    extras: [],
    checked: {}
  };
}

const LS = "nourishplan.v2";
const LEGACY_LS = "nourishplan.v1";

function normalize(data) {
  const normalized = data || {};
  normalized.recipes = Array.isArray(normalized.recipes) ? normalized.recipes : [];
  if (!normalized.recipes.length) normalized.recipes = seed().recipes;
  normalized.inventory = Array.isArray(normalized.inventory) ? normalized.inventory : [];
  normalized.extras = Array.isArray(normalized.extras) ? normalized.extras : [];
  normalized.plan = normalized.plan && typeof normalized.plan === "object" ? normalized.plan : {};
  normalized.checked = normalized.checked && typeof normalized.checked === "object" ? normalized.checked : {};
  const previousContentVersion = Number(normalized.contentVersion) || 0;
  if (previousContentVersion < 6) {
    const existingNames = new Set(normalized.recipes.map((item) => String(item.name || "").trim().toLowerCase()));
    newHealthyRecipes().forEach((item) => {
      if (existingNames.has(item.name.toLowerCase())) return;
      normalized.recipes.push(item);
      existingNames.add(item.name.toLowerCase());
    });
  }
  if (previousContentVersion < 7) {
    const existingNames = new Set(normalized.recipes.map((item) => String(item.name || "").trim().toLowerCase()));
    calendarMealRecipes().forEach((item) => {
      if (existingNames.has(item.name.toLowerCase())) return;
      normalized.recipes.push(item);
      existingNames.add(item.name.toLowerCase());
    });
  }
  if (previousContentVersion < 9) {
    const existingNames = new Set(normalized.recipes.map((item) => recipeNameKey(item.name)));
    healthGoalRecipes().forEach((item) => {
      const nameKey = recipeNameKey(item.name);
      if (existingNames.has(nameKey)) return;
      normalized.recipes.push(item);
      existingNames.add(nameKey);
    });
  }
  normalized.contentVersion = CONTENT_VERSION;
  normalized.recipes.forEach((item) => {
    item.ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];
    item.steps = Array.isArray(item.steps) ? item.steps : [];
    item.tags = Array.isArray(item.tags) ? item.tags : [];
    item.cat = item.cat || "dinner";
    const fallbackImage = IMAGE_BY_RECIPE[item.name]
      || PHOTOS[item.cat === "breakfast" ? "oats" : item.cat === "lunch" ? "salad" : item.cat === "dinner" ? "tofu" : "apple"];
    item.image = !item.image || item.image.includes("photo-1467003909585-2f8a7270028?") ? fallbackImage : item.image;
    if (!item.visualMode || (previousContentVersion < 8 && (MANAGED_RECIPE_NAMES.has(item.name) || MANAGED_PHOTO_URLS.has(item.image)))) {
      item.visualMode = MANAGED_RECIPE_NAMES.has(item.name) || MANAGED_PHOTO_URLS.has(item.image) ? "auto" : "custom";
    }
  });
  const deduped = dedupeRecipes(normalized.recipes);
  normalized.recipes = deduped.recipes;
  Object.values(normalized.plan).forEach((dayPlan) => {
    if (!dayPlan || typeof dayPlan !== "object") return;
    MEALS.forEach((meal) => {
      if (deduped.redirects.has(dayPlan[meal])) dayPlan[meal] = deduped.redirects.get(dayPlan[meal]);
    });
  });
  normalized.inventory = mergeRecipeIngredientsIntoInventory(normalized.recipes, normalized.inventory);
  normalized.plan = fillRollingMealPlan({
    plan: normalized.plan,
    recipes: normalized.recipes,
    weeks: 4,
    meals: MEALS
  }).plan;
  return normalized;
}

function boot() {
  try {
    const raw = localStorage.getItem(LS) || localStorage.getItem(LEGACY_LS);
    if (raw) return normalize(JSON.parse(raw));
  } catch {}
  return normalize(seed());
}

let state = boot();
localStorage.setItem(LS, JSON.stringify(state));
const save = () => localStorage.setItem(LS, JSON.stringify(state));

function keepRollingMealPlanComplete() {
  const completed = fillRollingMealPlan({
    plan: state.plan,
    recipes: state.recipes,
    weeks: 4,
    meals: MEALS
  });
  if (!completed.filled) return false;
  state.plan = completed.plan;
  save();
  return true;
}

const STORE_SOURCES = {
  marketplace: "https://themarketplace.com.ph/our-stores",
  sm: "https://smmarkets.ph/store-hours",
  landers: "https://www.landers.ph/store",
  robinsons: "https://www.robinsonssupermarket.com.ph/"
};

const STORES = [
  {
    id: "marketplace-central-square",
    name: "The Marketplace — Central Square",
    address: "Basement 1, Central Square, Bonifacio High Street, Taguig",
    lat: 14.5509,
    lng: 121.0512,
    hours: "9:00 AM–10:00 PM",
    source: STORE_SOURCES.marketplace,
    items: ["rolled oats", "almond milk", "chia seeds", "mixed berries", "honey", "greek yogurt", "granola", "quinoa", "chickpeas", "cucumber", "cherry tomatoes", "olive oil", "lemon juice", "feta cheese", "red lentils", "carrot", "celery stalk", "onion", "garlic", "vegetable broth", "cumin", "salmon fillet", "broccoli", "zucchini", "sweet potato", "lemon", "firm tofu", "brown rice", "bell pepper", "soy sauce", "sesame oil", "ginger", "apple", "peanut butter", "hummus"]
  },
  {
    id: "sm-supermarket-aura",
    name: "SM Supermarket — Aura",
    address: "SM Aura Premier, 26th Street, Bonifacio Global City, Taguig",
    lat: 14.5467,
    lng: 121.0548,
    hours: "9:00 AM–9:00 PM",
    source: STORE_SOURCES.sm,
    items: ["rolled oats", "almond milk", "chia seeds", "mixed berries", "honey", "egg", "spinach", "bell pepper", "onion", "olive oil", "greek yogurt", "granola", "quinoa", "chickpeas", "cucumber", "cherry tomatoes", "lemon juice", "feta cheese", "chicken breast", "whole-wheat tortilla", "lettuce", "tomato", "red lentils", "carrot", "celery stalk", "garlic", "vegetable broth", "cumin", "salmon fillet", "broccoli", "zucchini", "sweet potato", "lemon", "firm tofu", "brown rice", "soy sauce", "ginger", "apple", "peanut butter", "hummus"]
  },
  {
    id: "marketplace-uptown",
    name: "The Marketplace — Uptown Mall",
    address: "Lower Ground Floor, Uptown Mall, 36th Street, BGC, Taguig",
    lat: 14.5568,
    lng: 121.0535,
    hours: "10:00 AM–10:00 PM weekdays",
    source: STORE_SOURCES.marketplace,
    items: ["rolled oats", "almond milk", "chia seeds", "mixed berries", "honey", "greek yogurt", "granola", "quinoa", "chickpeas", "cucumber", "cherry tomatoes", "olive oil", "lemon juice", "feta cheese", "chicken breast", "whole-wheat tortilla", "lettuce", "tomato", "red lentils", "carrot", "celery stalk", "onion", "garlic", "vegetable broth", "cumin", "salmon fillet", "broccoli", "zucchini", "sweet potato", "lemon", "firm tofu", "brown rice", "bell pepper", "soy sauce", "sesame oil", "ginger", "apple", "peanut butter", "hummus"]
  },
  {
    id: "landers-bgc",
    name: "Landers Superstore — BGC",
    address: "Uptown Palazzo, 9th Avenue corner 36th Street, BGC, Taguig",
    lat: 14.5575,
    lng: 121.0542,
    hours: "9:00 AM–9:00 PM",
    source: STORE_SOURCES.landers,
    items: ["rolled oats", "almond milk", "chia seeds", "mixed berries", "honey", "egg", "spinach", "bell pepper", "onion", "olive oil", "greek yogurt", "granola", "quinoa", "chickpeas", "cucumber", "cherry tomatoes", "lemon juice", "feta cheese", "chicken breast", "whole-wheat tortilla", "lettuce", "tomato", "red lentils", "carrot", "celery stalk", "garlic", "vegetable broth", "cumin", "salmon fillet", "broccoli", "zucchini", "sweet potato", "lemon", "firm tofu", "brown rice", "soy sauce", "sesame oil", "ginger", "apple", "peanut butter", "hummus", "pine nuts", "parmesan", "pesto"]
  },
  {
    id: "marketplace-venice",
    name: "The Marketplace — Venice Grand Canal",
    address: "Ground Floor, Venice Grand Canal Mall, McKinley Hill, Taguig",
    lat: 14.5349,
    lng: 121.0501,
    hours: "8:00 AM–10:00 PM Mon–Thu",
    source: STORE_SOURCES.marketplace,
    items: ["rolled oats", "almond milk", "honey", "egg", "spinach", "bell pepper", "onion", "olive oil", "greek yogurt", "granola", "quinoa", "chickpeas", "cucumber", "cherry tomatoes", "lemon juice", "chicken breast", "whole-wheat tortilla", "lettuce", "tomato", "red lentils", "carrot", "celery stalk", "garlic", "vegetable broth", "cumin", "salmon fillet", "broccoli", "zucchini", "sweet potato", "lemon", "firm tofu", "brown rice", "soy sauce", "ginger", "apple", "peanut butter", "hummus"]
  },
  {
    id: "robinsons-easymart-mckinley",
    name: "Robinsons Easymart — McKinley",
    address: "McKinley Hill, Fort Bonifacio, Taguig",
    lat: 14.5358,
    lng: 121.0483,
    hours: "Store hours vary",
    source: STORE_SOURCES.robinsons,
    items: ["rolled oats", "almond milk", "honey", "egg", "spinach", "bell pepper", "onion", "olive oil", "greek yogurt", "granola", "quinoa", "chickpeas", "cucumber", "cherry tomatoes", "lemon juice", "chicken breast", "lettuce", "tomato", "red lentils", "carrot", "celery stalk", "garlic", "vegetable broth", "cumin", "broccoli", "zucchini", "sweet potato", "lemon", "firm tofu", "brown rice", "soy sauce", "ginger", "apple", "peanut butter", "hummus"]
  }
].map((store) => ({ ...store, itemKeys: new Set(store.items.map(normName)) }));

let plannerMode = typeof window !== "undefined" && window.matchMedia?.("(max-width: 650px)").matches ? "day" : "week";
let weekOffset = 0;
let dayDate = todayISO();
let recipeQuery = "";
let recipeCat = "all";
let storeSort = "nearest";
const grocerySections = {
  toBuy: true,
  covered: true,
  ingredients: true
};
const mealViz = {
  yaw: -0.62,
  pitch: -0.24,
  zoom: 720,
  autoRotate: !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  filter: "all",
  selectedKey: "root",
  raf: 0,
  resizeObserver: null,
  hitNodes: [],
  images: new Map(),
  drag: null
};
let userLocation = {
  lat: 14.552,
  lng: 121.0487,
  label: "Bonifacio Global City",
  source: "fallback",
  accuracy: null,
  timestamp: null
};
let activeLocationRequest = null;
const LOCATION_TARGET_ACCURACY_METERS = 25;
const LOCATION_MAX_USABLE_ACCURACY_METERS = 250;
const LOCATION_SAMPLE_WINDOW_MS = 15000;

const NAV = [
  { key: "planner", path: "/planner", label: "Planner", icon: "ph-calendar-blank" },
  { key: "meal-map", path: "/planner/visualization", label: "3D Meal Map", icon: "ph-cube" },
  { key: "recipes", path: "/recipes", label: "Recipes", icon: "ph-bowl-food" },
  { key: "inventory", path: "/inventory", label: "Inventory", icon: "ph-archive" },
  { key: "grocery", path: "/grocery", label: "Grocery", icon: "ph-shopping-cart-simple" },
  { key: "stores", path: "/stores", label: "Nearby Stores", icon: "ph-map-pin" }
];

function recipeById(id) {
  return state.recipes.find((item) => item.id === id) || null;
}

function recipePath(item) {
  return `/recipes/${slugify(item.name)}-${item.id}`;
}

function planFor(date) {
  return state.plan[date] || {};
}

function calendarRecipesFor(date, meal) {
  const names = calendarMealNamesForDate(date)[meal] || [];
  const seen = new Set();
  return names.map((name) => state.recipes.find((item) => item.name === name || (item.aliases || []).includes(name)))
    .filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function renderCalendarMealOptions(date, meal, primaryRecipeId = null) {
  const items = calendarRecipesFor(date, meal).filter((item) => item.id !== primaryRecipeId);
  if (!items.length) return "";
  return `<button class="calendar-meal-trigger" type="button" data-calendar-options="${date}|${meal}" aria-label="View ${items.length} Google Calendar meal ${items.length === 1 ? "option" : "options"} for ${MEAL_LABEL[meal]} on ${fmtLong(date)}">
    ${icon("ph-calendar-check")}<span>${items.length} calendar ${items.length === 1 ? "option" : "options"}</span>${icon("ph-caret-right")}
  </button>`;
}

function calendarRecipeCountForDates(dates) {
  const ids = new Set();
  dates.forEach((date) => MEALS.forEach((meal) => calendarRecipesFor(date, meal).forEach((item) => ids.add(item.id))));
  return ids.size;
}

function calendarMealPickerModal(date, meal) {
  const items = calendarRecipesFor(date, meal);
  const currentId = planFor(date)[meal];
  openModal(`<h2>Calendar meals · ${fmtDow(date)} ${fmtDate(date)}</h2><p class="modal-subtitle">Choose the ${MEAL_LABEL[meal].toLowerCase()} that should count toward your plan. Other calendar meals remain available here.</p>
    <div class="calendar-picker-list">${items.map((item) => `<button class="calendar-picker-row ${item.id === currentId ? "selected" : ""}" type="button" data-use-calendar-recipe="${item.id}" ${item.id === currentId ? "disabled" : ""}>
      <img src="${esc(recipeImage(item))}" alt="" /><span><strong>${esc(item.name)}</strong><small>${item.cal} kcal · ${fmtPeso(mealCostPeso(item))} est. · ${item.time} min${item.id === currentId ? " · Currently planned" : ""}</small></span>${item.id === currentId ? icon("ph-check-circle") : icon("ph-arrow-right")}
    </button>`).join("")}</div>`);
  $$('[data-use-calendar-recipe]').forEach((button) => button.addEventListener("click", () => {
    if (!state.plan[date]) state.plan[date] = {};
    state.plan[date][meal] = button.dataset.useCalendarRecipe;
    save();
    closeModal();
    render();
    toast(`${MEAL_LABEL[meal]} updated from Google Calendar`);
  }));
}

function dayCalories(date) {
  return MEALS.reduce((total, meal) => {
    const item = recipeById(planFor(date)[meal]);
    return total + (item ? Number(item.cal) || 0 : 0);
  }, 0);
}

function dayCost(date) {
  return MEALS.reduce((total, meal) => total + mealCostPeso(recipeById(planFor(date)[meal])), 0);
}

function weekNeeds(dates = weekDates(weekOffset)) {
  const map = {};
  dates.forEach((date) => {
    MEALS.forEach((meal) => {
      const item = recipeById(planFor(date)[meal]);
      if (!item) return;
      item.ingredients.forEach((ingredient) => {
        const key = keyOf(ingredient.name, ingredient.unit);
        if (!map[key]) map[key] = { name: ingredient.name, unit: normUnit(ingredient.unit), need: 0 };
        map[key].need += Number(ingredient.qty) || 0;
      });
    });
  });
  return map;
}

function inventoryByKey() {
  return state.inventory.reduce((map, item) => {
    const key = keyOf(item.name, item.unit);
    map[key] = (map[key] || 0) + (Number(item.qty) || 0);
    return map;
  }, {});
}

function groceryData() {
  const dates = weekDates(weekOffset);
  const needs = weekNeeds(dates);
  const have = inventoryByKey();
  const toBuy = [];
  const covered = [];
  allRecipeIngredients(state.recipes).forEach((ingredient) => {
    const weeklyNeed = needs[ingredient.key];
    const need = round1(weeklyNeed?.need || 0);
    const onHand = round1(have[ingredient.key] || 0);
    const planned = need > 0;
    const coveredByInventory = planned ? onHand >= need : onHand > 0;
    const buy = planned ? round1(Math.max(0, need - onHand)) : 1;
    const row = {
      ...ingredient,
      need,
      have: onHand,
      buy,
      planned
    };
    (coveredByInventory ? covered : toBuy).push(row);
  });
  return { dates, toBuy, covered };
}

function distanceTo(store) {
  return haversineKm(userLocation, store);
}

function formatDistance(distance) {
  if (!Number.isFinite(distance)) return "Distance unavailable";
  return `${distance < 10 ? distance.toFixed(2) : distance.toFixed(1)} km`;
}

function storeHas(store, itemName) {
  return store.itemKeys.has(normName(itemName));
}

function groceryItemsForCoverage() {
  const { toBuy } = groceryData();
  return [...toBuy, ...state.extras.map((item) => ({ ...item, key: `x:${item.id}` }))];
}

function storeCoverage(store) {
  const items = groceryItemsForCoverage();
  const available = items.filter((item) => storeHas(store, item.name));
  return {
    available,
    missing: items.filter((item) => !storeHas(store, item.name)),
    count: available.length,
    total: items.length
  };
}

function storesForItem(itemName) {
  return STORES
    .filter((store) => storeHas(store, itemName))
    .map((store) => ({ ...store, distance: distanceTo(store), coverage: storeCoverage(store) }))
    .sort((a, b) => a.distance - b.distance);
}

function rankedStores() {
  const rows = STORES.map((store) => ({
    ...store,
    distance: distanceTo(store),
    coverage: storeCoverage(store)
  }));
  if (storeSort === "nearest") return rows.sort((a, b) => a.distance - b.distance);
  if (storeSort === "coverage") {
    return rows.sort((a, b) => b.coverage.count - a.coverage.count || a.distance - b.distance);
  }
  return rows.sort((a, b) => {
    const aRatio = a.coverage.total ? a.coverage.count / a.coverage.total : 0;
    const bRatio = b.coverage.total ? b.coverage.count / b.coverage.total : 0;
    return bRatio - aRatio || a.distance - b.distance;
  });
}

function groceryItemPath(item) {
  return `/grocery/${slugify(item.name)}`;
}

function directionsUrl(store) {
  const parameters = new URLSearchParams({
    api: "1",
    destination: `${store.name}, ${store.address}`,
    travelmode: "driving",
    dir_action: "navigate"
  });
  if (userLocation.source === "browser") {
    parameters.set("origin", `${userLocation.lat},${userLocation.lng}`);
  }
  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}

function routeState() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { section: "planner", canonical: "/planner" };
  if (path === "/planner") return { section: "planner" };
  if (path === "/planner/visualization") return { section: "meal-map" };
  if (path === "/recipes") return { section: "recipes" };
  if (path.startsWith("/recipes/")) {
    const segment = decodeURIComponent(path.split("/")[2] || "");
    const item = state.recipes.find((recipeItem) => segment.endsWith(recipeItem.id))
      || state.recipes.find((recipeItem) => slugify(recipeItem.name) === segment);
    return { section: "recipes", detail: "recipe", item };
  }
  if (path === "/inventory") return { section: "inventory" };
  if (path === "/grocery") return { section: "grocery" };
  if (path.startsWith("/grocery/")) {
    const slug = decodeURIComponent(path.split("/")[2] || "");
    const candidates = [...groceryData().toBuy, ...state.extras];
    const item = candidates.find((candidate) => slugify(candidate.name) === slug);
    return { section: "grocery", detail: "grocery-item", item, slug };
  }
  if (path === "/stores") return { section: "stores" };
  if (path.startsWith("/stores/")) {
    const id = decodeURIComponent(path.split("/")[2] || "");
    return { section: "stores", detail: "store", item: STORES.find((store) => store.id === id) };
  }
  return { section: "not-found" };
}

function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  document.body.classList.remove("mobile-nav-open");
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function pageTitle(route) {
  if (route.detail === "recipe" && route.item) return `${route.item.name} — NourishPlan`;
  if (route.detail === "grocery-item" && route.item) return `${route.item.name} near you — NourishPlan`;
  if (route.detail === "store" && route.item) return `${route.item.name} — NourishPlan`;
  const current = NAV.find((item) => item.key === route.section);
  return `${current ? current.label : "NourishPlan"} — NourishPlan`;
}

function icon(name, extra = "") {
  return `<i class="ph ${name} ${extra}" aria-hidden="true"></i>`;
}

function shell(route, body) {
  const utility = `
    <div class="utility-nav">
      <button class="nav-link" type="button" data-settings>${icon("ph-gear")}<span>Settings</span></button>
      <a class="nav-link" href="https://healthy-recipes-murex.vercel.app/" target="_blank" rel="noreferrer">${icon("ph-question")}<span>Help & support</span></a>
    </div>`;
  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <a class="brand" href="/planner" data-route>
          <img src="/favicon.svg" alt="" aria-hidden="true" />
          <span><span class="brand-title">NourishPlan</span><span class="brand-subtitle">Healthy Recipes & Meal Planner</span></span>
        </a>
        <nav class="primary-nav">
          ${NAV.map((item) => `<a class="nav-link ${route.section === item.key ? "active" : ""}" href="${item.path}" data-route>${icon(item.icon)}<span>${item.label}</span></a>`).join("")}
        </nav>
        ${utility}
        <div class="sidebar-profile"><span class="avatar">SP</span><strong>Sarah P.</strong>${icon("ph-caret-down")}</div>
      </aside>
      <button class="mobile-overlay" type="button" aria-label="Close navigation" data-close-nav></button>
      <section class="main-shell">
        <header class="topbar">
          <button class="icon-button mobile-menu-button" type="button" aria-label="Open navigation" data-open-nav>${icon("ph-list")}</button>
          <a class="mobile-brand" href="/planner" data-route><img src="/favicon.svg" alt="" /><span>NourishPlan</span></a>
          <label class="global-search">${icon("ph-magnifying-glass")}<input id="globalSearch" type="search" placeholder="Search recipes, ingredients, meals…" /><span class="search-key">⌘ K</span></label>
          ${route.section === "planner" || route.section === "meal-map" ? `<div class="topbar-actions"><button class="icon-button" type="button" aria-label="Notifications">${icon("ph-bell")}</button><span class="today-date">${fmtDateWithYear()}</span></div>` : ""}
        </header>
        <main class="content" id="mainContent">${body}</main>
      </section>
    </div>`;
}

function render() {
  cleanupMealVisualization();
  keepRollingMealPlanComplete();
  const route = routeState();
  if (route.canonical) {
    navigate(route.canonical, { replace: true });
    return;
  }
  document.title = pageTitle(route);
  let body = "";
  if (route.detail === "recipe") body = renderRecipeDetail(route.item);
  else if (route.detail === "grocery-item") body = renderGroceryItem(route.item, route.slug);
  else if (route.detail === "store") body = renderStoreDetail(route.item);
  else if (route.section === "planner") body = renderPlanner();
  else if (route.section === "meal-map") body = renderMealVisualization();
  else if (route.section === "recipes") body = renderRecipes();
  else if (route.section === "inventory") body = renderInventory();
  else if (route.section === "grocery") body = renderGrocery();
  else if (route.section === "stores") body = renderStores();
  else body = renderNotFound();
  $("#app").innerHTML = shell(route, body);
  wire(route);
}

function heading(title, subtitle, actions = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${actions}</div>`;
}

function plannerToolbar() {
  const dates = weekDates(weekOffset);
  const calendarCount = plannerMode === "week"
    ? calendarRecipeCountForDates(dates)
    : calendarRecipeCountForDates([dayDate]);
  return `
    <div class="planner-toolbar">
      <div class="segmented" aria-label="Planner view">
        <button type="button" class="${plannerMode === "week" ? "active" : ""}" data-planner-mode="week">Week</button>
        <button type="button" class="${plannerMode === "day" ? "active" : ""}" data-planner-mode="day">Day</button>
      </div>
      <div class="date-control">
        <button type="button" aria-label="Previous ${plannerMode}" data-period-nav="-1">${icon("ph-caret-left")}</button>
        <span>${icon("ph-calendar-blank")} ${plannerMode === "week" ? `${fmtDate(dates[0])} — ${fmtDate(dates[6])}, ${dateFromISO(dates[6]).getFullYear()}` : fmtLong(dayDate)}</span>
        <button type="button" aria-label="Next ${plannerMode}" data-period-nav="1">${icon("ph-caret-right")}</button>
      </div>
      <button class="button secondary planner-today-button" type="button" data-planner-today>Today</button>
      <span class="calendar-import-chip">${icon("ph-google-logo")} ${calendarCount} scheduled recipe${calendarCount === 1 ? "" : "s"}</span>
      <button class="button" type="button" data-quick-add>${icon("ph-plus")} Add Meal</button>
    </div>`;
}

function renderPlanner() {
  const actions = `<a class="button secondary" href="/planner/visualization" data-route>${icon("ph-cube")} Explore 3D map</a>`;
  return `${heading("Planner", "Plan your week. Meal prices are estimated ingredient costs per serving in Philippine pesos and may vary by store.", actions)}${plannerToolbar()}${plannerMode === "week" ? renderWeekPlanner() : renderDayPlanner()}`;
}

function mealVisualizationData() {
  const dates = weekDates(weekOffset);
  const nodes = [{ key: "root", kind: "root", label: "Meal plan", x: 0, y: 0, z: 0 }];
  const links = [];
  const entries = [];

  dates.forEach((date, dayIndex) => {
    const angle = -Math.PI / 2 + dayIndex / dates.length * Math.PI * 2;
    const dayNode = {
      key: `day:${date}`,
      kind: "day",
      date,
      label: date === todayISO() ? "Today" : fmtDow(date),
      x: Math.cos(angle) * 330,
      y: Math.sin(dayIndex * 1.35) * 36,
      z: Math.sin(angle) * 330
    };
    nodes.push(dayNode);
    links.push({ source: "root", target: dayNode.key, kind: "day" });

    MEALS.forEach((meal, mealIndex) => {
      if (mealViz.filter !== "all" && mealViz.filter !== meal) return;
      const item = recipeById(planFor(date)[meal]);
      if (!item) return;
      const orbit = angle + (mealIndex - 1.5) * 0.34;
      const entry = {
        key: `${date}|${meal}`,
        kind: "meal",
        date,
        meal,
        item,
        label: item.name,
        x: dayNode.x + Math.cos(orbit) * 108,
        y: (mealIndex - 1.5) * 92,
        z: dayNode.z + Math.sin(orbit) * 108
      };
      entries.push(entry);
      nodes.push(entry);
      links.push({ source: dayNode.key, target: entry.key, kind: meal });
    });
  });

  return { dates, nodes, links, entries };
}

function mealVizDetails(node, data) {
  if (node?.kind === "meal") {
    const { item, date, meal } = node;
    return `<div class="meal-viz-detail-photo"><img src="${esc(recipeImage(item))}" alt="${esc(item.name)}" /></div>
      <span class="meal-viz-eyebrow"><i style="background:${MEAL_VISUAL[meal].color}"></i>${MEAL_LABEL[meal]} · ${fmtLong(date)}</span>
      <h2>${esc(item.name)}</h2>
      <div class="meal-viz-nutrition"><span><strong>${item.cal}</strong> kcal</span><span><strong>${fmtPeso(mealCostPeso(item))}</strong> estimated</span><span><strong>${item.time}</strong> min</span><span><strong>${item.ingredients.length}</strong> ingredients</span></div>
      <div class="tags">${item.tags.slice(0, 4).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
      <a class="button meal-viz-recipe-link" href="${recipePath(item)}" data-route>View recipe ${icon("ph-arrow-right")}</a>`;
  }

  if (node?.kind === "day") {
    const meals = data.entries.filter((entry) => entry.date === node.date);
    const calories = meals.reduce((total, entry) => total + (Number(entry.item.cal) || 0), 0);
    const cost = meals.reduce((total, entry) => total + mealCostPeso(entry.item), 0);
    return `<span class="meal-viz-eyebrow">Day overview</span><h2>${fmtLong(node.date)}</h2>
      <div class="meal-viz-nutrition"><span><strong>${meals.length}</strong> meals</span><span><strong>${calories.toLocaleString()}</strong> kcal</span><span><strong>${fmtPeso(cost)}</strong> estimated</span></div>
      <div class="meal-viz-day-list">${meals.map((entry) => `<button type="button" data-viz-select="${entry.key}"><i style="background:${MEAL_VISUAL[entry.meal].color}"></i><span>${MEAL_LABEL[entry.meal]}</span><strong>${esc(entry.item.name)}</strong></button>`).join("") || "<p>No meals match this filter.</p>"}</div>`;
  }

  const uniqueRecipes = new Set(data.entries.map((entry) => entry.item.id)).size;
  const calories = data.entries.reduce((total, entry) => total + (Number(entry.item.cal) || 0), 0);
  const cost = data.entries.reduce((total, entry) => total + mealCostPeso(entry.item), 0);
  return `<span class="meal-viz-eyebrow">Live plan overview</span><h2>${fmtDate(data.dates[0])} — ${fmtDate(data.dates[6])}</h2>
    <p>Select a day or meal in the map to see its details.</p>
    <div class="meal-viz-nutrition"><span><strong>${data.entries.length}</strong> meals</span><span><strong>${uniqueRecipes}</strong> recipes</span><span><strong>${calories.toLocaleString()}</strong> kcal</span><span><strong>${fmtPeso(cost)}</strong> estimated</span></div>`;
}

function renderMealVisualization() {
  const data = mealVisualizationData();
  const selected = data.nodes.find((node) => node.key === mealViz.selectedKey) || data.nodes[0];
  const controls = `<a class="button secondary" href="/planner" data-route>${icon("ph-arrow-left")} Back to Planner</a>`;
  const accessibleRows = data.entries.map((entry) => `<li>${fmtLong(entry.date)}, ${MEAL_LABEL[entry.meal]}: ${esc(entry.item.name)}, ${entry.item.cal} calories, estimated ${fmtPeso(mealCostPeso(entry.item))}</li>`).join("");
  return `${heading("3D Meal Map", "Explore every planned meal and recipe for the selected week.", controls)}
    <div class="meal-viz-toolbar">
      <div class="date-control">
        <button type="button" aria-label="Previous week" data-viz-week-nav="-1">${icon("ph-caret-left")}</button>
        <span>${icon("ph-calendar-blank")} ${fmtDate(data.dates[0])} — ${fmtDate(data.dates[6])}, ${dateFromISO(data.dates[6]).getFullYear()}</span>
        <button type="button" aria-label="Next week" data-viz-week-nav="1">${icon("ph-caret-right")}</button>
      </div>
      <button class="button secondary" type="button" data-viz-today>Current week</button>
      <div class="meal-viz-filters" aria-label="Filter visualization by meal type">
        ${["all", ...MEALS].map((meal) => `<button class="chip ${mealViz.filter === meal ? "active" : ""}" type="button" data-viz-filter="${meal}">${meal === "all" ? "All meals" : MEAL_LABEL[meal]}</button>`).join("")}
      </div>
    </div>
    <div class="meal-viz-layout">
      <section class="meal-viz-stage" aria-label="Interactive 3D meal visualization">
        <canvas id="mealVizCanvas" role="img" tabindex="0" aria-describedby="mealVizInstructions"></canvas>
        <div class="meal-viz-stage-top"><span class="meal-viz-live"><i></i> Live Planner data</span><span>${data.entries.length} meals</span></div>
        <div class="meal-viz-stage-actions">
          <button type="button" data-viz-auto>${icon(mealViz.autoRotate ? "ph-pause" : "ph-play")}<span>${mealViz.autoRotate ? "Pause" : "Rotate"}</span></button>
          <button type="button" aria-label="Zoom out" data-viz-zoom="-1">${icon("ph-minus")}</button>
          <button type="button" aria-label="Zoom in" data-viz-zoom="1">${icon("ph-plus")}</button>
          <button type="button" data-viz-reset>${icon("ph-crosshair")}<span>Reset view</span></button>
        </div>
        <p class="meal-viz-instructions" id="mealVizInstructions">Drag to rotate · Scroll or use +/− to zoom · Select a node for details</p>
      </section>
      <aside class="meal-viz-detail surface" id="mealVizDetails" aria-live="polite">${mealVizDetails(selected, data)}</aside>
    </div>
    <div class="meal-viz-legend" aria-label="Meal type legend">${MEALS.map((meal) => `<span><i style="background:${MEAL_VISUAL[meal].color}"></i>${MEAL_LABEL[meal]}</span>`).join("")}</div>
    <ol class="sr-only">${accessibleRows}</ol>`;
}

function cleanupMealVisualization() {
  if (mealViz.raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(mealViz.raf);
  mealViz.raf = 0;
  mealViz.resizeObserver?.disconnect();
  mealViz.resizeObserver = null;
  mealViz.drag = null;
}

function rotateMealVizPoint(point) {
  const yawCos = Math.cos(mealViz.yaw);
  const yawSin = Math.sin(mealViz.yaw);
  const pitchCos = Math.cos(mealViz.pitch);
  const pitchSin = Math.sin(mealViz.pitch);
  const x = point.x * yawCos - point.z * yawSin;
  const yawZ = point.x * yawSin + point.z * yawCos;
  const y = point.y * pitchCos - yawZ * pitchSin;
  const z = point.y * pitchSin + yawZ * pitchCos;
  return { x, y, z };
}

function projectMealVizPoint(point, width, height) {
  const rotated = rotateMealVizPoint(point);
  const scale = mealViz.zoom / Math.max(360, 980 + rotated.z);
  return {
    x: width / 2 + rotated.x * scale,
    y: height / 2 + rotated.y * scale,
    z: rotated.z,
    scale
  };
}

function mealVizImage(url, draw) {
  if (!url || typeof Image === "undefined") return null;
  if (mealViz.images.has(url)) return mealViz.images.get(url);
  const image = new Image();
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.onload = draw;
  image.onerror = draw;
  image.src = url;
  mealViz.images.set(url, image);
  return image;
}

function drawMealVisualization(canvas, data) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const projected = new Map(data.nodes.map((node) => [node.key, projectMealVizPoint(node, width, height)]));
  context.lineWidth = 1;
  [150, 260, 375].forEach((radius, ringIndex) => {
    context.beginPath();
    for (let index = 0; index <= 64; index += 1) {
      const angle = index / 64 * Math.PI * 2;
      const point = projectMealVizPoint({ x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius }, width, height);
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.strokeStyle = `rgba(150, 204, 174, ${0.13 - ringIndex * 0.025})`;
    context.stroke();
  });

  data.links.forEach((link) => {
    const source = projected.get(link.source);
    const target = projected.get(link.target);
    if (!source || !target) return;
    const isMeal = link.kind !== "day";
    context.beginPath();
    context.moveTo(source.x, source.y);
    context.lineTo(target.x, target.y);
    context.strokeStyle = isMeal ? MEAL_VISUAL[link.kind].glow : "rgba(170, 221, 190, 0.22)";
    context.lineWidth = isMeal ? 1.4 : 1;
    context.stroke();
  });

  mealViz.hitNodes = [];
  const sortedNodes = [...data.nodes].sort((a, b) => projected.get(b.key).z - projected.get(a.key).z);
  sortedNodes.forEach((node) => {
    const point = projected.get(node.key);
    const selected = node.key === mealViz.selectedKey;
    const radius = node.kind === "root" ? 25 : node.kind === "day" ? 13 : Math.max(17, Math.min(29, 25 * point.scale + 9));
    const alpha = Math.max(0.45, Math.min(1, 1.04 - (point.z + 430) / 1600));
    context.save();
    context.globalAlpha = alpha;
    context.shadowBlur = selected ? 28 : node.kind === "meal" ? 13 : 7;
    context.shadowColor = node.kind === "meal" ? MEAL_VISUAL[node.meal].color : "rgba(76, 188, 126, 0.55)";
    context.beginPath();
    context.arc(point.x, point.y, radius + (selected ? 4 : 0), 0, Math.PI * 2);
    context.fillStyle = node.kind === "root" ? "#f4c85d" : node.kind === "day" ? "#dff4e6" : "#173f2c";
    context.fill();
    context.shadowBlur = 0;

    if (node.kind === "meal") {
      const image = mealVizImage(recipeImage(node.item), () => drawMealVisualization(canvas, data));
      context.save();
      context.beginPath();
      context.arc(point.x, point.y, Math.max(12, radius - 3), 0, Math.PI * 2);
      context.clip();
      if (image?.complete && image.naturalWidth) {
        context.drawImage(image, point.x - radius, point.y - radius, radius * 2, radius * 2);
      } else {
        context.fillStyle = MEAL_VISUAL[node.meal].color;
        context.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
      }
      context.restore();
      context.beginPath();
      context.arc(point.x, point.y, radius + (selected ? 4 : 0), 0, Math.PI * 2);
      context.strokeStyle = selected ? "#ffffff" : MEAL_VISUAL[node.meal].color;
      context.lineWidth = selected ? 3 : 2;
      context.stroke();
    } else {
      context.fillStyle = node.kind === "root" ? "#183f2c" : "#16482f";
      context.font = `700 ${node.kind === "root" ? 12 : 10}px "DM Sans", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(node.kind === "root" ? "PLAN" : fmtDow(node.date).slice(0, 2).toUpperCase(), point.x, point.y + 0.5);
    }

    if (node.kind !== "meal" || selected || point.z < 30) {
      const label = node.kind === "meal" && node.label.length > 24 ? `${node.label.slice(0, 22)}…` : node.label;
      context.font = `${selected ? 700 : 600} ${selected ? 12 : 10}px "DM Sans", sans-serif`;
      const textWidth = context.measureText(label).width;
      const labelY = point.y + radius + 16;
      context.fillStyle = selected ? "rgba(7, 40, 27, 0.96)" : "rgba(7, 40, 27, 0.74)";
      context.fillRect(point.x - textWidth / 2 - 7, labelY - 10, textWidth + 14, 19);
      context.fillStyle = "#f8fff9";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, point.x, labelY);
    }
    context.restore();
    mealViz.hitNodes.push({ node, x: point.x, y: point.y, radius: radius + 10, z: point.z });
  });
}

function initMealVisualization() {
  const canvas = $("#mealVizCanvas");
  const details = $("#mealVizDetails");
  if (!canvas || !details || typeof requestAnimationFrame !== "function") return;
  const data = mealVisualizationData();
  const draw = () => drawMealVisualization(canvas, data);
  const selectNode = (node) => {
    if (!node) return;
    mealViz.selectedKey = node.key;
    details.innerHTML = mealVizDetails(node, data);
    details.querySelectorAll("[data-viz-select]").forEach((button) => button.addEventListener("click", () => {
      selectNode(data.nodes.find((candidate) => candidate.key === button.dataset.vizSelect));
    }));
    details.querySelector("[data-route]")?.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(event.currentTarget.getAttribute("href"));
    });
    draw();
  };

  mealViz.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(draw) : null;
  mealViz.resizeObserver?.observe(canvas);
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    mealViz.drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!mealViz.drag) return;
    mealViz.yaw += (event.clientX - mealViz.drag.x) * 0.006;
    mealViz.pitch = Math.max(-1.05, Math.min(1.05, mealViz.pitch + (event.clientY - mealViz.drag.y) * 0.004));
    mealViz.drag.x = event.clientX;
    mealViz.drag.y = event.clientY;
    draw();
  });
  canvas.addEventListener("pointerup", (event) => {
    const drag = mealViz.drag;
    mealViz.drag = null;
    canvas.classList.remove("dragging");
    if (!drag || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = [...mealViz.hitNodes]
      .sort((a, b) => a.z - b.z)
      .find((candidate) => Math.hypot(candidate.x - x, candidate.y - y) <= candidate.radius);
    if (hit) selectNode(hit.node);
  });
  canvas.addEventListener("pointercancel", () => {
    mealViz.drag = null;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    mealViz.zoom = Math.max(430, Math.min(1050, mealViz.zoom - event.deltaY * 0.55));
    draw();
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    const rotations = {
      ArrowLeft: [-0.12, 0],
      ArrowRight: [0.12, 0],
      ArrowUp: [0, -0.09],
      ArrowDown: [0, 0.09]
    };
    if (rotations[event.key]) {
      event.preventDefault();
      mealViz.yaw += rotations[event.key][0];
      mealViz.pitch = Math.max(-1.05, Math.min(1.05, mealViz.pitch + rotations[event.key][1]));
      draw();
    }
    if (event.key === "+" || event.key === "=") {
      mealViz.zoom = Math.min(1050, mealViz.zoom + 90);
      draw();
    }
    if (event.key === "-") {
      mealViz.zoom = Math.max(430, mealViz.zoom - 90);
      draw();
    }
  });

  $("[data-viz-auto]")?.addEventListener("click", () => {
    mealViz.autoRotate = !mealViz.autoRotate;
    const button = $("[data-viz-auto]");
    if (button) button.innerHTML = `${icon(mealViz.autoRotate ? "ph-pause" : "ph-play")}<span>${mealViz.autoRotate ? "Pause" : "Rotate"}</span>`;
  });
  $("[data-viz-reset]")?.addEventListener("click", () => {
    mealViz.yaw = -0.62;
    mealViz.pitch = -0.24;
    mealViz.zoom = 720;
    draw();
  });
  $$('[data-viz-zoom]').forEach((button) => button.addEventListener("click", () => {
    mealViz.zoom = Math.max(430, Math.min(1050, mealViz.zoom + Number(button.dataset.vizZoom) * 90));
    draw();
  }));
  $$('[data-viz-filter]').forEach((button) => button.addEventListener("click", () => {
    mealViz.filter = button.dataset.vizFilter;
    mealViz.selectedKey = "root";
    render();
  }));
  $$('[data-viz-week-nav]').forEach((button) => button.addEventListener("click", () => {
    weekOffset += Number(button.dataset.vizWeekNav);
    mealViz.selectedKey = "root";
    render();
  }));
  $("[data-viz-today]")?.addEventListener("click", () => {
    weekOffset = 0;
    mealViz.selectedKey = "root";
    render();
  });

  selectNode(data.nodes.find((node) => node.key === mealViz.selectedKey) || data.nodes[0]);
  let previous = performance.now();
  const tick = (time) => {
    if (mealViz.autoRotate) {
      mealViz.yaw += Math.min(0.012, (time - previous) * 0.000055);
      draw();
    }
    previous = time;
    mealViz.raf = requestAnimationFrame(tick);
  };
  mealViz.raf = requestAnimationFrame(tick);
}

function weekMetrics(dates) {
  const planned = dates.reduce((total, date) => total + MEALS.filter((meal) => planFor(date)[meal]).length, 0);
  const total = dates.reduce((sum, date) => sum + dayCalories(date), 0);
  const plannedDays = dates.filter((date) => dayCalories(date) > 0);
  return {
    planned,
    total,
    average: plannedDays.length ? Math.round(total / plannedDays.length) : 0
  };
}

function plannerKpis(metrics) {
  return `
    <div class="planner-kpis">
      <div class="kpi">${icon("ph-leaf")}<div><div class="kpi-label">Meals planned</div><div class="kpi-value">${metrics.planned}</div></div></div>
      <div class="kpi">${icon("ph-fire")}<div><div class="kpi-label">Avg. daily calories</div><div class="kpi-value">${metrics.average.toLocaleString()} <small>kcal</small></div></div></div>
      <div class="kpi">${icon("ph-chart-donut")}<div><div class="kpi-label">Week total</div><div class="kpi-value">${metrics.total.toLocaleString()} <small>kcal</small></div></div></div>
    </div>`;
}

function renderWeekPlanner() {
  const dates = weekDates(weekOffset);
  const metrics = weekMetrics(dates);
  const today = todayISO();
  const { toBuy, covered } = groceryData();
  const headers = `<div class="week-cell week-corner"></div>${dates.map((date) => `
    <div class="week-cell week-day ${date === today ? "today" : ""}">
      <strong>${fmtDow(date)}</strong><span>${fmtDate(date)}</span>${date === today ? '<span class="today-label">Today</span>' : ""}<small>${dayCalories(date).toLocaleString()} kcal</small>
    </div>`).join("")}`;
  const rows = MEALS.map((meal) => `
    <div class="week-cell meal-label ${meal}">${icon(MEAL_ICON[meal])}<span>${MEAL_LABEL[meal]}</span></div>
    ${dates.map((date) => {
      const item = recipeById(planFor(date)[meal]);
      return `<div class="week-cell meal-slot ${date === today ? "today" : ""}">
        <div class="primary-meal-slot">${item ? `<button class="meal-card-button" type="button" data-pick="${date}|${meal}" aria-label="Change ${MEAL_LABEL[meal]} on ${fmtLong(date)}">
          <img class="meal-thumb" src="${esc(recipeImage(item))}" alt="${esc(item.name)}" loading="lazy" />
          <span class="meal-name">${esc(item.name)}</span><span class="meal-calories">${item.cal} kcal · <span class="meal-cost" data-meal-cost="${mealCostPeso(item)}">${fmtPeso(mealCostPeso(item))} est.</span></span>
        </button>` : `<button class="empty-meal-button" type="button" data-pick="${date}|${meal}">${icon("ph-plus")}<span>Add meal</span></button>`}</div>
        ${renderCalendarMealOptions(date, meal, item?.id)}
      </div>`;
    }).join("")}`).join("");
  return `
    ${plannerKpis(metrics)}
    <div class="planner-layout">
      <div class="week-grid-wrap" aria-label="Weekly meal plan"><div class="week-grid">${headers}${rows}</div></div>
      ${renderNutritionPanel(metrics)}
    </div>
    <div class="grocery-bridge">
      <a href="/grocery" data-route>${icon("ph-basket")}<div><strong>Grocery readiness</strong><span>${covered.length} stocked · ${toBuy.length} items still needed</span></div>${icon("ph-caret-right")}</a>
      <a href="/stores" data-route>${icon("ph-map-pin")}<div><strong>Find stores nearby</strong><span>See who has the most of what you need</span></div>${icon("ph-caret-right")}</a>
    </div>`;
}

function renderNutritionPanel(metrics) {
  const todayCalories = dayCalories(todayISO()) || metrics.average;
  const target = 1700;
  const mealProgress = Math.min(100, Math.round(metrics.planned / 28 * 100));
  return `
    <aside class="nutrition-panel" aria-label="Nutrition summary">
      <div class="panel-title"><span>Nutrition Summary</span>${icon("ph-info")}</div>
      <div class="nutrition-total">${icon("ph-chart-donut")}<div><strong>${todayCalories.toLocaleString()}</strong><span>kcal of ${target.toLocaleString()} daily target</span></div></div>
      <div class="macro-list">
        ${macroRow("Carbs", "192 g · 49%", 64, "carbs")}
        ${macroRow("Protein", "78 g · 20%", 40, "protein")}
        ${macroRow("Fat", "48 g · 28%", 53, "fat")}
        ${macroRow("Fiber", "24 g · 6%", 26, "fiber")}
      </div>
      <div class="weekly-progress">
        <div class="panel-title"><span>Weekly Progress</span>${icon("ph-info")}</div>
        ${progressItem("ph-leaf", "Meals planned", `${metrics.planned} of 28`, mealProgress)}
        ${progressItem("ph-fire", "Avg. daily calories", `${metrics.average.toLocaleString()} kcal`, Math.min(100, Math.round(metrics.average / target * 100)))}
        ${progressItem("ph-target", "Calorie target", `${target.toLocaleString()} kcal`, 76)}
      </div>
    </aside>`;
}

function macroRow(label, value, percent, className) {
  return `<div class="macro-row ${className}"><div class="macro-head"><span>${label}</span><span>${value}</span></div><div class="macro-track"><div class="macro-fill" style="width:${percent}%"></div></div></div>`;
}

function progressItem(iconName, label, value, percent) {
  return `<div class="progress-item">${icon(iconName)}<div><div class="progress-copy"><strong>${label}</strong><span>${value}</span></div><div class="macro-track"><div class="macro-fill" style="width:${percent}%"></div></div></div></div>`;
}

function renderDayPlanner() {
  const itemCount = MEALS.filter((meal) => planFor(dayDate)[meal]).length;
  const calories = dayCalories(dayDate);
  const cost = dayCost(dayDate);
  return `
    <div class="day-view">
      <section class="day-timeline">
        <div class="timeline-head"><h2>${fmtLong(dayDate)}</h2><span class="status-pill">${itemCount} of 4 planned</span></div>
        ${MEALS.map((meal, index) => {
          const item = recipeById(planFor(dayDate)[meal]);
          const times = ["8:00 AM", "12:30 PM", "6:00 PM", "8:30 PM"];
          const primary = item ? `<div class="timeline-row">
            <span class="meal-type-icon">${icon(MEAL_ICON[meal])}</span><span class="meal-time">${times[index]}</span><img src="${esc(recipeImage(item))}" alt="${esc(item.name)}" /><div class="timeline-copy"><strong>${esc(item.name)}</strong><span>${MEAL_LABEL[meal]} · ${item.cal} kcal · <span class="meal-cost" data-meal-cost="${mealCostPeso(item)}">${fmtPeso(mealCostPeso(item))} est.</span></span></div><button class="icon-button" type="button" data-pick="${dayDate}|${meal}" aria-label="Change meal">${icon("ph-dots-three-vertical")}</button>
          </div>` : `<button class="timeline-row empty-day-row" type="button" data-pick="${dayDate}|${meal}"><span class="meal-type-icon">${icon(MEAL_ICON[meal])}</span><span class="meal-time">${times[index]}</span><span></span><span>Add ${MEAL_LABEL[meal].toLowerCase()}</span>${icon("ph-plus")}</button>`;
          return `<div class="timeline-meal-group">${primary}${renderCalendarMealOptions(dayDate, meal, item?.id)}</div>`;
        }).join("")}
      </section>
      <aside class="surface day-summary"><div class="panel-title"><span>Daily overview</span>${icon("ph-info")}</div><div class="nutrition-total">${icon("ph-chart-donut")}<div><strong>${calories.toLocaleString()}</strong><span>kcal planned today</span></div></div><div class="nutrition-total daily-cost-total" data-day-cost="${cost}">${icon("ph-wallet")}<div><strong>${fmtPeso(cost)}</strong><span>estimated total for all meals today</span></div></div><div class="macro-list">${macroRow("Meals", `${itemCount} of 4`, itemCount * 25, "carbs")}${macroRow("Calorie target", "1,700 kcal", Math.min(100, calories / 17), "fat")}</div><p class="cost-estimate-note">Ingredient-cost estimate per serving; actual prices vary by store and season.</p></aside>
    </div>`;
}

function renderRecipes() {
  const query = recipeQuery.trim().toLowerCase();
  const list = state.recipes.filter((item) => {
    const matchesCategory = recipeCat === "all" || item.cat === recipeCat;
    const haystack = [item.name, ...item.tags, ...item.ingredients.map((ingredient) => ingredient.name)].join(" ").toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
  const actions = `<button class="button" type="button" data-new-recipe>${icon("ph-plus")} Add Recipe</button>`;
  return `
    ${heading("Recipes", "Find balanced meals that make healthy planning feel effortless.", actions)}
    <div class="page-controls">
      <div class="filter-row">
        ${["all", ...MEALS].map((category) => `<button class="chip ${recipeCat === category ? "active" : ""}" type="button" data-recipe-cat="${category}">${category === "all" ? "All recipes" : MEAL_LABEL[category]}</button>`).join("")}
      </div>
      <input class="search-input" id="recipeSearch" type="search" placeholder="Search recipes or ingredients" value="${esc(recipeQuery)}" />
    </div>
    ${list.length ? `<div class="recipe-grid">${list.map((item) => `
      <a class="recipe-card" href="${recipePath(item)}" data-route>
        <img src="${esc(recipeImage(item))}" alt="${esc(item.name)}" loading="lazy" />
        <div class="recipe-card-body"><h2>${esc(item.name)}</h2><div class="recipe-meta"><span>${MEAL_LABEL[item.cat]}</span><span>${item.cal} kcal</span><span>${item.time} min</span></div><div class="tags">${item.tags.slice(0, 3).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div></div>
      </a>`).join("")}</div>` : `<div class="surface empty-state">${icon("ph-bowl-food")}No recipes match those filters.</div>`}`;
}

function renderRecipeDetail(item) {
  if (!item) return renderNotFound();
  const calendarNotes = [...new Set([...(item.sourceNotes || []), item.sourceNote].filter(Boolean))];
  const sourceNote = item.source === "Google Calendar" && item.sourceNote
    ? `<section class="surface detail-section calendar-source-note" style="grid-column:1/-1"><h2>${icon("ph-calendar-check")} Imported from Google Calendar</h2>${calendarNotes.map((note) => `<p>${esc(note)}</p>`).join("")}<span>${esc(item.sourceCalendar || GOOGLE_CALENDAR_SOURCE)} · Equivalent calendar menus are combined into one recipe. Calories and preparation time are practical estimates.</span></section>`
    : "";
  return `
    <nav class="detail-breadcrumbs" aria-label="Breadcrumb"><a href="/recipes" data-route>Recipes</a>${icon("ph-caret-right")}<span>${esc(item.name)}</span></nav>
    <div class="detail-title"><div><h1>${esc(item.name)}</h1><p>${MEAL_LABEL[item.cat]} · ${item.cal} kcal · ${item.time} min</p><div class="tags">${item.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div></div><div><button class="button secondary" type="button" data-edit-recipe="${item.id}">${icon("ph-pencil-simple")} Edit recipe</button></div></div>
    <div class="detail-grid">
      ${sourceNote}
      <section class="surface detail-section"><h2>Ingredients</h2>${item.ingredients.map((ingredient) => `<div class="ingredient-row"><span>${esc(ingredient.name)}</span><strong>${ingredient.qty} ${esc(ingredient.unit)}</strong></div>`).join("") || '<div class="empty-state">No ingredients listed.</div>'}</section>
      <aside class="surface detail-section"><h2>Meal overview</h2><img src="${esc(recipeImage(item))}" alt="${esc(item.name)}" style="width:100%;height:190px;object-fit:cover;border-radius:10px;margin-bottom:16px" /><div class="grocery-bridge" style="grid-template-columns:1fr"><a href="/grocery" data-route>${icon("ph-basket")}<div><strong>Check your grocery list</strong><span>See what you already have and what to buy</span></div>${icon("ph-caret-right")}</a></div></aside>
      <section class="surface detail-section" style="grid-column:1/-1"><h2>Method</h2>${item.steps.map((step, index) => `<div class="step-row"><span class="step-number">${index + 1}</span><span>${esc(step)}</span></div>`).join("") || '<div class="empty-state">No steps listed.</div>'}</section>
    </div>`;
}

function renderInventory() {
  const items = [...state.inventory].sort((a, b) => a.name.localeCompare(b.name));
  const actions = `<button class="button" type="button" data-new-inventory>${icon("ph-plus")} Add Item</button>`;
  return `
    ${heading("Inventory", "Every recipe ingredient is listed automatically. Update quantities to keep your grocery list accurate.", actions)}
    <section class="list-surface">
      <div class="table-head"><span>Item</span><span>Quantity</span><span></span></div>
      ${items.length ? items.map((item) => `<div class="inventory-row">
        <div class="item-name"><strong>${esc(item.name)}</strong><span>${item.unit ? `Measured in ${esc(item.unit)}` : "Counted by item"}</span></div>
        <div class="quantity-controls"><button type="button" data-inventory-minus="${item.id}" aria-label="Decrease quantity">${icon("ph-minus")}</button><span>${item.qty} ${esc(item.unit)}</span><button type="button" data-inventory-plus="${item.id}" aria-label="Increase quantity">${icon("ph-plus")}</button></div>
        <div class="row-actions"><button class="icon-button" type="button" data-inventory-delete="${item.id}" aria-label="Delete ${esc(item.name)}">${icon("ph-trash")}</button></div>
      </div>`).join("") : `<div class="empty-state">${icon("ph-archive")}Your inventory is empty. Add what you already have at home.</div>`}
    </section>`;
}

function grocerySectionHeader(section, label, count, extraActions = "") {
  const expanded = grocerySections[section];
  const contentId = `grocery-${section}-content`;
  return `<div class="list-section-title collapsible-section-title">
    <div class="grocery-section-label"><span>${label}</span><span class="status-pill">${count} item${count === 1 ? "" : "s"}</span></div>
    <div class="list-section-actions">${extraActions}<button class="button secondary small section-toggle" type="button" data-grocery-section-toggle="${section}" aria-expanded="${expanded}" aria-controls="${contentId}">${icon(expanded ? "ph-caret-up" : "ph-caret-down")} ${expanded ? "Collapse" : "Expand"}</button></div>
  </div>`;
}

function grocerySectionContent(section, content) {
  return `<div class="grocery-section-content" id="grocery-${section}-content" ${grocerySections[section] ? "" : "hidden"}>${content}</div>`;
}

function renderGrocery() {
  const { dates, toBuy, covered } = groceryData();
  const recipeIngredients = allRecipeIngredients(state.recipes);
  const inventory = inventoryByKey();
  const toBuyKeys = new Set(toBuy.map((item) => item.key));
  const extras = state.extras;
  const checkedCount = toBuy.filter((item) => state.checked[item.key]).length
    + extras.filter((item) => state.checked[`x:${item.id}`]).length;
  const total = toBuy.length + extras.length;
  const actions = `<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="button secondary" href="/stores" data-route>${icon("ph-map-pin")} Compare Stores</a><button class="button" type="button" data-new-extra>${icon("ph-plus")} Add Extra</button></div>`;
  const purchasedAction = checkedCount ? `<button class="button small" type="button" data-purchased>Move ${checkedCount} to inventory</button>` : "";
  const toBuyContent = total
    ? `${toBuy.map((item) => groceryRow(item, item.key)).join("")}${extras.map((item) => groceryRow(item, `x:${item.id}`, true)).join("")}`
    : `<div class="empty-state">${icon("ph-check-circle")}Everything you need is already covered.</div>`;
  const coveredContent = covered.length
    ? covered.map((item) => `<div class="covered-row inventory-status-row">
      <div class="covered-main"><strong>${esc(item.name)}</strong><span class="grocery-quantity">${item.planned ? `Need ${item.need} ${esc(item.unit)} this week · ` : ""}${item.have} ${esc(item.unit)} on hand</span></div>
      <div class="grocery-inventory-actions"><button class="button secondary small" type="button" data-update-inventory="${esc(item.key)}">${icon("ph-pencil-simple")} Update quantity</button><button class="button danger small" type="button" data-out-of-stock="${esc(item.key)}">${icon("ph-x-circle")} Mark out of stock</button></div>
    </div>`).join("")
    : `<div class="empty-state">${icon("ph-archive")}No recipe ingredients are currently covered by inventory.</div>`;
  const ingredientsContent = recipeIngredients.map((item) => {
    const status = toBuyKeys.has(item.key) ? "to-buy" : "covered";
    return `<div class="covered-row recipe-ingredient-status-row" data-recipe-grocery-status="${status}" data-ingredient-key="${esc(item.key)}"><div class="covered-main"><strong>${esc(item.name)}</strong><span class="grocery-quantity">Used in ${item.recipeCount} recipe${item.recipeCount === 1 ? "" : "s"} · ${item.totalQty} ${esc(item.unit)} total · ${round1(inventory[item.key] || 0)} ${esc(item.unit)} on hand</span></div><span class="status-pill ${status === "to-buy" ? "amber" : ""}">${status === "to-buy" ? "To buy" : "Covered"}</span></div>`;
  }).join("");
  return `
    ${heading("Grocery", `Shopping list for ${fmtDate(dates[0])}–${fmtDate(dates[6])}. Select any item to find the nearest stores.`, actions)}
    <div class="grocery-summary"><div class="summary-stat"><strong>${total}</strong><span>Items to buy</span></div><div class="summary-stat"><strong>${checkedCount}</strong><span>Already in cart</span></div><div class="summary-stat"><strong>${covered.length}</strong><span>Covered by inventory</span></div></div>
    <div class="grocery-section-controls" role="group" aria-label="Grocery section display"><span>Section display</span><button class="button secondary small" type="button" data-grocery-expand-all>${icon("ph-arrows-out-line-vertical")} Expand all</button><button class="button secondary small" type="button" data-grocery-collapse-all>${icon("ph-arrows-in-line-vertical")} Collapse all</button></div>
    <section class="list-surface">
      ${grocerySectionHeader("toBuy", "To buy", total, purchasedAction)}
      ${grocerySectionContent("toBuy", toBuyContent)}
    </section>
    <section class="list-surface" style="margin-top:16px">
      ${grocerySectionHeader("covered", "Covered by inventory", covered.length)}
      ${grocerySectionContent("covered", coveredContent)}
    </section>
    <section class="list-surface" style="margin-top:16px">
      ${grocerySectionHeader("ingredients", "All recipe ingredients", recipeIngredients.length)}
      ${grocerySectionContent("ingredients", ingredientsContent)}
    </section>`;
}

function groceryRow(item, checkedKey, extra = false) {
  const matches = storesForItem(item.name).length;
  const quantityDetail = extra
    ? "Added manually"
    : item.planned
      ? `Need ${item.need} · have ${item.have}`
      : "Recipe ingredient · currently out of stock";
  return `<div class="grocery-row ${state.checked[checkedKey] ? "done" : ""}">
    <input type="checkbox" aria-label="Mark ${esc(item.name)} as in cart" data-grocery-check="${esc(checkedKey)}" ${state.checked[checkedKey] ? "checked" : ""} />
    <a class="grocery-product" href="${groceryItemPath(item)}" data-route><strong>${esc(item.name)}</strong>${extra ? ' <span class="tag">extra</span>' : ""}</a>
    <span class="grocery-quantity"><strong>Buy ${item.buy ?? item.qty} ${esc(item.unit)}</strong>${quantityDetail}</span>
    <a class="store-match-link" href="${groceryItemPath(item)}" data-route>${icon("ph-storefront")} ${matches} nearby store${matches === 1 ? "" : "s"}</a>
    ${extra ? "<span></span>" : `<div class="grocery-inventory-actions"><button class="button secondary small" type="button" data-update-inventory="${esc(item.key)}">${icon("ph-pencil-simple")} Update inventory</button></div>`}
    ${icon("ph-caret-right")}
  </div>`;
}

function renderLocationBanner() {
  const hasDeviceLocation = userLocation.source === "browser";
  const accuracy = hasDeviceLocation && Number.isFinite(userLocation.accuracy) ? Math.round(userLocation.accuracy) : null;
  const quality = accuracy === null ? "BGC fallback" : accuracy <= 25 ? "Precise fix" : accuracy <= 75 ? "Accurate fix" : "Approximate fix";
  const sourceText = hasDeviceLocation
    ? `Device-reported accuracy ±${accuracy} m. Distances are straight-line estimates; directions use this exact origin.`
    : "Use your current location for accurate store sorting and directions. Your location is not saved.";
  return `<div class="location-banner">${icon("ph-navigation-arrow")}<div class="location-copy"><div class="location-title-row"><strong>${esc(userLocation.label)}</strong><span class="location-quality ${hasDeviceLocation && accuracy <= 75 ? "precise" : ""}">${quality}</span></div><span>${sourceText}</span></div><button class="button secondary small" type="button" data-use-location>${icon("ph-crosshair")} ${hasDeviceLocation ? "Refresh precise location" : "Use current location"}</button></div>`;
}

function renderGroceryItem(item, requestedSlug) {
  if (!item) {
    return `${heading("Item not in this list", "This grocery item may have been purchased, removed, or renamed.")}<a class="button" href="/grocery" data-route>Back to Grocery</a>`;
  }
  const stores = storesForItem(item.name);
  return `
    <nav class="detail-breadcrumbs" aria-label="Breadcrumb"><a href="/grocery" data-route>Grocery</a>${icon("ph-caret-right")}<span>${esc(item.name)}</span></nav>
    <div class="detail-title"><div><h1>${esc(item.name)}</h1><p>Buy ${item.buy ?? item.qty} ${esc(item.unit)} · nearby stores sorted by distance</p></div><a class="button secondary" href="/stores" data-route>${icon("ph-storefront")} Compare all stores</a></div>
    ${renderLocationBanner()}
    <section class="list-surface availability-list">
      <div class="list-section-title"><span>Where to buy</span><span class="status-pill">${stores.length} likely matches</span></div>
      ${stores.length ? stores.map((store, index) => `<div class="availability-row">
        <div class="availability-main"><span class="store-rank">${index + 1}</span><div><strong>${esc(store.name)}</strong><span>${esc(store.address)} · ${esc(store.hours)}</span></div></div>
        <div class="availability-actions"><span class="distance">${icon("ph-navigation-arrow")} ${formatDistance(store.distance)} straight-line</span><a class="button secondary small" href="/stores/${store.id}" data-route>View store</a><a class="button small" href="${directionsUrl(store)}" target="_blank" rel="noreferrer">Directions ${icon("ph-arrow-square-out")}</a></div>
      </div>`).join("") : `<div class="empty-state">${icon("ph-storefront")}No seeded store match is available yet. Compare all stores or add another item.</div>`}
    </section>
    <p style="color:var(--muted);font-size:11px;margin-top:12px">Availability is a planning estimate based on common store assortment, not live shelf inventory. Check the store before traveling.</p>`;
}

function renderStores() {
  const stores = rankedStores();
  const totalItems = groceryItemsForCoverage().length;
  const actions = `<select class="sort-select" id="storeSort" aria-label="Sort stores"><option value="smart" ${storeSort === "smart" ? "selected" : ""}>Best match</option><option value="nearest" ${storeSort === "nearest" ? "selected" : ""}>Nearest first</option><option value="coverage" ${storeSort === "coverage" ? "selected" : ""}>Most items first</option></select>`;
  return `
    ${heading("Nearby Stores", "See which stores cover the most of your grocery list, with distance from your current location.", actions)}
    ${renderLocationBanner()}
    ${totalItems ? `<div class="store-grid">${stores.map((store) => storeCard(store)).join("")}</div>` : `<div class="surface empty-state">${icon("ph-basket")}Add planned meals or grocery extras first, then return here to compare store coverage.</div>`}`;
}

function storeCard(store) {
  const { count, total } = store.coverage;
  const percent = total ? Math.round(count / total * 100) : 0;
  return `<a class="store-card" href="/stores/${store.id}" data-route>
    <div><h2>${esc(store.name)}</h2><div class="store-address">${icon("ph-map-pin")}<span>${esc(store.address)}</span></div><div class="store-hours">${icon("ph-clock")}<span>${esc(store.hours)}</span></div></div>
    <div class="coverage-meter"><strong>${count}/${total}</strong><span>${percent}% of your list</span></div>
    <div class="store-card-footer"><span class="distance">${icon("ph-navigation-arrow")} ${formatDistance(store.distance)} straight-line</span><span class="store-match-link">View coverage ${icon("ph-caret-right")}</span></div>
  </a>`;
}

function renderStoreDetail(store) {
  if (!store) return renderNotFound();
  const coverage = storeCoverage(store);
  const distance = distanceTo(store);
  return `
    <nav class="detail-breadcrumbs" aria-label="Breadcrumb"><a href="/stores" data-route>Nearby Stores</a>${icon("ph-caret-right")}<span>${esc(store.name)}</span></nav>
    <div class="detail-title"><div><h1>${esc(store.name)}</h1><p>${esc(store.address)} · ${formatDistance(distance)} straight-line</p></div><a class="button" href="${directionsUrl(store)}" target="_blank" rel="noreferrer">Get directions ${icon("ph-arrow-square-out")}</a></div>
    ${renderLocationBanner()}
    <div class="detail-grid">
      <section class="surface detail-section"><h2>Available from your list</h2>${coverage.available.length ? `<div class="store-products">${coverage.available.map((item) => `<a class="product-chip" href="${groceryItemPath(item)}" data-route>${icon("ph-check")} ${esc(item.name)}</a>`).join("")}</div>` : '<div class="empty-state">No matching items yet.</div>'}</section>
      <aside class="surface detail-section"><h2>Store overview</h2><div class="nutrition-total">${icon("ph-basket")}<div><strong>${coverage.count}/${coverage.total}</strong><span>items from your current list</span></div></div><div class="store-hours" style="margin-top:18px">${icon("ph-clock")}<span>${esc(store.hours)}</span></div><div class="store-address">${icon("ph-navigation-arrow")}<span>${formatDistance(distance)} from ${esc(userLocation.label)}</span></div><a class="store-match-link" style="margin-top:16px" href="${store.source}" target="_blank" rel="noreferrer">Official store information ${icon("ph-arrow-square-out")}</a></aside>
      <section class="surface detail-section" style="grid-column:1/-1"><h2>Not listed at this store</h2>${coverage.missing.length ? `<div class="store-products">${coverage.missing.map((item) => `<span class="product-chip missing">${icon("ph-minus")} ${esc(item.name)}</span>`).join("")}</div>` : '<span class="status-pill">Full list coverage</span>'}</section>
    </div>
    <p style="color:var(--muted);font-size:11px;margin-top:12px">Coverage is a planning estimate rather than live shelf inventory. Confirm availability with the store before traveling.</p>`;
}

function renderNotFound() {
  return `<div class="surface empty-state">${icon("ph-compass")}<h1 style="font-family:Fraunces,serif;color:var(--forest-950)">Page not found</h1><p>The page may have moved, but your meal plan is still here.</p><a class="button" href="/planner" data-route>Return to Planner</a></div>`;
}

function openModal(content) {
  $("#modalRoot").innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true"><button class="icon-button modal-close" type="button" aria-label="Close" data-close-modal>${icon("ph-x")}</button>${content}</section></div>`;
  document.body.style.overflow = "hidden";
  $("[data-close-modal]").onclick = closeModal;
  $("[data-modal-backdrop]").onclick = (event) => {
    if (event.target.matches("[data-modal-backdrop]")) closeModal();
  };
}

function closeModal() {
  $("#modalRoot").innerHTML = "";
  document.body.style.overflow = "";
}

function recipeModal(existing = null) {
  const item = existing || {};
  const customPhoto = item.visualMode === "custom" ? item.image || "" : "";
  openModal(`
    <h2>${existing ? "Edit" : "Add"} recipe</h2><p class="modal-subtitle">Keep the essentials together so planning stays quick.</p>
    <label class="form-field">Recipe name<input id="recipeName" value="${esc(item.name || "")}" placeholder="Miso salmon bowl" /></label>
    <div class="form-grid"><label class="form-field">Meal type<select id="recipeCategory">${MEALS.map((meal) => `<option value="${meal}" ${item.cat === meal ? "selected" : ""}>${MEAL_LABEL[meal]}</option>`).join("")}</select></label><label class="form-field">Photo URL (optional)<input id="recipeImage" type="url" value="${esc(customPhoto)}" placeholder="Leave blank to use a real meal photo" /></label></div>
    <div class="form-grid"><label class="form-field">Calories<input id="recipeCalories" type="number" min="0" value="${item.cal || ""}" placeholder="450" /></label><label class="form-field">Prep time in minutes<input id="recipeTime" type="number" min="0" value="${item.time || ""}" placeholder="25" /></label></div>
    <label class="form-field">Tags<input id="recipeTags" value="${esc((item.tags || []).join(", "))}" placeholder="high-protein, quick" /></label>
    <label class="form-field">Ingredients — one per line<textarea id="recipeIngredients" placeholder="0.5 cup rolled oats\n2 eggs">${esc((item.ingredients || []).map(ingToLine).join("\n"))}</textarea></label>
    <label class="form-field">Steps — one per line<textarea id="recipeSteps">${esc((item.steps || []).join("\n"))}</textarea></label>
    <div class="modal-actions">${existing ? '<button class="button danger" type="button" data-delete-recipe>Delete</button>' : ""}<button class="button secondary" type="button" data-close-modal-secondary>Cancel</button><button class="button" type="button" data-save-recipe>Save recipe</button></div>`);
  $("[data-close-modal-secondary]").onclick = closeModal;
  $("[data-save-recipe]").onclick = () => {
    const name = $("#recipeName").value.trim();
    if (!name) {
      toast("Recipe name is required");
      $("#recipeName").focus();
      return;
    }
    const duplicateName = state.recipes.find((recipeItem) => recipeItem !== existing && recipeNameKey(recipeItem.name) === recipeNameKey(name));
    if (duplicateName) {
      toast(`“${duplicateName.name}” already exists`);
      $("#recipeName").focus();
      return;
    }
    const customImage = $("#recipeImage").value.trim();
    const data = {
      name,
      cat: $("#recipeCategory").value,
      image: customImage,
      visualMode: customImage ? "custom" : "auto",
      cal: Math.max(0, Number($("#recipeCalories").value) || 0),
      time: Math.max(0, Number($("#recipeTime").value) || 0),
      tags: $("#recipeTags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
      ingredients: $("#recipeIngredients").value.split("\n").map(parseIngLine).filter(Boolean),
      steps: $("#recipeSteps").value.split("\n").map((step) => step.trim()).filter(Boolean)
    };
    if (existing) Object.assign(existing, data);
    else state.recipes.push({ id: uid(), ...data });
    state.inventory = mergeRecipeIngredientsIntoInventory(state.recipes, state.inventory);
    save();
    closeModal();
    render();
    toast("Recipe saved");
  };
  const deleteButton = $("[data-delete-recipe]");
  if (deleteButton) deleteButton.onclick = () => {
    if (state.recipes.length <= 1) {
      toast("Keep at least one recipe so your four-week plan stays populated");
      return;
    }
    if (!window.confirm(`Delete “${existing.name}”? It will also be removed from your plan.`)) return;
    state.recipes = state.recipes.filter((recipeItem) => recipeItem.id !== existing.id);
    Object.keys(state.plan).forEach((date) => MEALS.forEach((meal) => {
      if (state.plan[date][meal] === existing.id) state.plan[date][meal] = null;
    }));
    keepRollingMealPlanComplete();
    save();
    closeModal();
    navigate("/recipes", { replace: true });
    toast("Recipe deleted");
  };
  $("#recipeName").focus();
}

function inventoryModal() {
  openModal(`
    <h2>Add inventory item</h2><p class="modal-subtitle">NourishPlan will subtract this quantity from your grocery needs.</p>
    <label class="form-field">Item name<input id="inventoryName" placeholder="Brown rice" /></label>
    <div class="form-grid"><label class="form-field">Quantity<input id="inventoryQuantity" type="number" min="0" step="0.25" value="1" /></label><label class="form-field">Unit<select id="inventoryUnit"><option value="">count</option>${["cup", "tbsp", "tsp", "g", "kg", "ml", "l", "oz", "lb", "pc", "can", "clove", "slice", "bunch", "head"].map((unit) => `<option>${unit}</option>`).join("")}</select></label></div>
    <div class="modal-actions"><button class="button secondary" type="button" data-close-modal-secondary>Cancel</button><button class="button" type="button" data-save-inventory>Add to inventory</button></div>`);
  $("[data-close-modal-secondary]").onclick = closeModal;
  $("[data-save-inventory]").onclick = () => {
    const name = $("#inventoryName").value.trim();
    if (!name) {
      toast("Item name is required");
      $("#inventoryName").focus();
      return;
    }
    const qty = Math.max(0, Number($("#inventoryQuantity").value) || 0);
    const unit = $("#inventoryUnit").value;
    const key = keyOf(name, unit);
    const existing = state.inventory.find((item) => keyOf(item.name, item.unit) === key);
    if (existing) existing.qty = round1(existing.qty + qty);
    else state.inventory.push({ id: uid(), name, qty, unit });
    save();
    closeModal();
    render();
    toast("Added to inventory");
  };
  $("#inventoryName").focus();
}

function setInventoryQuantity(key, quantity, fallbackItem) {
  const matches = state.inventory.filter((item) => keyOf(item.name, item.unit) === key);
  if (!matches.length && fallbackItem) {
    state.inventory.push({ id: uid(), name: fallbackItem.name, qty: quantity, unit: fallbackItem.unit });
    return;
  }
  matches.forEach((item, index) => {
    item.qty = index === 0 ? quantity : 0;
  });
}

function inventoryQuantityModal(key) {
  const catalogItem = allRecipeIngredients(state.recipes).find((item) => item.key === key);
  const inventoryItem = state.inventory.find((item) => keyOf(item.name, item.unit) === key);
  const item = catalogItem || inventoryItem;
  if (!item) {
    toast("Inventory item was not found");
    return;
  }
  const currentQuantity = round1(inventoryByKey()[key] || 0);
  openModal(`
    <h2>Update ${esc(item.name)}</h2><p class="modal-subtitle">Set the exact quantity currently available in your inventory.</p>
    <label class="form-field">Quantity on hand<input id="inventoryQuantityUpdate" type="number" min="0" step="0.25" value="${currentQuantity}" /></label>
    <p class="form-hint">Unit: ${item.unit ? esc(item.unit) : "count"}. Set the quantity to 0 to mark this ingredient out of stock.</p>
    <div class="modal-actions"><button class="button secondary" type="button" data-close-modal-secondary>Cancel</button><button class="button" type="button" data-save-inventory-quantity>Save quantity</button></div>`);
  $("[data-close-modal-secondary]").onclick = closeModal;
  $("[data-save-inventory-quantity]").onclick = () => {
    const quantity = round1(Math.max(0, Number($("#inventoryQuantityUpdate").value) || 0));
    setInventoryQuantity(key, quantity, item);
    save();
    closeModal();
    render();
    toast(quantity > 0 ? "Inventory quantity updated" : `${item.name} marked out of stock`);
  };
  $("#inventoryQuantityUpdate").focus();
  $("#inventoryQuantityUpdate").select();
}

function markInventoryOutOfStock(key) {
  const item = allRecipeIngredients(state.recipes).find((ingredient) => ingredient.key === key)
    || state.inventory.find((inventoryItem) => keyOf(inventoryItem.name, inventoryItem.unit) === key);
  if (!item) return;
  setInventoryQuantity(key, 0, item);
  save();
  render();
  toast(`${item.name} marked out of stock`);
}

function extraModal() {
  openModal(`
    <h2>Add grocery extra</h2><p class="modal-subtitle">Add something that is not part of a planned recipe.</p>
    <label class="form-field">Item name<input id="extraName" placeholder="Sparkling water" /></label>
    <div class="form-grid"><label class="form-field">Quantity<input id="extraQuantity" type="number" min="0" step="0.25" value="1" /></label><label class="form-field">Unit<select id="extraUnit"><option value="">count</option>${["cup", "tbsp", "tsp", "g", "kg", "ml", "l", "oz", "lb", "pc", "can", "bunch", "head"].map((unit) => `<option>${unit}</option>`).join("")}</select></label></div>
    <div class="modal-actions"><button class="button secondary" type="button" data-close-modal-secondary>Cancel</button><button class="button" type="button" data-save-extra>Add to list</button></div>`);
  $("[data-close-modal-secondary]").onclick = closeModal;
  $("[data-save-extra]").onclick = () => {
    const name = $("#extraName").value.trim();
    if (!name) {
      toast("Item name is required");
      $("#extraName").focus();
      return;
    }
    state.extras.push({
      id: uid(),
      name,
      qty: Math.max(0, Number($("#extraQuantity").value) || 1) || 1,
      unit: $("#extraUnit").value
    });
    save();
    closeModal();
    render();
    toast("Added to grocery list");
  };
  $("#extraName").focus();
}

function pickerRows(date, meal, query = "") {
  const normalizedQuery = query.trim().toLowerCase();
  const matches = state.recipes.filter((item) => !normalizedQuery
    || item.name.toLowerCase().includes(normalizedQuery)
    || item.tags.join(" ").toLowerCase().includes(normalizedQuery));
  const sorted = [...matches].sort((a, b) => Number(b.cat === meal) - Number(a.cat === meal) || a.name.localeCompare(b.name));
  return sorted.length ? sorted.map((item) => `<button class="picker-row" type="button" data-choose-recipe="${item.id}" data-picker-date="${date}" data-picker-meal="${meal}"><img src="${esc(recipeImage(item))}" alt="" /><div><strong>${esc(item.name)}</strong><span>${item.cal} kcal · ${fmtPeso(mealCostPeso(item))} est. · ${item.time} min</span></div><span class="tag">${MEAL_LABEL[item.cat]}</span></button>`).join("") : '<div class="empty-state">No matching recipes.</div>';
}

function pickerModal(date, meal) {
  openModal(`<h2>${MEAL_LABEL[meal]} · ${fmtDow(date)} ${fmtDate(date)}</h2><p class="modal-subtitle">Choose a recipe for this meal slot.</p><input class="search-input" id="pickerSearch" type="search" placeholder="Search recipes" style="width:100%;margin-bottom:12px" /><div class="picker-list" id="pickerList">${pickerRows(date, meal)}</div>`);
  wirePickerRows();
  $("#pickerSearch").oninput = (event) => {
    $("#pickerList").innerHTML = pickerRows(date, meal, event.target.value);
    wirePickerRows();
  };
  $("#pickerSearch").focus();
}

function wirePickerRows() {
  $$('[data-choose-recipe]').forEach((button) => {
    button.onclick = () => {
      const date = button.dataset.pickerDate;
      const meal = button.dataset.pickerMeal;
      if (!state.plan[date]) state.plan[date] = {};
      state.plan[date][meal] = button.dataset.chooseRecipe;
      save();
      closeModal();
      render();
      toast("Meal planned");
    };
  });
}

function quickAddModal() {
  const dates = weekDates(weekOffset);
  openModal(`
    <h2>Add a meal</h2><p class="modal-subtitle">Choose a day and meal type, then select a recipe.</p>
    <div class="form-grid"><label class="form-field">Day<select id="quickDate">${dates.map((date) => `<option value="${date}" ${date === todayISO() ? "selected" : ""}>${fmtLong(date)}</option>`).join("")}</select></label><label class="form-field">Meal<select id="quickMeal">${MEALS.map((meal) => `<option value="${meal}">${MEAL_LABEL[meal]}</option>`).join("")}</select></label></div>
    <div class="modal-actions"><button class="button secondary" type="button" data-close-modal-secondary>Cancel</button><button class="button" type="button" data-continue-add>Choose recipe</button></div>`);
  $("[data-close-modal-secondary]").onclick = closeModal;
  $("[data-continue-add]").onclick = () => pickerModal($("#quickDate").value, $("#quickMeal").value);
}

function settingsModal() {
  openModal(`
    <h2>Data & preferences</h2><p class="modal-subtitle">Your meal plan stays in this browser. Export it whenever you want a backup.</p>
    <div class="form-grid"><button class="button" type="button" data-export>${icon("ph-download-simple")} Export JSON</button><button class="button secondary" type="button" data-import>${icon("ph-upload-simple")} Import JSON</button></div>
    <input id="importFile" type="file" accept="application/json" hidden />
    <div style="border-top:1px solid var(--line);margin:22px 0 14px"></div>
    <button class="button danger" type="button" data-reset style="width:100%">Reset example data</button>`);
  $("[data-export]").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `nourishplan-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    toast("Backup exported");
  };
  $("[data-import]").onclick = () => $("#importFile").click();
  $("#importFile").onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!window.confirm("Replace current NourishPlan data with this backup?")) return;
        state = normalize(imported);
        save();
        closeModal();
        render();
        toast("Backup restored");
      } catch {
        toast("That backup file is not valid");
      }
    };
    reader.readAsText(file);
  };
  $("[data-reset]").onclick = () => {
    if (!window.confirm("Reset everything to the NourishPlan example data?")) return;
    state = normalize(seed());
    save();
    closeModal();
    navigate("/planner", { replace: true });
    toast("Example data restored");
  };
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    toast("Location is not available in this browser");
    return;
  }
  if (activeLocationRequest) {
    activeLocationRequest.cancelled = true;
    if (activeLocationRequest.watchId !== null && navigator.geolocation.clearWatch) {
      navigator.geolocation.clearWatch(activeLocationRequest.watchId);
    }
    clearTimeout(activeLocationRequest.timer);
  }
  const buttons = $$('[data-use-location]');
  buttons.forEach((button) => {
    button.disabled = true;
    button.innerHTML = icon("ph-spinner-gap") + " Finding a precise fix…";
  });

  let bestPosition = null;
  let settled = false;
  const request = { watchId: null, timer: null, cancelled: false };
  activeLocationRequest = request;

  const cleanup = () => {
    if (request.watchId !== null && navigator.geolocation.clearWatch) {
      navigator.geolocation.clearWatch(request.watchId);
    }
    clearTimeout(request.timer);
    if (activeLocationRequest === request) activeLocationRequest = null;
  };

  const finishWithBestPosition = () => {
    if (settled || request.cancelled) return;
    settled = true;
    cleanup();
    if (!bestPosition || !Number.isFinite(bestPosition.coords.accuracy)
      || bestPosition.coords.accuracy > LOCATION_MAX_USABLE_ACCURACY_METERS) {
      render();
      toast(userLocation.source === "browser"
        ? "A newer precise fix could not be confirmed. Keeping your previous location."
        : "A precise location could not be confirmed. Showing BGC estimates instead.");
      return;
    }
    userLocation = {
      lat: bestPosition.coords.latitude,
      lng: bestPosition.coords.longitude,
      label: "Your current location",
      source: "browser",
      accuracy: bestPosition.coords.accuracy,
      timestamp: bestPosition.timestamp
    };
    render();
    toast("Stores are sorted using a ±" + Math.round(bestPosition.coords.accuracy) + " m location fix");
  };

  const receivePosition = (position) => {
    if (settled || request.cancelled || !Number.isFinite(position.coords.accuracy)) return;
    if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) bestPosition = position;
    buttons.forEach((button) => {
      button.innerHTML = icon("ph-spinner-gap") + " Improving accuracy · ±" + Math.round(bestPosition.coords.accuracy) + " m";
    });
    if (bestPosition.coords.accuracy <= LOCATION_TARGET_ACCURACY_METERS) {
      setTimeout(finishWithBestPosition, 0);
    }
  };

  const fail = (error) => {
    if (settled || request.cancelled) return;
    if (bestPosition) {
      finishWithBestPosition();
      return;
    }
    settled = true;
    cleanup();
    render();
    const fallbackMessage = userLocation.source === "browser" ? " Keeping your previous location." : " Showing BGC estimates instead.";
    const message = error?.code === 1
      ? "Location permission was denied." + fallbackMessage
      : error?.code === 3
        ? "Location timed out. Move near a window and try again." + fallbackMessage
        : "Location was unavailable." + fallbackMessage;
    toast(message);
  };

  const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
  request.timer = setTimeout(finishWithBestPosition, LOCATION_SAMPLE_WINDOW_MS);
  if (navigator.geolocation.watchPosition) {
    request.watchId = navigator.geolocation.watchPosition(receivePosition, fail, options);
  } else {
    navigator.geolocation.getCurrentPosition(receivePosition, fail, options);
  }
}

function movePurchasedToInventory() {
  const { toBuy } = groceryData();
  let moved = 0;
  toBuy.filter((item) => state.checked[item.key]).forEach((item) => {
    const existing = state.inventory.find((inventoryItem) => keyOf(inventoryItem.name, inventoryItem.unit) === item.key);
    if (existing) existing.qty = round1(existing.qty + item.buy);
    else state.inventory.push({ id: uid(), name: item.name, qty: item.buy, unit: item.unit });
    delete state.checked[item.key];
    moved += 1;
  });
  state.extras = state.extras.filter((extra) => {
    const checkedKey = `x:${extra.id}`;
    if (!state.checked[checkedKey]) return true;
    const key = keyOf(extra.name, extra.unit);
    const existing = state.inventory.find((inventoryItem) => keyOf(inventoryItem.name, inventoryItem.unit) === key);
    if (existing) existing.qty = round1(existing.qty + extra.qty);
    else state.inventory.push({ id: uid(), name: extra.name, qty: extra.qty, unit: extra.unit });
    delete state.checked[checkedKey];
    moved += 1;
    return false;
  });
  save();
  render();
  toast(`${moved} item${moved === 1 ? "" : "s"} moved to inventory`);
}

function wire(route) {
  $$('[data-route]').forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      event.preventDefault();
      navigate(href);
    });
  });
  $("[data-open-nav]")?.addEventListener("click", () => document.body.classList.add("mobile-nav-open"));
  $("[data-close-nav]")?.addEventListener("click", () => document.body.classList.remove("mobile-nav-open"));
  $("[data-settings]")?.addEventListener("click", settingsModal);
  $("#globalSearch")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    recipeQuery = event.target.value;
    navigate("/recipes");
  });

  $$('[data-planner-mode]').forEach((button) => button.addEventListener("click", () => {
    plannerMode = button.dataset.plannerMode;
    render();
  }));
  $$('[data-period-nav]').forEach((button) => button.addEventListener("click", () => {
    const delta = Number(button.dataset.periodNav);
    if (plannerMode === "week") weekOffset += delta;
    else {
      const date = dateFromISO(dayDate);
      date.setDate(date.getDate() + delta);
      dayDate = isoOf(date);
    }
    render();
  }));
  $("[data-planner-today]")?.addEventListener("click", () => {
    weekOffset = 0;
    dayDate = todayISO();
    render();
  });
  $$('[data-pick]').forEach((button) => button.addEventListener("click", () => {
    const [date, meal] = button.dataset.pick.split("|");
    pickerModal(date, meal);
  }));
  $$('[data-calendar-options]').forEach((button) => button.addEventListener("click", () => {
    const [date, meal] = button.dataset.calendarOptions.split("|");
    calendarMealPickerModal(date, meal);
  }));
  $("[data-quick-add]")?.addEventListener("click", quickAddModal);

  $("[data-new-recipe]")?.addEventListener("click", () => recipeModal());
  $$('[data-edit-recipe]').forEach((button) => button.addEventListener("click", () => recipeModal(recipeById(button.dataset.editRecipe))));
  $$('[data-recipe-cat]').forEach((button) => button.addEventListener("click", () => {
    recipeCat = button.dataset.recipeCat;
    render();
  }));
  const recipeSearch = $("#recipeSearch");
  if (recipeSearch) recipeSearch.addEventListener("input", (event) => {
    recipeQuery = event.target.value;
    const cursor = event.target.selectionStart;
    render();
    const replacement = $("#recipeSearch");
    replacement?.focus();
    replacement?.setSelectionRange(cursor, cursor);
  });

  $("[data-new-inventory]")?.addEventListener("click", inventoryModal);
  $$('[data-inventory-plus]').forEach((button) => button.addEventListener("click", () => adjustInventory(button.dataset.inventoryPlus, 1)));
  $$('[data-inventory-minus]').forEach((button) => button.addEventListener("click", () => adjustInventory(button.dataset.inventoryMinus, -1)));
  $$('[data-inventory-delete]').forEach((button) => button.addEventListener("click", () => {
    state.inventory = state.inventory.filter((item) => item.id !== button.dataset.inventoryDelete);
    save();
    render();
    toast("Inventory item removed");
  }));
  $$('[data-update-inventory]').forEach((button) => button.addEventListener("click", () => inventoryQuantityModal(button.dataset.updateInventory)));
  $$('[data-out-of-stock]').forEach((button) => button.addEventListener("click", () => markInventoryOutOfStock(button.dataset.outOfStock)));
  $$('[data-grocery-section-toggle]').forEach((button) => button.addEventListener("click", () => {
    const section = button.dataset.grocerySectionToggle;
    if (!(section in grocerySections)) return;
    grocerySections[section] = !grocerySections[section];
    render();
  }));
  $("[data-grocery-expand-all]")?.addEventListener("click", () => {
    Object.keys(grocerySections).forEach((section) => {
      grocerySections[section] = true;
    });
    render();
  });
  $("[data-grocery-collapse-all]")?.addEventListener("click", () => {
    Object.keys(grocerySections).forEach((section) => {
      grocerySections[section] = false;
    });
    render();
  });

  $("[data-new-extra]")?.addEventListener("click", extraModal);
  $$('[data-grocery-check]').forEach((checkbox) => checkbox.addEventListener("change", () => {
    const key = checkbox.dataset.groceryCheck;
    if (checkbox.checked) state.checked[key] = true;
    else delete state.checked[key];
    save();
    render();
  }));
  $("[data-purchased]")?.addEventListener("click", movePurchasedToInventory);
  $$('[data-use-location]').forEach((button) => button.addEventListener("click", useCurrentLocation));
  $("#storeSort")?.addEventListener("change", (event) => {
    storeSort = event.target.value;
    render();
  });
  if (route.section === "meal-map") initMealVisualization();
}

function adjustInventory(id, delta) {
  const item = state.inventory.find((inventoryItem) => inventoryItem.id === id);
  if (!item) return;
  item.qty = round1(Math.max(0, item.qty + delta));
  save();
  render();
}

window.addEventListener("popstate", render);
window.addEventListener("storage", (event) => {
  if (event.key !== LS || !event.newValue) return;
  try {
    state = normalize(JSON.parse(event.newValue));
    render();
  } catch {}
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("#modalRoot").children.length) closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#globalSearch")?.focus();
  }
});

render();
