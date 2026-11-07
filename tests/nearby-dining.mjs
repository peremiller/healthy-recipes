import assert from "node:assert/strict";
import { openingState, validateRestaurantLocation, restaurantsFromElements, fetchRestaurantElements } from "../server/restaurants.mjs";
import { handleRestaurantRequest } from "../api/restaurants.js";
import { createNearbyDining, placesForMeal, mealMapsUrl } from "../lib/nearby-dining.mjs";

// Explicit synthetic fixtures, never a user's current location or live venue data.
const location = { lat: 14.55, lng: 121.05, radius: 5000 };
const now = new Date("2026-11-07T13:00:00Z"); // Saturday 9 PM in Manila.
assert.equal(openingState("Sa 20:00-22:00", location, now), "open");
assert.equal(openingState("Sa 20:00-22:00", location, new Date("2026-11-07T14:00:00Z")), "closed");
assert.equal(openingState("Fr 20:00-02:00", location, new Date("2026-11-06T17:00:00Z")), "open", "overnight Friday hours include Saturday 1 AM");
assert.equal(openingState("24/7", { lat: 40.7, lng: -74 }, now), "open");
assert.equal(openingState("Sa 20:00-22:00", { lat: 40.7, lng: -74 }, now), "closed", "evaluate the venue's timezone, not the server or caller timezone");
for (const hours of [null, "", "PH off; Mo-Su 10:00-22:00", "sunrise-sunset", "by appointment", "not a schedule"]) {
  assert.equal(openingState(hours, location, now), "unknown", `do not guess ${hours}`);
}
for (const input of [{}, { lat: "14.55", lng: 121.05 }, { lat: 91, lng: 0 }, { lat: 0, lng: NaN }, { ...location, radius: 999999 }]) {
  assert.throws(() => validateRestaurantLocation(input));
}
assert.deepEqual(validateRestaurantLocation({ lat: 0, lng: 0 }), { lat: 0, lng: 0, radius: 5000 });
const venue = (id, name, hours, extra = {}) => ({ type: "node", id, lat: 14.55001 + id / 100000, lon: 121.05, tags: { amenity: "restaurant", name, opening_hours: hours, cuisine: "filipino", ...extra } });
const elements = [
  venue(1, "Test Open", "Sa 20:00-22:00", { "website:menu": "javascript:alert(1)" }),
  venue(2, "Test Closed", "Sa 08:00-20:00"), venue(3, "Test Unknown", undefined),
  venue(4, "Test Kitchen Closed", "24/7", { "opening_hours:kitchen": "Sa 08:00-20:00" }),
  venue(5, "Test Private", "24/7", { access: "private" }),
  { ...venue(6, "Test Far Away", "24/7"), lat: 15 },
  { ...venue(7, "Test Open", "Sa 20:00-22:00"), type: "way" },
  venue(8, "Test Café <img onerror=alert(1)>", "24/7", { amenity: "cafe", cuisine: "coffee_shop" })
];
const result = restaurantsFromElements(elements, location, now);
const menuItem = (key) => [{ name: `Synthetic menu ${key}`, mealKeys: [key], sourceUrl: "https://example.com/official-menu" }];
result.places.forEach((place) => { place.menuItems = menuItem(place.name === "Test Open" ? "carbonara" : "chamomile-tea"); });
assert.equal(result.places.length, 2, "exclude closed, unknown, private, distant and duplicate venues");
assert.equal(result.closedCount, 2);
assert.equal(result.unknownCount, 1);
assert.equal(result.places[0].menuUrl, null);
assert.ok(result.places.every((place) => place.openNow && place.distanceKm >= 0));
assert.equal(placesForMeal({ name: "Carbonara" }, result.places).places[0].name, "Test Open");
assert.match(placesForMeal({ name: "Chamomile Tea" }, result.places).places[0].name, /Test Café/);
assert.equal(placesForMeal({ name: "Anything" }, [{ name: "Closed", openNow: false, distanceKm: 0 }]).places.length, 0);
assert.ok(!mealMapsUrl({ name: "Carbonara" }, null).includes("14.55"), "no default or remembered BGC coordinates");

