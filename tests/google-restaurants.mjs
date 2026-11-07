import assert from "node:assert/strict";
import { searchGoogleOpenRestaurants } from "../server/google-restaurants.mjs";

const location = { lat: 14.55, lng: 121.05, radius: 3000 }; // Synthetic engineering fixture.
await assert.rejects(searchGoogleOpenRestaurants(location, {
  apiKey: "", fetchImpl: () => { throw Error("must not call without a configured key"); }
}), (error) => error.code === "RESTAURANT_PROVIDER_NOT_CONFIGURED");

let calls = 0;
const result = await searchGoogleOpenRestaurants(location, {
  apiKey: "test-only-placeholder", now: new Date("2026-11-07T12:00:00Z"),
  fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(options.cache, "no-store");
    const body = JSON.parse(options.body);
    assert.equal(body.openNow, true);
    assert.equal(body.pageSize, 20);
    assert.equal(body.rankPreference, "DISTANCE");
    assert.equal(body.includedType, "restaurant");
    assert.equal(body.strictTypeFiltering, true);
    assert.match(options.headers["X-Goog-FieldMask"], /places.currentOpeningHours/);
    return { ok: true, json: async () => ({ places: [
      { id: "open", displayName: { text: "Synthetic open venue" }, location: { latitude: 14.551, longitude: 121.05 }, currentOpeningHours: { openNow: true }, businessStatus: "OPERATIONAL", types: ["japanese_restaurant", "restaurant"], googleMapsUri: "https://maps.google.com/", attributions: [{ provider: "Synthetic provider", providerUri: "https://example.com/" }] },
      { id: "unknown", displayName: { text: "Synthetic unknown venue" }, location: { latitude: 14.551, longitude: 121.05 }, currentOpeningHours: {}, businessStatus: "OPERATIONAL" },
      { id: "closed", displayName: { text: "Synthetic closed venue" }, location: { latitude: 14.551, longitude: 121.05 }, currentOpeningHours: { openNow: false }, businessStatus: "OPERATIONAL" },
      { id: "future", displayName: { text: "Synthetic future venue" }, location: { latitude: 14.551, longitude: 121.05 }, currentOpeningHours: { openNow: true }, businessStatus: "FUTURE_OPENING" },
      { id: "far", displayName: { text: "Synthetic distant venue" }, location: { latitude: 15.551, longitude: 121.05 }, currentOpeningHours: { openNow: true }, businessStatus: "OPERATIONAL" }
    ] }) };
  }
});
assert.equal(calls, 1);
assert.equal(result.places.length, 1);
assert.equal(result.places[0].name, "Synthetic open venue");
assert.match(result.places[0].cuisine, /japanese/);
assert.equal(result.places[0].attributions[0].provider, "Synthetic provider");
assert.equal(result.source, "Google Maps");
assert.equal(result.cacheable, false);
assert.ok(result.validUntil > result.checkedAt);
await assert.rejects(searchGoogleOpenRestaurants({ ...location, lat: 91 }, { apiKey: "test" }), /Invalid search location/);
await assert.rejects(searchGoogleOpenRestaurants(location, { apiKey: "test", fetchImpl: async () => ({ ok: false, status: 429 }) }), (error) => error.code === "GOOGLE_PLACES_HTTP_429");
console.log("Google provider mocked checks passed: missing key makes no call, explicit openNow, strict status/distance exclusion, attribution, no-store and provider failure.");
