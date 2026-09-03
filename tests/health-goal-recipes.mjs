import assert from "node:assert/strict";

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

function assertRecipeIntegrity(state, expectedCount) {
  assert.equal(state.recipes.length, expectedCount);
  assert.equal(new Set(state.recipes.map((item) => recipeNameKey(item.name))).size, expectedCount, "recipe names must be unique");

  const recipeIngredientKeys = new Set(state.recipes.flatMap((item) => item.ingredients.map(ingredientKey)));
  const inventoryKeys = new Set(state.inventory.map(ingredientKey));
  recipeIngredientKeys.forEach((key) => assert.ok(inventoryKeys.has(key), `inventory is missing ${key}`));

  const usedRecipeIds = new Set(Object.values(state.plan).flatMap((day) => Object.values(day || {})).filter(Boolean));
  state.recipes.forEach((item) => assert.ok(usedRecipeIds.has(item.id), `${item.name} is missing from the rolling planner`));
}

const fresh = await loadState("fresh");
const freshMarkup = appElement.innerHTML;
assert.equal(fresh.contentVersion, 9);
assertRecipeIntegrity(fresh, 59);
assert.equal((freshMarkup.match(/class="recipe-card"/g) || []).length, 59, "all seeded recipes must render as cards");
const renderedImages = [...freshMarkup.matchAll(/<img src="([^"]+)" alt="[^"]+" loading="lazy"/g)].map((match) => match[1]);
assert.equal(renderedImages.length, 59, "every recipe card must render a visual");
assert.equal(new Set(renderedImages).size, 59, "every recipe visual must be distinct");
HEALTH_RECIPE_NAMES.forEach((name) => {
  const item = fresh.recipes.find((recipe) => recipe.name === name);
  assert.ok(item, `${name} was not seeded`);
  ["steady-blood-sugar", "heart-healthy", "liver-friendly", "cholesterol-conscious", "uric-acid-conscious", "no-added-sugar"]
    .forEach((tag) => assert.ok(item.tags.includes(tag), `${name} is missing ${tag}`));
  assert.ok(item.ingredients.length >= 5, `${name} needs complete ingredients`);
  assert.ok(item.steps.length >= 4, `${name} needs complete preparation steps`);
});

const versionEightState = {
  ...fresh,
  contentVersion: 8,
  recipes: fresh.recipes.filter((item) => !HEALTH_RECIPE_NAMES.includes(item.name)),
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
assertRecipeIntegrity(migrated, 60);
assert.equal(migrated.recipes.filter((item) => HEALTH_RECIPE_NAMES.includes(item.name)).length, 12, "migration must add each health recipe once");
assert.ok(migrated.recipes.some((item) => item.id === "custom-recipe"), "custom recipes must be preserved");
assert.equal(migrated.inventory.find((item) => item.id === "custom-stock")?.qty, 7, "custom inventory quantities must be preserved");

const removedName = HEALTH_RECIPE_NAMES[0];
migrated.recipes = migrated.recipes.filter((item) => item.name !== removedName);
storage.set("nourishplan.v2", JSON.stringify(migrated));
const afterDeletion = await loadState("deletion");
assertRecipeIntegrity(afterDeletion, 59);
assert.ok(!afterDeletion.recipes.some((item) => item.name === removedName), "a version-9 user deletion must remain deleted");

const plannedSlots = Object.values(fresh.plan).reduce((total, day) => total + Object.values(day || {}).filter(Boolean).length, 0);
console.log(`Health-goal checks passed: ${fresh.recipes.length} recipes, ${fresh.inventory.length} inventory entries, ${plannedSlots} planned slots.`);
