import OpeningHours from "opening_hours";
import timeZoneAt from "tz-lookup";
import { haversineKm } from "../lib/geo.mjs";

export const RESTAURANT_SOURCE = "https://overpass.private.coffee/api/interpreter";
const upstreamCache = new Map();
const RAW_CACHE_MS = 5 * 60 * 1000;
const ALLOWED_AMENITIES = new Set(["restaurant", "cafe", "fast_food", "food_court", "ice_cream"]);

export function validateRestaurantLocation(input) {
  const { lat, lng, radius = 5000 } = input || {};
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180 ||
      typeof radius !== "number" || ![1000, 3000, 5000, 10000].includes(radius)) {
    throw new Error("Provide a valid current location and a supported search radius.");
  }
  return { lat, lng, radius };
}

// opening_hours evaluates Date's local clock. Convert the current instant to the
// restaurant's wall clock, rather than using the server's or visitor's timezone.
export function openingState(hours, location, now = new Date()) {
  if (typeof hours !== "string" || !hours.trim() || hours.length > 500) return "unknown";
  // Holiday/solar schedules require additional local context. Never guess it.
  if (/\b(?:PH|SH|sunrise|sunset|dawn|dusk)\b/.test(hours)) return "unknown";
  try {
    const timeZone = timeZoneAt(location.lat, location.lng);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(now).map((part) => [part.type, part.value]));
    const wallClock = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second));
    const schedule = new OpeningHours(hours);
    if (schedule.getUnknown(wallClock)) return "unknown";
    return schedule.getState(wallClock) ? "open" : "closed";
  } catch {
    return "unknown";
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function restaurantsFromElements(elements, location, now = new Date()) {
  const places = [];
  let unknownCount = 0;
  let closedCount = 0;
  const seen = [];
  for (const item of Array.isArray(elements) ? elements : []) {
    const tags = item?.tags || {};
    if (!ALLOWED_AMENITIES.has(tags.amenity) && tags.shop !== "bakery") continue;
    if (!tags.name || ["private", "no"].includes(tags.access)) continue;
    const point = { lat: item.lat ?? item.center?.lat, lng: item.lon ?? item.center?.lon };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const distanceKm = haversineKm(location, point);
    if (distanceKm * 1000 > location.radius) continue;
    if (seen.some((old) => old.name === tags.name.toLowerCase() && haversineKm(old.point, point) < 0.04)) continue;
    seen.push({ name: tags.name.toLowerCase(), point });
    const state = openingState(tags.opening_hours, point, now);
    const kitchenState = tags["opening_hours:kitchen"] ? openingState(tags["opening_hours:kitchen"], point, now) : "open";
    if (state === "closed" || kitchenState === "closed") { closedCount += 1; continue; }
    if (state !== "open" || kitchenState !== "open") { unknownCount += 1; continue; }
    if (!["node", "way", "relation"].includes(item.type) || !Number.isSafeInteger(item.id)) continue;
    places.push({
      id: `${item.type}/${item.id}`, name: String(tags.name).slice(0, 180),
      lat: point.lat, lng: point.lng, distanceKm: Math.round(distanceKm * 100) / 100,
      cuisine: String(tags.cuisine || "").slice(0, 200),
      amenity: tags.amenity || "bakery", hours: tags.opening_hours, openNow: true,
      address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean).join(" ").slice(0, 250),
      sourceUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`,
      menuUrl: safeUrl(tags["website:menu"] || tags["contact:website:menu"]),
      website: safeUrl(tags.website || tags["contact:website"])
    });
  }
  places.sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));
  return { places: places.slice(0, 100), unknownCount, closedCount };
}

export async function fetchRestaurantElements(location, { fetchImpl = fetch, nowMs = Date.now() } = {}) {
  // Round before sending coordinates to the public data provider (about 100 m).
  const lat = Number(location.lat.toFixed(3));
  const lng = Number(location.lng.toFixed(3));
  const key = `${lat}|${lng}|${location.radius}`;
  for (const [oldKey, entry] of upstreamCache) if (entry.expires <= nowMs) upstreamCache.delete(oldKey);
  if (upstreamCache.has(key)) return upstreamCache.get(key).promise;
  if (upstreamCache.size >= 32) upstreamCache.delete(upstreamCache.keys().next().value);
  const radius = location.radius + 250;
  const query = `[out:json][timeout:20];(nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"](around:${radius},${lat},${lng});nwr["shop"="bakery"](around:${radius},${lat},${lng}););out body center 1200;`;
  const promise = (async () => {
    const response = await fetchImpl(RESTAURANT_SOURCE, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "NourishPlan/1.0 (https://healthy-recipes-murex.vercel.app; nearby dining search)"
      },
      body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(26000)
    });
    if (!response.ok) throw new Error("Restaurant data is temporarily unavailable. Try again shortly.");
    const data = await response.json();
    if (data.remark || !Array.isArray(data.elements)) throw new Error("The restaurant search could not finish. Try a smaller radius.");
    return data.elements;
  })();
  upstreamCache.set(key, { promise, expires: nowMs + RAW_CACHE_MS });
  try { return await promise; }
  catch (error) { upstreamCache.delete(key); throw error; }
}

export async function searchOpenRestaurants(input, options = {}) {
  const location = validateRestaurantLocation(input);
  const elements = await fetchRestaurantElements(location, options);
  const now = options.now || new Date();
  return {
    ...restaurantsFromElements(elements, location, now),
    checkedAt: now.toISOString(), validUntil: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    radiusMeters: location.radius, source: "OpenStreetMap",
    attributionUrl: "https://www.openstreetmap.org/copyright"
  };
}