let calls = 0;
const fakeUpstream = async (url, options) => {
  calls += 1;
  assert.equal(url, "https://overpass.private.coffee/api/interpreter");
  assert.ok(options.headers["User-Agent"].includes("NourishPlan"));
  assert.ok(!options.body.get("data").includes("14.550123"), "round coordinates before sending to the public provider");
  return { ok: true, json: async () => ({ elements }) };
};
const cacheLocation = { ...location, lat: 14.550123 };
await fetchRestaurantElements(cacheLocation, { fetchImpl: fakeUpstream, nowMs: 1000 });
await fetchRestaurantElements(cacheLocation, { fetchImpl: fakeUpstream, nowMs: 2000 });
assert.equal(calls, 1, "all meals share one bounded provider request");

const apiRequest = (body, options = {}) => new Request("https://healthy-recipes-murex.vercel.app/api/restaurants", {
  method: "POST", headers: { "Content-Type": "application/json", ...options.headers }, body: JSON.stringify(body)
});
assert.equal((await handleRestaurantRequest(new Request("https://example.com/api/restaurants"))).status, 405);
assert.equal((await handleRestaurantRequest(apiRequest({ lat: "bad" }))).status, 400);
assert.equal((await handleRestaurantRequest(apiRequest(location, { headers: { Origin: "https://unrelated.example" } }))).status, 403);
const data = { ...result, checkedAt: now.toISOString(), validUntil: new Date(+now + 300000).toISOString(), radiusMeters: 5000 };
const apiResponse = await handleRestaurantRequest(apiRequest(location), { search: async () => data });
assert.equal(apiResponse.status, 200);
assert.equal(apiResponse.headers.get("Cache-Control"), "private, no-store");
assert.deepEqual(await apiResponse.json(), data);
assert.equal((await handleRestaurantRequest(apiRequest(location), { search: async () => { throw Error("upstream"); } })).status, 503);

let currentTime = +now;
let locationRequests = 0;
let diningRequests = 0;
const geo = { getCurrentPosition(success) { locationRequests += 1; success({ coords: { latitude: location.lat, longitude: location.lng, accuracy: 30 } }); } };
const controller = createNearbyDining({
  clock: () => currentTime, geolocation: () => geo,
  fetchImpl: async (url, options) => {
    diningRequests += 1;
    assert.equal(url, "/api/restaurants");
    assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ["lat", "lng", "radius"], "do not send recipes, health tags, account data or saved plans");
    return { ok: true, json: async () => data };
  }
});
assert.equal(locationRequests, 0, "wait for the user's location action");
assert.match(controller.renderMeal({ name: "Carbonara" }), /Use my location/);
await controller.locateAndSearch();
assert.equal(controller.snapshot().status, "ready");
assert.match(controller.renderMeal({ name: "Carbonara" }), /Test Open/);
assert.match(controller.renderMeal({ name: "Chamomile Tea" }), /&lt;img onerror/);
assert.doesNotMatch(controller.renderMeal({ name: "Chamomile Tea" }), /<img onerror/);
assert.match(controller.renderMeal({ name: "Carbonara" }), /Exact dish availability is unconfirmed/);
await controller.refreshIfNeeded();
assert.equal(diningRequests, 1);
currentTime += 300001;
assert.doesNotMatch(controller.renderMeal({ name: "Carbonara" }), /Test Open/, "expired data must not be displayed as currently open");
controller.handleOffline();
assert.equal(controller.snapshot().places.length, 0, "offline data must not imply current opening status");
controller.clear();
assert.equal(controller.snapshot().location, null);
assert.equal(controller.snapshot().enabled, false);
const denied = createNearbyDining({ geolocation: () => ({ getCurrentPosition(_success, failure) { failure({ code: 1 }); } }), fetchImpl: () => { throw Error("must not fetch after denial"); } });
await denied.locateAndSearch();
assert.match(denied.snapshot().error, /permission was denied/);
assert.equal(denied.snapshot().location, null);
console.log("Nearby dining passed: venue-local hours, overnight and unknown schedules, distance/cuisine ranking, single request sharing, API validation/no-store, permission denial, expiry, offline and location clearing.");
let googleTime = +now;
let googleRequests = 0;
const googleController = createNearbyDining({
  clock: () => googleTime, geolocation: () => geo,
  fetchImpl: async () => { googleRequests += 1; return { ok: true, json: async () => ({ ...data, source: 'Google Maps', cacheable: false, places: [{ ...data.places[0], attributions: [{ provider: 'Test credit', providerUri: 'https://example.com/credit' }] }] }) }; }
});
await googleController.locateAndSearch();
const googleMarkup = googleController.renderMeal({ name: 'Carbonara' });
assert.match(googleMarkup, /translate="no">Google Maps/);
assert.match(googleMarkup, /https:\/\/example.com\/credit/);
assert.doesNotMatch(googleMarkup, /OpenStreetMap/, 'provider attribution must not mix Google and OSM');
googleTime += 300001;
await googleController.refreshIfNeeded();
assert.equal(googleRequests, 1, 'expired Google content requires user action instead of automatic paid requests');
assert.equal(googleController.snapshot().places.length, 0);

