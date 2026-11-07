import { validateRestaurantLocation } from "../server/restaurants.mjs";
import { searchGoogleOpenRestaurants } from "../server/google-restaurants.mjs";
import { searchOfficialRestaurants } from "../server/official-dining.mjs";

export async function searchConfiguredProvider(input, {
  apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
  google = searchGoogleOpenRestaurants, official = searchOfficialRestaurants
} = {}) {
  if (apiKey) {
    try {
      const live = await google(input, { apiKey });
      if (live.places.length) return live;
      const fallback = await official(input);
      return fallback.places.length || fallback.nearbyPlaces.length ? fallback : live;
    } catch { /* Official directory remains usable during provider outages. */ }
  }
  return official(input);
}

const json = (body, status = 200, extra = {}) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...extra }
});

export async function handleRestaurantRequest(request, { search = searchConfiguredProvider } = {}) {
  if (request.method !== "POST") return json({ error: "Use POST to search nearby restaurants." }, 405, { Allow: "POST" });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Use the restaurant search from this site." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send a JSON location." }, 415);
  if (Number(request.headers.get("content-length")) > 1024) return json({ error: "Location request is too large." }, 413);
  let input;
  try {
    const text = await request.text();
    if (text.length > 1024) return json({ error: "Location request is too large." }, 413);
    input = validateRestaurantLocation(JSON.parse(text));
  } catch { return json({ error: "Provide a valid current location and search radius." }, 400); }
  try { return json(await search(input)); }
  catch {
    // Never log precise coordinates or return stale restaurants as open.
    console.error("Nearby restaurant provider unavailable");
    return json({ error: "Restaurant listings are temporarily unavailable. You can still search Maps for this meal." }, 503);
  }
}

export default { fetch: handleRestaurantRequest };
