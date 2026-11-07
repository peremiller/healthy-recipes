import assert from "node:assert/strict";
import { createNearbyDining, placesForMeal, mealMapsUrl } from "../lib/nearby-dining.mjs";
import { mealDiningKeys, menuMatchesForMeal } from "../lib/restaurant-menu-matches.mjs";
import { searchOfficialRestaurants } from "../server/official-dining.mjs";
import { similarDiningMeals } from "../lib/similar-dining-meals.mjs";

const fixture = searchOfficialRestaurants({ lat: 14.5343064, lng: 121.0505976, radius: 5000 }, { now: new Date("2026-11-07T13:00:00Z") });
const { places } = fixture;
const meal = (name) => ({ name });
const breakfast = placesForMeal(meal("Egg & Cheese Breakfast Plate"), places);
assert.ok(breakfast.places.length > 0);
assert.ok(breakfast.places.every((place) => place.brand === "Denny's"), "McDonald's breakfast sandwiches are not egg-plate matches");
assert.equal(breakfast.places[0].menuMatches[0].name, "Cheesy Omu Rice");
const alternative = placesForMeal(meal("Malunggay Egg-White Omelet & Kamote"), places);
assert.ok(alternative.places.length > 0);
assert.match(alternative.places[0].menuMatches[0].name, /Shroom/);
assert.notEqual(breakfast.places[0].menuMatches[0].name, alternative.places[0].menuMatches[0].name, "the menu reason changes even if a restaurant serves both related dishes");
const pasta = placesForMeal(meal("Seafood Linguine"), places);
assert.ok(pasta.places.every((place) => place.menuMatches.some((food) => food.name === "Savannah Shrimp pasta")));
assert.equal(placesForMeal(meal("Healthy Carbonara"), places).places[0].menuMatches[0].name, "Creamy Bacon Carbonara");
assert.equal(placesForMeal(meal("Chicken Teriyaki"), places).places[0].menuMatches[0].name, "Chicken Teriyaki");
assert.ok(placesForMeal(meal("Chocolate Chip Ice Cream"), places).places.some((place) => place.brand === "McDonald's"));
for (const name of ["Savory Oatmeal with Tofu & Pechay", "Unknown dish", "Carrot Oat Breakfast Muffins"]) {
  assert.equal(placesForMeal(meal(name), places).places.length, 0, `${name}: never backfill unrelated restaurants`);
}
assert.deepEqual(mealDiningKeys(meal("Mediterranean Falafel & Egg Bowl")), [], "incidental egg does not turn falafel into an egg plate");
assert.equal(placesForMeal(meal("Carbonara"), [{ name: "Synthetic Italian place", cuisine: "italian", openNow: true, distanceKm: 0.1 }]).places.length, 0, "cuisine alone is not evidence of a menu match");
assert.equal(placesForMeal(meal("Carbonara"), [{ ...pasta.places[0], openNow: false }]).places.length, 0);
const matches = menuMatchesForMeal(meal("Carbonara"), { brand: "Denny's" });
assert.ok(matches.every((food) => food.sourceUrl === "https://dennys.ph/assets/pdf/Dennys_Menu.pdf#page=29"));
assert.equal(breakfast.similar, false, "a primary meal match always wins before fallback");
const cases = [
  ["Lean Chicken Tinola Bowl", "Chicken arroz caldo", /Arroz Caldo/],
  ["Apple Oat-Bran Yogurt Cup", "Yogurt, berries and granola bowl", /Berry Good Yogurt/],
  ["Soy Cacao Chia Pudding", "Yogurt, berries and granola bowl", /Berry Good Yogurt/],
  ["Tofu Pinakbet with Adlai", "Eggplant omelette with rice", /Eggplant Tortalette/],
  ["Mediterranean Falafel & Egg Bowl", "Eggplant omelette with rice", /Eggplant Tortalette/],
  ["Tokwa Mushroom Sisig Lettuce Cups", "Mushroom omelette", /Shroom/],
  ["Miso Glazed Salmon Fillet", "Grilled chicken, rice and vegetable plate", /Chicken Teriyaki/],
  ["Garlic-Herb Grilled Chicken Bowl", "Grilled chicken with rice and vegetables", /Chicken Teriyaki/],
  ["Green Papaya Cucumber Salad", "Romaine Caesar salad", /Caesar Salad/]
];
for (const [name, suggested, menu] of cases) {
  const original = meal(name);
  const before = structuredClone(original);
  const found = placesForMeal(original, places);
  assert.equal(found.similar, true, name);
  assert.equal(found.matchedMenu, false);
  assert.ok(found.places.length > 0);
  assert.equal(found.places[0].similarMeal.name, suggested);
  assert.match(found.places[0].menuMatches[0].name, menu);
  assert.ok(found.places.every((place) => place.openNow && place.similarMeal.reason && place.similarMeal.differences));
  assert.deepEqual(original, before, "suggesting a similar restaurant meal must not replace the planned meal");
}
const closedPrimary = [{ name: "Denny's closed", brand: "Denny's", openNow: false, distanceKm: 0.1 }, { name: "McDonald's open", brand: "McDonald's", openNow: true, distanceKm: 0.3 }];
const pastaFallback = placesForMeal(meal("Carbonara"), closedPrimary);
assert.equal(pastaFallback.similar, true, "a closed primary restaurant cannot block an open similar-meal match");
assert.equal(pastaFallback.places[0].name, "McDonald's open");
assert.equal(placesForMeal(meal("Tinola"), [{ ...places[0], openNow: false }]).places.length, 0);
assert.equal(placesForMeal(meal("Tinola"), []).places.length, 0);
assert.deepEqual(similarDiningMeals({ name: "Soy Cacao Chia Pudding", tags: ["vegan"] }), [], "do not suggest dairy yogurt against an explicit vegan diet");
assert.deepEqual(similarDiningMeals({ name: "Tofu Pinakbet", tags: ["plant-based"] }), []);
assert.deepEqual(similarDiningMeals({ name: "Miso Salmon Fillet", tags: ["pescatarian"] }), []);
assert.deepEqual(similarDiningMeals({ name: "Oat Yogurt Cup", tags: ["gluten-free"] }), []);
assert.ok(similarDiningMeals({ name: "Lunch: V-Taper Foundation Day", ingredients: [{ name: "chicken breast" }, { name: "brown rice" }], steps: ["Grill chicken and serve with rice."] }).length > 0, "program names use actual ingredients and preparation");
assert.ok(similarDiningMeals({ name: "Ginger Salmon with Okra & Barley" })[0].differences.includes("Chicken replaces fish"));
const dining = createNearbyDining({ clock: () => Date.parse(fixture.checkedAt), fetchImpl: async () => ({ ok: true, json: async () => fixture }) });
await dining.selectArea("mckinley");
const rendered = dining.renderMeal(meal("Lean Chicken Tinola Bowl"));
assert.match(rendered, /Open nearby · similar meals/);
assert.match(rendered, /Selected meal: Lean Chicken Tinola Bowl/);
assert.match(rendered, /Suggested meal: Chicken arroz caldo/);
assert.match(rendered, /Why similar:/);
assert.match(rendered, /What changes:/);
assert.match(rendered, /Arroz Caldo with Grilled Chicken Breast add-on/);
assert.ok(rendered.includes(mealMapsUrl(meal("Chicken arroz caldo"), { lat: 14.5343064, lng: 121.0505976 }).replaceAll("&", "&amp;")));
assert.ok(rendered.includes(mealMapsUrl(meal("Lean Chicken Tinola Bowl"), { lat: 14.5343064, lng: 121.0505976 }).replaceAll("&", "&amp;")), "retain the original meal search as well");
assert.doesNotMatch(dining.renderMeal(meal("Egg & Cheese Breakfast Plate")), /Suggested meal:|No match for your selected meal/);
dining.handleOffline();
assert.doesNotMatch(dining.renderMeal(meal("Lean Chicken Tinola Bowl")), /Denny|Suggested meal:/, "do not show fallback venues as open from an expired/offline check");
console.log("Per-meal menu checks passed: primary-first ranking, explained similar-meal fallback, verified menu provenance, open-only results, program meals, dietary exclusions and unchanged plans.");
