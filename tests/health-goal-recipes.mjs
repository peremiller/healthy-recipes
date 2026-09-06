import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EYE_SUPPORTIVE_RECIPES, IMPORTED_RECIPE_DEFINITIONS } from "../lib/imported-recipes.mjs";
import { fillRollingMealPlan } from "../lib/meal-plan.mjs";

const HEALTH_RECIPE_NAMES = [
  "Savory Oatmeal with Tofu & Pechay",
  "Cherry Chia Yogurt Oats",
  "Malunggay Egg-White Omelet & Kamote",
  "Monggo Malunggay Bowl",
  "Tofu Pinakbet with Adlai",
  "Lean Chicken Tinola Bowl",
  "Calamansi Salmon with Okra & Barley",
  "Tokwa Mushroom Sisig Lettuce Cups",
  "Vegetable Kare-Kare with Brown Rice",
  "Apple Oat-Bran Yogurt Cup",
  "Green Papaya Cucumber Salad",
  "Soy Cacao Chia Pudding"
];
const REQUESTED_BOWL_RECIPE_NAMES = [
  "Citrus-Herb Grilled Chicken Bowl",
  "Miso Glazed Salmon Fillet",
  "Mediterranean Falafel & Egg Bowl"
];
const REQUESTED_BOWL_INGREDIENTS = {
  "Citrus-Herb Grilled Chicken Bowl": ["skinless chicken breast", "cooked tri-color quinoa", "broccoli", "cherry tomatoes", "red onion", "lemon juice", "garlic", "fresh parsley"],
  "Miso Glazed Salmon Fillet": ["salmon fillet", "cooked brown rice", "shelled edamame", "shredded purple cabbage", "cucumber", "white miso paste", "grated ginger", "sesame seeds"],
  "Mediterranean Falafel & Egg Bowl": ["cooked chickpeas", "egg", "hummus", "mixed greens", "kalamata olives", "cucumber", "tahini", "lemon juice"]
};
const IMPORTED_RECIPE_NAMES = IMPORTED_RECIPE_DEFINITIONS.map((item) => item.name);
const EXPECTED_RECIPE_COUNT = 62 + IMPORTED_RECIPE_DEFINITIONS.length;

const storage = new Map();
const appElement = { innerHTML: "" };
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.history = { pushState() {}, replaceState() {} };
globalThis.window = {
  location: { pathname: "/recipes" },
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  scrollTo() {},
  confirm: () => true
};
globalThis.document = {
  title: "",
  body: { classList: { add() {}, remove() {} }, style: {} },
  querySelector: (selector) => selector === "#app" ? appElement : null,
  querySelectorAll: () => [],
  createElement: () => ({
    classList: { add() {}, remove() {} },
    remove() {},
    click() {},
    style: {}
  })
};

const loadState = async (label) => {
  await import(`../app.js?test=${label}-${Date.now()}-${Math.random()}`);
  return JSON.parse(storage.get("nourishplan.v2"));
};

const recipeNameKey = (name) => String(name)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();
const ingredientKey = (ingredient) => `${recipeNameKey(ingredient.name)}|${ingredient.unit || ""}`;
const groceryUnitAlias = { cups: "cup", tbsps: "tbsp", tablespoons: "tbsp", teaspoons: "tsp", tsps: "tsp", grams: "g", gram: "g", kilogram: "kg", pieces: "pc", piece: "pc", pcs: "pc", cans: "can", cloves: "clove", slices: "slice", heads: "head", bunches: "bunch", scoops: "scoop", liters: "l", liter: "l" };
const groceryIngredientKey = (ingredient) => {
  const name = String(ingredient.name || "").trim().toLowerCase().replace(/s$/, "");
  const unit = String(ingredient.unit || "").trim().toLowerCase();
  return `${name}|${groceryUnitAlias[unit] || unit}`;
};

