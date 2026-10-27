import assert from "node:assert/strict";
import { containsCitrus } from "../lib/citrus-free.mjs";
import { IMPORTED_RECIPE_DEFINITIONS } from "../lib/imported-recipes.mjs";
import { CALENDAR_MEAL_DEFINITIONS } from "../lib/calendar-meals.mjs";

for (const name of ["lemon juice", "lime zest", "calamansi", "grapefruit", "orange segments", "pomelo", "mandarin", "yuzu", "dalandan", "dayap", "kumquat"]) {
  assert.ok(containsCitrus(name), name);
}
for (const name of ["pineapple", "apple cider vinegar", "lemongrass", "orange squash", "citrus-free"]) {
  assert.ok(!containsCitrus(name), name);
}
assert.ok(!containsCitrus(IMPORTED_RECIPE_DEFINITIONS));
assert.ok(!containsCitrus(CALENDAR_MEAL_DEFINITIONS));

const storage = new Map();
const app = { innerHTML: "" };
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.history = { pushState() {}, replaceState() {} };
globalThis.window = {
  location: { pathname: "/recipes" }, matchMedia: () => ({ matches: false }),
  addEventListener() {}, scrollTo() {}, confirm: () => true
};
globalThis.document = {
  title: "", addEventListener() {},
  body: { classList: { add() {}, remove() {} }, style: {} },
  querySelector: (selector) => selector === "#app" ? app : null,
  querySelectorAll: () => [],
  createElement: () => ({ classList: { add() {}, remove() {} }, remove() {}, click() {}, style: {} })
};
let serial = 0;
const load = async () => {
  await import(`../app.js?citrus-test=${serial++}`);
  return JSON.parse(storage.get("nourishplan.v2"));
};
const fresh = await load();
assert.equal(fresh.recipes.length, 152);
assert.ok(!containsCitrus(fresh));
assert.match(app.innerHTML, /Apple Pear Ginger Juice/);
assert.match(app.innerHTML, /Garlic-Herb Grilled Chicken Bowl/);

const legacy = structuredClone(fresh);
legacy.contentVersion = 16;
const chicken = legacy.recipes.find((item) => item.name === "Garlic-Herb Grilled Chicken Bowl");
chicken.name = "Citrus-Herb Grilled Chicken Bowl";
chicken.ingredients = [{ qty: 2, unit: "tbsp", name: "lemon juice" }];
chicken.steps = ["Marinate the chicken with lemon juice and grill until the center reaches 74°C."];
const juice = legacy.recipes.find((item) => item.name === "Apple Pear Ginger Juice");
juice.name = "Grapefruit Orange Ginger Juice";
juice.ingredients = [{ qty: 1, unit: "pc", name: "grapefruit" }];
juice.sourceNotes = ["Peel the orange."];
legacy.inventory.push({ id: "fruit-stock", name: "lemon", qty: 3, unit: "pc" });
legacy.inventory.push({ id: "kept-stock", name: "special rice", qty: 7, unit: "cup" });
legacy.extras.push({ id: "old-extra", name: "calamansi", qty: 4, unit: "pc" });
legacy.extras.push({ id: "kept-extra", name: "dish soap", qty: 1, unit: "pc" });
legacy.checked["lemon|pc"] = true;
const preservedPlan = structuredClone(legacy.plan);
storage.set("nourishplan.v2", JSON.stringify(legacy));
const migrated = await load();
assert.ok(!containsCitrus(migrated));
assert.deepEqual(migrated.plan, preservedPlan, "replacement dishes retain recipe IDs and existing plan selections");
assert.equal(migrated.recipes.find((item) => item.id === chicken.id).name, "Garlic-Herb Grilled Chicken Bowl");
assert.equal(migrated.recipes.find((item) => item.id === juice.id).name, "Apple Pear Ginger Juice");
assert.equal(migrated.inventory.find((item) => item.id === "kept-stock").qty, 7);
assert.ok(migrated.extras.some((item) => item.id === "kept-extra"));
assert.ok(migrated.inventory.filter((item) => item.name === "rice vinegar").every((item) => item.qty === 0), "removed fruit stock must not become vinegar stock");
assert.deepEqual(await load(), migrated, "repeat loads must preserve recipes, IDs and plan");

const imported = structuredClone(migrated);
imported.recipes.push({ id: "custom-citrus", name: "My Yuzu Tea", cat: "snack", ingredients: [{ name: "yuzu", qty: 1, unit: "pc" }], steps: ["Steep the yuzu."] });
storage.set("nourishplan.v2", JSON.stringify(imported));
assert.ok(!(await load()).recipes.some((item) => item.id === "custom-citrus"), "imports and cloud payloads must not reintroduce unknown citrus dishes");
console.log("Citrus checks passed: fresh recipes, calendar meals, existing plans, inventory, imports and repeat loads.");
