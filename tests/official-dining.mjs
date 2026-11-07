import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OFFICIAL_RESTAURANT_DIRECTORY as directory } from "../server/data/official-restaurants.mjs";
import { searchOfficialRestaurants } from "../server/official-dining.mjs";
import { openingState } from "../server/restaurants.mjs";
import { handleRestaurantRequest, searchConfiguredProvider } from "../api/restaurants.js";
import { createNearbyDining } from "../lib/nearby-dining.mjs";

const now = new Date("2026-11-07T13:00:00Z");
const location = { lat: 14.535, lng: 121.05, radius: 3000 }; // Public McKinley area, not user GPS.
assert.equal(directory.length, 812);
assert.equal(new Set(directory.map((place) => place.id)).size, directory.length);
assert.equal(directory.filter((place) => place.hours).length, 689);
for (const place of directory) {
  assert.ok(place.lat >= 4 && place.lat <= 22 && place.lng >= 116 && place.lng <= 127);
  assert.ok(["https://www.mcdonalds.com.ph/store-locator", "https://www.dennys.ph/location"].includes(place.sourceUrl));
  if (place.hours) assert.notEqual(openingState(place.hours, place, now), "unknown", place.name);
}
const result = searchOfficialRestaurants(location, { now });
assert.ok(result.places.some((place) => place.name === "Denny's Mckinley"));
assert.ok(result.places.some((place) => place.name === "McDonald's Venice Grand Canal"));
assert.ok(result.places.every((place) => place.openNow === true && place.distanceKm <= 3));
const lasPinas = searchOfficialRestaurants({ lat: 14.43331, lng: 121.0121, radius: 3000 }, { now });
assert.ok(lasPinas.places.some((place) => place.name === "McDonald's New SM Southmall"));
const unknown = { ...directory[0], id: "synthetic-unknown", name: "Synthetic unknown", lat: location.lat, lng: location.lng, hours: null };
const closed = { ...unknown, id: "synthetic-closed", name: "Synthetic closed", hours: "Sa 08:00-10:00" };
const fallback = searchOfficialRestaurants(location, { now, directory: [unknown, closed] });
assert.equal(fallback.places.length, 0);
assert.equal(fallback.nearbyPlaces.find((place) => place.id === unknown.id).openNow, null);
assert.equal(fallback.nearbyPlaces.find((place) => place.id === closed.id).openNow, false);
assert.equal(searchOfficialRestaurants({ lat: 0, lng: 0, radius: 5000 }, { now }).places.length, 0);
assert.equal((await searchConfiguredProvider(location, { apiKey: "", google: () => { throw Error("no external call expected"); } })).source, "Official restaurant directories");
assert.equal((await searchConfiguredProvider(location, { apiKey: "synthetic-test-key", google: async () => { throw Error("provider down"); } })).source, "Official restaurant directories");
const response = await handleRestaurantRequest(new Request("https://example.com/api/restaurants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(location) }));
assert.equal(response.status, 200, "default API works without a provider key or upstream network");
assert.ok((await response.json()).places.length > 0);

let permissionState = "prompt", requests = 0;
const controller = createNearbyDining({ clock: () => +now,
  permissions: () => ({ query: async () => ({ state: permissionState }) }),
  geolocation: () => ({ getCurrentPosition(success) { requests++; success({ coords: { latitude: location.lat, longitude: location.lng, accuracy: 30 } }); } }),
  fetchImpl: async () => ({ ok: true, json: async () => result }) });
await controller.initialize();
assert.equal(requests, 0, "never prompt for location automatically");
permissionState = "granted";
const granted = createNearbyDining({ clock: () => +now,
  permissions: () => ({ query: async () => ({ state: permissionState }) }),
  geolocation: () => ({ getCurrentPosition(success) { requests++; success({ coords: { latitude: location.lat, longitude: location.lng, accuracy: 30 } }); } }),
  fetchImpl: async () => ({ ok: true, json: async () => result }) });
await granted.initialize();
await granted.initialize();
assert.equal(requests, 1, "reuse granted permission once at startup");
const markup = granted.renderMeal({ name: "Egg plate" });
assert.match(markup, /Denny&#39;s Mckinley/);
assert.match(markup, /Open per published hours/);
assert.match(markup, /Official hours/);
assert.doesNotMatch(markup, /OpenStreetMap|unavailable/);
let areaRequests = 0;
const areaController = createNearbyDining({ clock: () => +now, geolocation: () => { throw Error("area selection must not request GPS"); }, fetchImpl: async (_url, options) => {
  areaRequests++;
  const point = JSON.parse(options.body);
  assert.equal(point.lat, 14.5343064);
  return { ok: true, json: async () => fallback };
} });
await areaController.selectArea("mckinley");
assert.equal(areaRequests, 1);
assert.match(areaController.renderMeal({ name: "Any meal" }), /Synthetic unknown[\s\S]*Hours unconfirmed/);
assert.match(areaController.renderMeal({ name: "Any meal" }), /Synthetic closed[\s\S]*Closed per published hours/);
assert.doesNotMatch(areaController.renderMeal({ name: "Any meal" }), /dining-open/);
areaController.handleOffline();
assert.equal(areaController.snapshot().nearbyPlaces.length, 0);
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const alternatives = app.slice(app.indexOf("function renderMealAlternatives("), app.indexOf("function ", app.indexOf("function renderMealAlternatives(") + 10));
assert.doesNotMatch(alternatives, /nearbyDining.renderMeal/, "alternatives share the single timeslot restaurant panel");
console.log("Official directory passed: 812 sourced branches, valid schedules, McKinley/Las Piñas coverage, keyless API, outage fallback, direct names, accurate unknown/closed labels, granted-only startup and no duplicate alternative panel.");