const coverageRecipes = ["a", "b", "c"].map((id) => ({ id, cat: "dinner" }));
const coveragePlan = Object.fromEntries([
  ["2026-08-31", "a"], ["2026-09-01", "b"], ["2026-09-02", "a"], ["2026-09-03", "b"],
  ["2026-09-04", "a"], ["2026-09-05", "b"], ["2026-09-06", "a"]
].map(([date, id]) => [date, { dinner: id }]));
const preservedSelection = fillRollingMealPlan({ plan: coveragePlan, recipes: coverageRecipes, currentDate: new Date(2026, 8, 1), weeks: 1, meals: ["dinner"], ensureCoverage: false });
assert.ok(!Object.values(preservedSelection.plan).some((day) => day.dinner === "c"), "routine plan repair must preserve a user's alternative selection instead of reinserting a missing recipe");
const seededCoverage = fillRollingMealPlan({ plan: coveragePlan, recipes: coverageRecipes, currentDate: new Date(2026, 8, 1), weeks: 1, meals: ["dinner"] });
assert.ok(Object.values(seededCoverage.plan).some((day) => day.dinner === "c"), "initial seeding and migrations must still broaden recipe coverage");

function assertRecipeIntegrity(state, expectedCount) {
  assert.equal(state.recipes.length, expectedCount);
  assert.equal(new Set(state.recipes.map((item) => recipeNameKey(item.name))).size, expectedCount, "recipe names must be unique");
  const signatures = state.recipes.map((item) => `${item.cat}|${item.ingredients.map((ingredient) => `${recipeNameKey(ingredient.name)}:${ingredient.unit}:${ingredient.qty}`).sort().join("|")}`);
  assert.equal(new Set(signatures).size, expectedCount, "exact ingredient-and-quantity duplicates must be consolidated");

  const recipeIngredientKeys = new Set(state.recipes.flatMap((item) => item.ingredients.map(ingredientKey)));
  const inventoryKeys = new Set(state.inventory.map(ingredientKey));
  recipeIngredientKeys.forEach((key) => assert.ok(inventoryKeys.has(key), `inventory is missing ${key}`));

  const plannedDays = Object.keys(state.plan).sort().slice(0, 28);
  const usedRecipeIds = new Set(plannedDays.flatMap((date) => Object.values(state.plan[date] || {})).filter(Boolean));
  assert.ok(usedRecipeIds.size >= 100, "the four-week planner must maintain a broad recipe rotation");
  plannedDays.slice(1).forEach((date, index) => {
    const previousIds = new Set(Object.values(state.plan[plannedDays[index]] || {}));
    Object.values(state.plan[date] || {}).forEach((recipeId) => {
      assert.ok(!previousIds.has(recipeId), `recipe ${recipeId} repeats on consecutive days`);
    });
  });
}

