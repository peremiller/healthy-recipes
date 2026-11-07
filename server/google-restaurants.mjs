const radians = (degrees) => degrees * Math.PI / 180;
const distanceKm = (a, b) => {
  const deltaLat = radians(b.lat - a.lat);
  const deltaLng = radians(b.lng - a.lng);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export async function searchGoogleOpenRestaurants(location, {
  apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
  fetchImpl = fetch,
  now = new Date()
} = {}) {
  if (!apiKey) {
    const error = new Error("Live restaurant listings need the app owner to configure a server-side Google Places API key. Meal-specific Maps search remains available.");
    error.code = "RESTAURANT_PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  if (!Number.isFinite(location?.lat) || Math.abs(location.lat) > 90 ||
      !Number.isFinite(location?.lng) || Math.abs(location.lng) > 180 ||
      ![1000, 3000, 5000, 10000].includes(location?.radius)) throw new Error("Invalid search location.");
  const response = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.currentOpeningHours,places.businessStatus,places.googleMapsUri,places.formattedAddress,places.primaryType,places.types,places.attributions"
    },
    body: JSON.stringify({
      textQuery: "restaurants", includedType: "restaurant", strictTypeFiltering: true,
      openNow: true, rankPreference: "DISTANCE", pageSize: 20,
      locationBias: { circle: { center: { latitude: location.lat, longitude: location.lng }, radius: location.radius } }
    }),
    signal: AbortSignal.timeout(15000), cache: "no-store"
  });
  if (!response.ok) {
    const error = new Error("The live restaurant provider is unavailable. Search Maps instead.");
    error.code = `GOOGLE_PLACES_HTTP_${response.status}`;
    throw error;
  }
  const data = await response.json();
  const places = (Array.isArray(data.places) ? data.places : []).flatMap((place) => {
    if (place.currentOpeningHours?.openNow !== true || place.businessStatus !== "OPERATIONAL") return [];
    const point = { lat: place.location?.latitude, lng: place.location?.longitude };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !place.displayName?.text) return [];
    const km = distanceKm(location, point);
    if (km > location.radius / 1000) return [];
    return [{
      id: `google/${place.id}`, name: place.displayName.text,
      ...point, distanceKm: Math.round(km * 100) / 100, openNow: true,
      address: place.formattedAddress || "", hours: (place.currentOpeningHours.weekdayDescriptions || []).join("; "),
      cuisine: (place.types || []).map((type) => type.replace(/_restaurant$/, "")).join(";"),
      amenity: "restaurant", sourceUrl: place.googleMapsUri, attributions: place.attributions || []
    }];
  }).sort((a, b) => a.distanceKm - b.distanceKm);
  return {
    places, unknownCount: 0, closedCount: 0,
    checkedAt: now.toISOString(), validUntil: new Date(+now + 300000).toISOString(),
    radiusMeters: location.radius, source: "Google Maps",
    attributionUrl: "https://developers.google.com/maps/documentation/places/web-service/policies",
    // Response is for the active view only; never write it to localStorage,
    // cloud meal state, server provider caches, or offline archives.
    cacheable: false
  };
}
