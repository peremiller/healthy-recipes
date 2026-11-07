import assert from "node:assert/strict";
import { diabeticAlternativeFor, isDiabeticFriendlyRecipe } from "../lib/diabetic-alternatives.mjs";
import { containsCitrus } from "../lib/citrus-free.mjs";

const currentItem = { id: "dessert", name: "Dessert", cat: "snack", tags: ["healthy", "no-added-sugar"], cal: 50 };
const friendly = (id, cat = "snack") => ({ id, name: id, cat, tags: ["steady-blood-sugar"] });
assert.equal(isDiabeticFriendlyRecipe(currentItem), false, "calories and no-added-sugar must not imply suitability");
assert.equal(isDiabeticFriendlyRecipe(null), false);
assert.equal(isDiabeticFriendlyRecipe({ tags: "steady-blood-sugar" }), false);
assert.equal(isDiabeticFriendlyRecipe({ tags: [" Diabetes-Friendly "] }), true);
const options = {
  date: "2026-12-31", meal: "snack", currentItem,
  recipes: [currentItem, friendly("previous"), friendly("next"), friendly("same-day"), friendly("eligible"), friendly("wrong-type", "dinner"), { ...friendly("pancake"), name: "Oat Pancake" }],
  plan: { "2026-12-30": { snack: "previous" }, "2026-12-31": { snack: "dessert", breakfast: "same-day" }, "2027-01-01": { dinner: "next" } }
};
const original = structuredClone(options);
assert.equal(diabeticAlternativeFor(options)?.id, "eligible");
assert.deepEqual(options, original, "rendering suggestions must not mutate recipes or plans");
assert.equal(diabeticAlternativeFor({ ...options, currentItem: friendly("already-friendly") }), null);
assert.equal(diabeticAlternativeFor({ ...options, currentItem: null }), null);
assert.equal(diabeticAlternativeFor({ ...options, recipes: [friendly("wrong-type", "dinner")] }), null, "never substitute another meal type");
assert.equal(diabeticAlternativeFor({ ...options, recipes: [friendly("previous"), currentItem] }), null, "never fall back to an untagged or adjacent-day recipe");
assert.equal(diabeticAlternativeFor(options)?.id, diabeticAlternativeFor(options)?.id, "suggestions must stay stable across renders");

// Exercise the actual seeded app, both planner views, and its normal save handler.
const storage = new Map();
const appElement = { innerHTML: "" };
const handlers = new Map();
let mobile = false;
const element = () => ({ classList: { add() {}, remove() {} }, style: {}, remove() {}, appendChild() {} });
const modal = { ...element(), innerHTML: "" };
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
globalThis.history = { pushState() {}, replaceState() {} };
globalThis.requestAnimationFrame = (callback) => callback();
globalThis.window = { location: { pathname: "/planner" }, matchMedia: () => ({ matches: mobile }), addEventListener() {}, scrollTo() {}, confirm: () => true };
globalThis.document = {
  title: "", addEventListener() {}, body: element(), createElement: element,
  querySelector: (selector) => selector === "#app" ? appElement : selector === "#modalRoot" ? modal : selector === "#toastRoot" ? element() : null,
  querySelectorAll: (selector) => {
    const attribute = selector === "[data-use-meal-alternative]" ? "use-meal-alternative" : selector === "[data-planner-mode]" ? "planner-mode" : null;
    if (!attribute) return [];
    const key = attribute.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    return [...appElement.innerHTML.matchAll(new RegExp(`data-${attribute}="([^"]+)"`, "g"))].map((match) => ({
      dataset: { [key]: match[1] }, addEventListener: (_event, callback) => handlers.set(match[1], callback)
    }));
  }
};
await import("../app.js?test=diabetic-alternatives");
const readState = () => JSON.parse(storage.get("nourishplan.v2"));
const state = readState();
const beforePlan = structuredClone(state.plan);
let checked = 0;
for (const [date, day] of Object.entries(state.plan)) {
  for (const [meal, id] of Object.entries(day)) {
    const item = state.recipes.find((recipe) => recipe.id === id);
    const result = diabeticAlternativeFor({ date, meal, currentItem: item, recipes: state.recipes, plan: state.plan });
    if (isDiabeticFriendlyRecipe(item)) assert.equal(result, null);
    else {
      assert.ok(result, `missing alternative for ${date} ${meal}: ${item.name}`);
      assert.equal(result.cat, meal);
      assert.ok(isDiabeticFriendlyRecipe(result));
      assert.equal(containsCitrus([result.name, result.ingredients, result.steps]), false);
      checked += 1;
    }
  }
}
assert.ok(checked > 50, "cover the seeded four-week plan");
assert.match(appElement.innerHTML, /data-alternative-kind="diabetes"/);
assert.match(appElement.innerHTML, /Diabetic-friendly alternative/);
assert.deepEqual(readState().plan, beforePlan, "displaying suggestions leaves the saved plan unchanged");
const weekSlots = [...appElement.innerHTML.matchAll(/class="week-cell meal-slot[^]*?<\/div>\s*<\/div>/g)];
assert.ok(weekSlots.length > 0);
for (const match of appElement.innerHTML.matchAll(/data-use-meal-alternative="([^|"]+)\|([^|"]+)\|([^|"]+)\|diabetes"/g)) {
  const [, date, meal, id] = match;
  const item = state.recipes.find((recipe) => recipe.id === state.plan[date][meal]);
  assert.equal(isDiabeticFriendlyRecipe(item), false, "friendly slots must not get redundant alternatives");
  assert.equal(state.recipes.find((recipe) => recipe.id === id).cat, meal);
}
handlers.get("day")();
assert.match(appElement.innerHTML, /day-timeline/);
const choice = [...appElement.innerHTML.matchAll(/data-use-meal-alternative="([^|"]+\|[^|"]+\|[^|"]+\|diabetes)"/g)][0]?.[1];
assert.ok(choice, "day view must include the same feature");
const [date, meal, id] = choice.split("|");
handlers.get(choice)();
const saved = readState();
assert.equal(saved.plan[date][meal], id, "one click must save the chosen alternative");
assert.equal(isDiabeticFriendlyRecipe(saved.recipes.find((recipe) => recipe.id === id)), true);
assert.ok(!appElement.innerHTML.includes(`data-use-meal-alternative="${date}|${meal}|`), "swapped friendly meal must no longer need an alternative");
for (const [day, meals] of Object.entries(beforePlan)) for (const [slot, recipeId] of Object.entries(meals)) {
  if (day !== date || slot !== meal) assert.equal(saved.plan[day][slot], recipeId, "swap must affect only the chosen slot");
}
assert.match(appElement.innerHTML, new RegExp(`data-day-cost="[0-9]+"`));
await import("../app.js?test=diabetic-reload");
assert.equal(readState().plan[date][meal], id, "selection must persist after reload");
mobile = true;
await import("../app.js?test=diabetic-mobile");
assert.match(appElement.innerHTML, /day-timeline/);
console.log(`Diabetic alternatives passed: ${checked} non-friendly seeded slots, tag boundaries, category/repeat rules, Week/Day/mobile rendering, single-slot save and reload.`);