const fresh = await loadState("fresh");
const freshMarkup = appElement.innerHTML;
assert.equal(fresh.contentVersion, 12);
assertRecipeIntegrity(fresh, EXPECTED_RECIPE_COUNT);
assert.equal((freshMarkup.match(/class="recipe-card"/g) || []).length, EXPECTED_RECIPE_COUNT, "all seeded recipes must render as cards");
const renderedImages = [...freshMarkup.matchAll(/<img src="([^"]+)" alt="[^"]+" loading="lazy"/g)].map((match) => match[1]);
assert.equal(renderedImages.length, EXPECTED_RECIPE_COUNT, "every recipe card must render a visual");
renderedImages.forEach((src) => {
  assert.match(src, /^https:\/\/images\.unsplash\.com\//, "managed recipe visuals must be real remote food photographs");
  assert.ok(!src.startsWith("data:image/svg+xml"), "managed recipe visuals must not be generated SVG artwork");
});

window.location.pathname = "/grocery";
await loadState("grocery-coverage");
const groceryMarkup = appElement.innerHTML;
const catalogIngredientKeys = new Set(fresh.recipes.flatMap((item) => item.ingredients.map(groceryIngredientKey)));
const statusRows = [...groceryMarkup.matchAll(/data-recipe-grocery-status="(to-buy|covered)" data-ingredient-key="([^"]+)"/g)];
assert.equal(statusRows.length, catalogIngredientKeys.size, "every recipe ingredient must have one grocery status");
assert.equal(new Set(statusRows.map((match) => match[2])).size, catalogIngredientKeys.size, "recipe ingredients must not have duplicate grocery statuses");
assert.equal((groceryMarkup.match(/data-update-inventory=/g) || []).length, catalogIngredientKeys.size, "every classified recipe ingredient must allow inventory quantity updates");
assert.equal((groceryMarkup.match(/data-out-of-stock=/g) || []).length, statusRows.filter((match) => match[1] === "covered").length, "every covered ingredient must allow marking it out of stock");
assert.equal((groceryMarkup.match(/data-grocery-section-toggle=/g) || []).length, 3, "each grocery section must have an expand or collapse control");
assert.equal((groceryMarkup.match(/aria-expanded="true"/g) || []).length, 3, "all grocery sections must start expanded");
assert.match(groceryMarkup, /data-grocery-expand-all/, "grocery must provide Expand all");
assert.match(groceryMarkup, /data-grocery-collapse-all/, "grocery must provide Collapse all");

window.location.pathname = "/stores";
await loadState("store-location");
const storesMarkup = appElement.innerHTML;
assert.match(storesMarkup, /Use current location/, "stores must offer device location");
assert.match(storesMarkup, /Your location is not saved/, "stores must explain location privacy");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
assert.match(appSource, /watchPosition\(receivePosition, fail, options\)/, "location must sample multiple high-accuracy fixes");
assert.match(appSource, /maximumAge: 0/, "location must reject cached readings");
assert.match(appSource, /LOCATION_TARGET_ACCURACY_METERS = 25/, "location must target a precise fix");
assert.match(appSource, /parameters\.set\("origin",/, "directions must use the captured device coordinates");

window.location.pathname = "/recipes";
HEALTH_RECIPE_NAMES.forEach((name) => {
  const item = fresh.recipes.find((recipe) => recipe.name === name);
  assert.ok(item, `${name} was not seeded`);
  ["steady-blood-sugar", "heart-healthy", "liver-friendly", "cholesterol-conscious", "uric-acid-conscious", "no-added-sugar"]
    .forEach((tag) => assert.ok(item.tags.includes(tag), `${name} is missing ${tag}`));
  assert.ok(item.ingredients.length >= 5, `${name} needs complete ingredients`);
  assert.ok(item.steps.length >= 4, `${name} needs complete preparation steps`);
});
REQUESTED_BOWL_RECIPE_NAMES.forEach((name) => {
  const item = fresh.recipes.find((recipe) => recipe.name === name);
  assert.ok(item, `${name} was not seeded`);
  const ingredientNames = new Set(item.ingredients.map((ingredient) => ingredient.name));
  REQUESTED_BOWL_INGREDIENTS[name].forEach((ingredient) => assert.ok(ingredientNames.has(ingredient), `${name} is missing ${ingredient}`));
  assert.ok(item.steps.length >= 6, `${name} needs complete preparation steps`);
  assert.match(item.image, /^https:\/\/images\.unsplash\.com\//, `${name} must use a real food photograph`);
});
IMPORTED_RECIPE_NAMES.forEach((name) => {
  const item = fresh.recipes.find((recipe) => recipe.name === name);
  assert.ok(item, `${name} was not imported`);
  assert.ok(item.ingredients.length >= 2, `${name} needs measurable ingredients`);
  assert.ok(item.steps.length >= 3, `${name} needs a complete method`);
  assert.ok(item.source, `${name} needs attachment provenance`);
  assert.match(item.image, /^https:\/\/images\.unsplash\.com\//, `${name} must use a real food photograph`);
});
EYE_SUPPORTIVE_RECIPES.forEach(({ name }) => {
  const item = fresh.recipes.find((recipe) => recipe.name === name);
  ["eye-supportive", "vitamin-a-foods", "lutein-zeaxanthin-foods"]
    .forEach((tag) => assert.ok(item.tags.includes(tag), `${name} is missing ${tag}`));
});
assert.deepEqual(
  fresh.recipes.find((item) => item.name === "Tuna Calamansi Yogurt Spread").aliases,
  ["Tuna Yogurt Spread"],
  "equivalent spread names must be retained as aliases instead of duplicate cards"
);

const versionElevenState = {
  ...fresh,
  contentVersion: 11,
  recipes: fresh.recipes.filter((item) => !IMPORTED_RECIPE_NAMES.includes(item.name)),
  inventory: fresh.inventory.map((item) => ({ ...item }))
};
storage.set("nourishplan.v2", JSON.stringify(versionElevenState));
const attachmentMigration = await loadState("attachment-migration");
assertRecipeIntegrity(attachmentMigration, EXPECTED_RECIPE_COUNT);
assert.equal(attachmentMigration.recipes.filter((item) => IMPORTED_RECIPE_NAMES.includes(item.name)).length, IMPORTED_RECIPE_NAMES.length, "version-11 users must receive every attachment recipe once");

const versionEightState = {
  ...fresh,
  contentVersion: 8,
  recipes: fresh.recipes.filter((item) => !HEALTH_RECIPE_NAMES.includes(item.name) && !REQUESTED_BOWL_RECIPE_NAMES.includes(item.name)),
  inventory: fresh.inventory.map((item) => ({ ...item }))
};
versionEightState.recipes.push({
  id: "custom-recipe",
  name: "My Custom Meal",
  cat: "lunch",
  cal: 300,
  time: 10,
  tags: ["custom"],
  ingredients: [{ qty: 2, unit: "cup", name: "custom greens" }],
  steps: ["Prepare the custom meal."],
  visualMode: "auto"
});
versionEightState.inventory.push({ id: "custom-stock", name: "custom greens", qty: 7, unit: "cup" });
storage.set("nourishplan.v2", JSON.stringify(versionEightState));

const migrated = await loadState("migration");
assertRecipeIntegrity(migrated, EXPECTED_RECIPE_COUNT + 1);
assert.equal(migrated.recipes.filter((item) => HEALTH_RECIPE_NAMES.includes(item.name)).length, 12, "migration must add each health recipe once");
assert.equal(migrated.recipes.filter((item) => REQUESTED_BOWL_RECIPE_NAMES.includes(item.name)).length, 3, "migration must add each requested bowl recipe once");
assert.ok(migrated.recipes.some((item) => item.id === "custom-recipe"), "custom recipes must be preserved");
assert.equal(migrated.inventory.find((item) => item.id === "custom-stock")?.qty, 7, "custom inventory quantities must be preserved");

const removedName = HEALTH_RECIPE_NAMES[0];
const removedAttachmentName = IMPORTED_RECIPE_NAMES[0];
migrated.recipes = migrated.recipes.filter((item) => item.name !== removedName && item.name !== removedAttachmentName);
storage.set("nourishplan.v2", JSON.stringify(migrated));
const afterDeletion = await loadState("deletion");
assertRecipeIntegrity(afterDeletion, EXPECTED_RECIPE_COUNT - 1);
assert.ok(!afterDeletion.recipes.some((item) => item.name === removedName), "a version-12 user deletion must remain deleted");
assert.ok(!afterDeletion.recipes.some((item) => item.name === removedAttachmentName), "a version-12 attachment-recipe deletion must remain deleted");

const attachmentDetail = fresh.recipes.find((item) => item.name === "Garden Salad");
window.location.pathname = `/recipes/garden-salad-${attachmentDetail.id}`;
storage.set("nourishplan.v2", JSON.stringify(fresh));
await loadState("attachment-detail");
assert.match(appElement.innerHTML, /Adapted from your attachment/, "attachment recipe details must show their provenance");
assert.match(appElement.innerHTML, /Cook Book\.docx\.pdf \/ Flavorful Healthy Diet_ A Cookbook\.pptx\.pdf/, "attachment recipe details must identify their source files");

window.location.pathname = "/planner";
await loadState("planner-photos");
const plannerMarkup = appElement.innerHTML;
const plannerPhotos = [...plannerMarkup.matchAll(/<img class="meal-thumb" src="([^"]+)"/g)].map((match) => match[1]);
assert.equal(plannerPhotos.length, 28, "the current planner week must render a photo for every meal slot");
const plannerCosts = [...plannerMarkup.matchAll(/data-meal-cost="([0-9]+)"/g)].map((match) => Number(match[1]));
assert.equal(plannerCosts.length, 28, "the current planner week must show an estimated Philippine peso cost for every meal");
plannerCosts.forEach((cost) => assert.ok(cost >= 35, "each meal estimate must be a positive amount"));
assert.match(plannerMarkup, /estimated ingredient costs per serving in Philippine pesos/, "planner must explain the PHP pricing basis");
const visibleSlots = [...plannerMarkup.matchAll(/data-pick="([^|"]+)\|([^"]+)"/g)].map((match) => ({ date: match[1], meal: match[2] }));
const plannedRecipeForSlot = ({ date, meal }) => fresh.recipes.find((item) => item.id === fresh.plan[date]?.[meal]);
const containsTerm = (item, term) => [item?.name, ...(item?.aliases || []), ...(item?.ingredients || []).map((ingredient) => ingredient.name)]
  .some((value) => recipeNameKey(value).includes(term));
const hummusMeals = visibleSlots.map(plannedRecipeForSlot).filter((item) => containsTerm(item, "hummus"));
const turkeyMeals = visibleSlots.map(plannedRecipeForSlot).filter((item) => containsTerm(item, "turkey"));
const hummusAlternatives = [...plannerMarkup.matchAll(/data-use-meal-alternative="([^|"]+)\|([^|"]+)\|([^|"]+)\|hummus"/g)];
const turkeyAlternatives = [...plannerMarkup.matchAll(/data-use-meal-alternative="([^|"]+)\|([^|"]+)\|([^|"]+)\|turkey"/g)];
assert.equal(hummusAlternatives.length, hummusMeals.length, "every visible hummus meal must offer a hummus-free alternative");
assert.equal(turkeyAlternatives.length, turkeyMeals.length, "every visible turkey meal must offer a turkey-free alternative");
turkeyAlternatives.forEach((match) => {
  const alternative = fresh.recipes.find((item) => item.id === match[3]);
  assert.ok(alternative, "each turkey alternative must resolve to a recipe");
  assert.ok(!containsTerm(alternative, "turkey"), "a turkey-free alternative must not contain turkey");
});
assert.match(plannerMarkup, /Turkey-free alternative/, "turkey alternatives must be clearly labeled");
plannerPhotos.forEach((src) => {
  assert.match(src, /^https:\/\/images\.unsplash\.com\//, "planner meal visuals must use real food photographs");
  assert.ok(!src.startsWith("data:image/svg+xml"), "planner meal visuals must not use SVG artwork");
});

window.matchMedia = () => ({ matches: true });
window.location.pathname = "/planner";
await loadState("planner-daily-cost");
const dailyPlannerMarkup = appElement.innerHTML;
const dailyMealCosts = [...dailyPlannerMarkup.matchAll(/data-meal-cost="([0-9]+)"/g)].map((match) => Number(match[1]));
const dailyCost = Number(dailyPlannerMarkup.match(/data-day-cost="([0-9]+)"/)?.[1]);
assert.equal(dailyMealCosts.length, 4, "daily Planner must show a PHP estimate for every meal");
assert.equal(dailyCost, dailyMealCosts.reduce((total, cost) => total + cost, 0), "Daily overview total must equal all meal estimates for that day");
assert.match(dailyPlannerMarkup, /estimated total for all meals today/, "Daily overview must label the full-day PHP total");
window.matchMedia = () => ({ matches: false });

window.location.pathname = "/planner/visualization";
await loadState("planner-visualization");
const visualizationMarkup = appElement.innerHTML;
assert.match(visualizationMarkup, /id="mealVizCanvas"/, "the Planner must expose the 3D meal canvas");
assert.match(visualizationMarkup, /data-viz-filter="breakfast"/, "the 3D meal map must support meal-type filters");
assert.match(visualizationMarkup, /Live Planner data/, "the 3D meal map must identify its live Planner source");
assert.equal((visualizationMarkup.match(/<li>[^<]+, (?:Breakfast|Lunch|Dinner|Snack):/g) || []).length, 28, "the 3D map must expose every meal in the selected week");

const plannedSlots = Object.values(fresh.plan).reduce((total, day) => total + Object.values(day || {}).filter(Boolean).length, 0);
console.log(`Health-goal checks passed: ${fresh.recipes.length} recipes, ${fresh.inventory.length} inventory entries, ${plannedSlots} planned slots.`);
