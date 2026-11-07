import assert from "node:assert/strict";
import { placesForMeal } from "../lib/nearby-dining.mjs";
import { mealDiningKeys, menuMatchesForMeal } from "../lib/restaurant-menu-matches.mjs";
import { searchOfficialRestaurants } from "../server/official-dining.mjs";

const { places } = searchOfficialRestaurants({ lat: 14.5343064, lng: 121.0505976, radius: 5000 }, { now: new Date("2026-11-07T13:00:00Z") });
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
for (const name of ["Mediterranean Falafel & Egg Bowl", "Lean Chicken Tinola Bowl", "Tofu Pinakbet with Adlai", "Miso Glazed Salmon Fillet", "Savory Oatmeal with Tofu & Pechay", "Apple Oat-Bran Yogurt Cup", "Unknown dish"]) {
  assert.equal(placesForMeal(meal(name), places).places.length, 0, `${name}: never backfill unrelated restaurants`);
}
assert.deepEqual(mealDiningKeys(meal("Mediterranean Falafel & Egg Bowl")), [], "incidental egg does not turn falafel into an egg plate");
assert.equal(placesForMeal(meal("Carbonara"), [{ name: "Synthetic Italian place", cuisine: "italian", openNow: true, distanceKm: 0.1 }]).places.length, 0, "cuisine alone is not evidence of a menu match");
assert.equal(placesForMeal(meal("Carbonara"), [{ ...pasta.places[0], openNow: false }]).places.length, 0);
const matches = menuMatchesForMeal(meal("Carbonara"), { brand: "Denny's" });
assert.ok(matches.every((food) => food.sourceUrl === "https://dennys.ph/assets/pdf/Dennys_Menu.pdf#page=29"));
console.log("Per-meal menu checks passed: egg plate vs omelette, seafood vs carbonara, teriyaki, dessert, no unrelated fallback, no cuisine-only claims, closed exclusions and official menu provenance.");
