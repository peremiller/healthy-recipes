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
assert.equal(similarDiningMeals({ name: "Tofu Pinakbet", tags: ["plant-based"] })[0].key, "vegetable-tofu-rice");
assert.ok(similarDiningMeals({ name: "Miso Salmon Fillet", tags: ["pescatarian"] }).every((food) => food.key.startsWith("fish-")));
assert.deepEqual(similarDiningMeals({ name: "Oat Yogurt Cup", tags: ["gluten-free"] }), []);
assert.ok(similarDiningMeals({ name: "Lunch: V-Taper Foundation Day", ingredients: [{ name: "chicken breast" }, { name: "brown rice" }], steps: ["Grill chicken and serve with rice."] }).length > 0, "program names use actual ingredients and preparation");
const fishIdeas = similarDiningMeals({ name: "Miso Glazed Salmon Fillet", steps: ["Bake salmon until cooked."] });
assert.deepEqual(fishIdeas.map((food) => food.name), ["Baked salmon with vegetables", "Baked bangus with vegetables", "Baked tilapia with vegetables", "Baked lapu-lapu with vegetables"]);
assert.ok(similarDiningMeals({ name: "Grilled bangus" }).some((food) => food.name === "Grilled lapu-lapu with vegetables"));
assert.equal(similarDiningMeals({ name: "Steamed tilapia" })[0].name, "Steamed tilapia with vegetables");
assert.ok(fishIdeas.every((food) => !/chicken|pork|beef|poultry/i.test(food.name)));
for (const name of ["Miso Glazed Salmon Fillet", "Tokwa Mushroom Sisig Lettuce Cups", "Tofu Pinakbet with Adlai", "Soy Cacao Chia Pudding", "Mediterranean Falafel & Egg Bowl"]) assert.equal(placesForMeal(meal(name), places).places.length, 0, "do not force a different main ingredient to fill a sparse directory");
assert.equal(breakfast.chainCount, 1);
assert.equal(breakfast.places.length, 1, "show one nearest branch per chain");
assert.ok(breakfast.places[0].additionalBranches.length > 0);
const dining = createNearbyDining({ clock: () => Date.parse(fixture.checkedAt), fetchImpl: async () => ({ ok: true, json: async () => fixture }) });
await dining.selectArea("mckinley");
const rendered = dining.renderMeal(meal("Lean Chicken Tinola Bowl"));
assert.match(rendered, /Similar meals · limited directory/);
assert.match(rendered, /Selected meal: Lean Chicken Tinola Bowl/);
assert.match(rendered, /Suggested meal: Chicken arroz caldo/);
assert.match(rendered, /Why similar:/);
assert.match(rendered, /What changes:/);
assert.match(rendered, /Arroz Caldo with Grilled Chicken Breast add-on/);
assert.ok(rendered.includes(mealMapsUrl(meal("Chicken arroz caldo"), { lat: 14.5343064, lng: 121.0505976 }).replaceAll("&", "&amp;")));
assert.ok(rendered.includes(mealMapsUrl(meal("Lean Chicken Tinola Bowl"), { lat: 14.5343064, lng: 121.0505976 }).replaceAll("&", "&amp;")), "retain the original meal search as well");
assert.doesNotMatch(dining.renderMeal(meal("Egg & Cheese Breakfast Plate")), /Suggested meal:|No supported match/);
assert.match(dining.renderControls(), /Limited menu coverage:.*Denny.*McDonald/);
assert.match(dining.renderControls(), /not a comprehensive restaurant search/);
assert.match(rendered, /not live-confirmed/);
assert.match(rendered, /Schedule page checked/);
assert.match(rendered, /Chain menu; branch availability unconfirmed/);
assert.match(rendered, /more branches of this same chain/);
assert.equal((rendered.match(/<li>/g) || []).length, 1);
const fishMarkup = dining.renderMeal({ name: "Miso Glazed Salmon Fillet" });
assert.match(fishMarkup, /Search Grilled bangus with vegetables on Maps/);
assert.match(fishMarkup, /Search Grilled tilapia with vegetables on Maps/);
assert.match(fishMarkup, /Search Grilled lapu-lapu with vegetables on Maps/);
assert.doesNotMatch(fishMarkup, /Chicken Teriyaki|Denny|McDonald/);
assert.match(fishMarkup, /Other nearby restaurants may serve it/);
dining.handleOffline();
assert.doesNotMatch(dining.renderMeal(meal("Lean Chicken Tinola Bowl")), /Denny|Suggested meal:/, "do not show fallback venues as open from an expired/offline check");
console.log("Per-meal menu checks passed: primary-first ranking, explained similar-meal fallback, verified menu provenance, open-only results, program meals, dietary exclusions and unchanged plans.");
