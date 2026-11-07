import { OFFICIAL_DIRECTORY_META, OFFICIAL_RESTAURANT_DIRECTORY } from "./data/official-restaurants.mjs";
import { openingState, validateRestaurantLocation } from "./restaurants.mjs";
import { haversineKm } from "../lib/geo.mjs";

// A server-bundled directory has no network or API-key dependency. Evaluate its
// published schedules at request time; do not imply live closure confirmation.
export function searchOfficialRestaurants(input, { now = new Date(), directory = OFFICIAL_RESTAURANT_DIRECTORY } = {}) {
  const location = validateRestaurantLocation(input);
  const nearby = directory.flatMap((place) => {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return [];
    const distanceKm = haversineKm(location, place);
    if (distanceKm * 1000 > location.radius) return [];
    const status = openingState(place.hours, place, now);
    return [{ ...place, distanceKm: Math.round(distanceKm * 100) / 100,
      openNow: status === "unknown" ? null : status === "open", openingStatus: status }];
  }).sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));
  return {
    places: nearby.filter((place) => place.openNow === true).slice(0, 100),
    // Still display actual names with truthful status when no open option exists.
    nearbyPlaces: nearby.filter((place) => place.openNow !== true).slice(0, 30),
    unknownCount: nearby.filter((place) => place.openNow === null).length,
    closedCount: nearby.filter((place) => place.openNow === false).length,
    checkedAt: now.toISOString(), validUntil: new Date(+now + 300000).toISOString(),
    radiusMeters: location.radius, source: "Official restaurant directories",
    dataMode: "saved-directory", hoursVerification: "published-schedule",
    directoryCheckedAt: OFFICIAL_DIRECTORY_META.checkedAt,
    coverageNote: OFFICIAL_DIRECTORY_META.coverage, cacheable: true
  };
}
