import assert from "node:assert/strict";
import { fillRollingMealPlan, isPlannerRecipeAllowed } from "../lib/meal-plan.mjs";

const recipes = [
  { id: "pancakes", name: "Healthy Hot Pancakes", cat: "breakfast" },
  { id: "singular", name: "Banana Pancake", cat: "breakfast" },
  { id: "alias", name: "Morning treat", aliases: ["OAT PANCAKES"], cat: "breakfast" },
  { id: "oats", name: "Overnight Oats", cat: "breakfast" }
];
const plan = {
  "2026-08-31": { breakfast: "pancakes" },
  "2027-01-01": { breakfast: "singular", lunch: "saved-lunch" }
};
const options = { plan, recipes, currentDate: new Date(2026, 8, 1), weeks: 1, meals: ["breakfast"] };
const repaired = fillRollingMealPlan(options);
assert.ok(Object.values(repaired.plan).every((day) => day.breakfast === "oats"));
assert.equal(repaired.plan["2027-01-01"].lunch, "saved-lunch");
assert.equal(plan["2026-08-31"].breakfast, "pancakes", "repair must not mutate the input");
assert.ok(repaired.filled > 0, "saved repairs must trigger persistence");
assert.deepEqual(fillRollingMealPlan({ ...options, plan: repaired.plan }).plan, repaired.plan);
const noAlternatives = fillRollingMealPlan({ ...options, recipes: recipes.slice(0, 3) });
assert.ok(Object.values(noAlternatives.plan).every((day) => !day.breakfast));
assert.ok(isPlannerRecipeAllowed({ name: "Carrot Oat Breakfast Muffins", image: "pancakes" }));

const storage = new Map();
const appElement = { innerHTML: "" };
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.history = { pushState() {}, replaceState() {} };
globalThis.window = {
  location: { pathname: "/planner" },
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
  createElement: () => ({ classList: { add() {}, remove() {} }, remove() {}, click() {}, style: {} })
};
const loadState = async (label) => {
  await import(`../app.js?test=planner-exclusions-${label}`);
  return JSON.parse(storage.get("nourishplan.v2"));
};
const assertNoPancakes = (state) => {
  const excluded = new Set(state.recipes.filter((item) => !isPlannerRecipeAllowed(item)).map((item) => item.id));
  assert.ok(Object.values(state.plan).every((day) => Object.values(day || {}).every((id) => !excluded.has(id))));
  assert.doesNotMatch(appElement.innerHTML, /Healthy Hot Pancakes|Dark Chocolate &amp; Orange Pancakes/);
};
const fresh = await loadState("fresh");
assertNoPancakes(fresh);
const pancakes = fresh.recipes.filter((item) => !isPlannerRecipeAllowed(item));
assert.equal(pancakes.length, 2, "planner exclusions must preserve the recipe library");
const date = Object.keys(fresh.plan).sort()[0];
const existingLunch = fresh.plan[date].lunch;
fresh.plan[date].breakfast = pancakes[0].id;
fresh.plan["2027-01-01"] = { breakfast: pancakes[1].id, lunch: existingLunch };
fresh.recipes.push({ ...pancakes[0], id: "custom-pancake", name: "My Banana Pancake", aliases: [] });
fresh.plan["2027-01-02"] = { breakfast: "custom-pancake" };
storage.set("nourishplan.v2", JSON.stringify(fresh));
const migrated = await loadState("saved");
assertNoPancakes(migrated);
assert.equal(migrated.plan["2027-01-01"].lunch, existingLunch);
assert.equal(migrated.recipes.filter((item) => !isPlannerRecipeAllowed(item)).length, 3);
assertNoPancakes(await loadState("repeat"));
console.log("Planner exclusion checks passed: fresh plans, saved and future dates, custom recipes, aliases, and repeat loads.");