// Explicit meal swaps refresh even a fresh response, without another GPS prompt.
let refreshRequests = 0;
const pending = [];
const swapping = createNearbyDining({ clock: () => +now,
  geolocation: () => { throw Error("a meal swap must not prompt for GPS"); },
  fetchImpl: (_url, options) => {
    refreshRequests++;
    assert.deepEqual(JSON.parse(options.body), { lat: 14.5343064, lng: 121.0505976, radius: 5000 });
    return new Promise((resolve) => pending.push({ resolve, signal: options.signal }));
  }
});
await swapping.refreshForMeal();
assert.equal(refreshRequests, 0, "changing a meal before location opt-in must not search or prompt");
const previous = swapping.selectArea("mckinley");
const latest = swapping.refreshForMeal();
assert.equal(refreshRequests, 2);
assert.equal(pending[0].signal.aborted, true, "supersede an in-flight previous selection");
assert.match(swapping.renderMeal({ name: "Carbonara" }), /Updating restaurants for Carbonara/);
pending[1].resolve({ ok: true, json: async () => ({ ...data, places: [
  { name: "Synthetic Italian", cuisine: "italian", openNow: true, distanceKm: 0.3, menuItems: menuItem("carbonara") },
  { name: "Synthetic Café", cuisine: "cafe", openNow: true, distanceKm: 0.1, menuItems: menuItem("chamomile-tea") },
  { name: "Synthetic now closed", cuisine: "filipino", openNow: false, distanceKm: 0 }
] }) });
await latest;
assert.match(swapping.renderMeal({ name: "Carbonara" }), /Synthetic Italian/);
assert.doesNotMatch(swapping.renderMeal({ name: "Carbonara" }), /Synthetic Café|Synthetic now closed/);
assert.match(swapping.renderMeal({ name: "Chamomile Tea" }), /Synthetic Café/);
pending[0].resolve({ ok: true, json: async () => ({ ...data, places: [{ name: "Synthetic obsolete response", openNow: true, distanceKm: 0.01 }] }) });
await previous;
assert.doesNotMatch(swapping.renderMeal({ name: "Carbonara" }), /Synthetic obsolete response/);
assert.match(swapping.renderMeal({ name: "Carbonara" }), /Selected meal: Carbonara/);
console.log("Meal-change refresh passed: fresh lookup, existing area/radius, no GPS prompt, updated recipe matching and search link, closed-place exclusion, stale-response protection.");
