import { menuMatchesForMeal } from "./restaurant-menu-matches.mjs";
import { similarDiningMeals } from "./similar-dining-meals.mjs";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
// Public area anchors from the merchant directions links, never a default GPS fix.
const AREAS = [
  { id: "mckinley", name: "McKinley · Venice Grand Canal", lat: 14.5343064, lng: 121.0505976 },
  { id: "uptown", name: "BGC · Uptown Parade", lat: 14.557503, lng: 121.0539937 },
  { id: "southmall", name: "Las Piñas · SM Southmall", lat: 14.43331, lng: 121.0121 },
  { id: "manila", name: "Ermita · Robinsons Manila", lat: 14.5774508, lng: 120.9837601 }
];

const CUISINES = [
  [/oyakodon|teriyaki|miso/i, ["japanese"]],
  [/tinola|monggo|pinakbet|kare-kare|sisig|pancit|adobo|halo-halo|napoleones|malunggay/i, ["filipino"]],
  [/pasta|spaghetti|linguine|gnocchi|risotto|carbonara|ragu/i, ["italian", "pasta"]],
  [/falafel|pita|hummus|mediterranean/i, ["mediterranean", "greek", "lebanese", "middle_eastern"]],
  [/quesadilla|mexican/i, ["mexican"]],
  [/thai/i, ["thai"]],
  [/tea|coffee|oat|yogurt|parfait|smoothie|juice|shake|blend|cooler|cake|muffin|mousse|ice cream|bingsu|pancake|spread|chocolate/i, ["cafe", "bakery", "dessert", "ice_cream", "coffee_shop", "breakfast"]],
  [/salad|tofu|vegetable|lentil|chickpea/i, ["vegetarian", "vegan", "salad", "international"]]
];

export function diningProfile(recipe) {
  const text = String(recipe?.name || "");
  const cuisines = CUISINES.find(([pattern]) => pattern.test(text))?.[1] || [];
  // Calendar program names are not dish names. Use their actual main ingredients.
  const ingredientText = (recipe?.ingredients || []).map((item) => item.name).join(" ");
  const mainFood = ["chicken", "salmon", "fish", "tofu", "egg", "yogurt", "oat", "protein", "apple"].find((term) => ingredientText.toLowerCase().includes(term));
  const query = /v-taper|t-boost|ghost protocol|accelerated|recovery|sleep-support/i.test(text)
    ? `${mainFood || "food"} restaurants`
    : `${text.replace(/\bhealthy\b/gi, "").trim() || "food"} restaurants`;
  return { cuisines, query };
}

export function placesForMeal(recipe, places, limit = 3) {
  const open = places.filter((place) => place.openNow === true && Number.isFinite(place.distanceKm) && place.distanceKm >= 0);
  const matching = open.map((place) => ({ ...place, menuMatches: menuMatchesForMeal(recipe, place) }))
    .filter((place) => place.menuMatches.length);
  if (matching.length) return { places: matching.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit), matchedMenu: true, similar: false, checkedSimilarMeals: [] };
  const suggestions = similarDiningMeals(recipe);
  const related = open.flatMap((place) => {
    for (const suggestion of suggestions) {
      const menuMatches = menuMatchesForMeal(recipe, place, { keys: [suggestion.key] });
      if (menuMatches.length) return [{ ...place, menuMatches, similarMeal: suggestion }];
    }
    return [];
  }).sort((a, b) => b.similarMeal.score - a.similarMeal.score || a.distanceKm - b.distanceKm);
  return { places: related.slice(0, limit), matchedMenu: false, similar: related.length > 0, checkedSimilarMeals: suggestions };
}

export function mealMapsUrl(recipe, location) {
  const near = location ? ` near ${location.lat.toFixed(3)},${location.lng.toFixed(3)}` : " near me";
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${diningProfile(recipe).query} open now${near}` })}`;
}

const distanceText = (km) => km < 1 ? `~${Math.max(10, Math.round(km * 1000 / 10) * 10)} m` : `~${km.toFixed(1)} km`;
const safeExternalUrl = (value) => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
};

export function createNearbyDining({ onChange = () => {}, fetchImpl = (...args) => fetch(...args),
  geolocation = () => typeof navigator !== "undefined" ? navigator.geolocation : null,
  permissions = () => typeof navigator !== "undefined" ? navigator.permissions : null,
  isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false, clock = Date.now } = {}) {
  let state = { status: "idle", enabled: false, location: null, locationLabel: "", areaId: "", places: [], nearbyPlaces: [], checkedAt: null, validUntil: null, radius: 5000, unknownCount: 0, source: null, directoryCheckedAt: null, coverageNote: "", cacheable: true, error: "" };
  let requestId = 0;
  let aborter;
  let initialized = false;
  const fresh = () => state.status === "ready" && Date.parse(state.validUntil) > clock();
  const update = (values) => { state = { ...state, ...values }; onChange(); };

  async function locateAndSearch() {
    if (state.status === "locating" || state.status === "loading") return;
    const id = ++requestId;
    state.enabled = true;
    if (!isOnline()) { update({ status: "offline", places: [], nearbyPlaces: [], error: "Connect to the internet to check which restaurants are open now." }); return; }
    const geo = geolocation();
    if (!geo) { update({ status: "error", places: [], error: "This browser cannot get your location. Use the meal’s Maps search instead." }); return; }
    update({ status: "locating", areaId: "", locationLabel: "Your current location", places: [], nearbyPlaces: [], error: "" });
    let position;
    try {
      position = await new Promise((resolve, reject) => geo.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }));
    } catch (error) {
      if (id !== requestId) return;
      const message = error?.code === 1 ? "Location permission was denied. Allow location for this site, then try again." : "Your current location could not be found. Try again or use the meal’s Maps search.";
      update({ status: "error", location: null, places: [], error: message }); return;
    }
    if (id !== requestId) return;
    const location = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
    if (![location.lat, location.lng].every(Number.isFinite) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) {
      update({ status: "error", location: null, places: [], error: "Your browser returned an invalid location. Please try again." }); return;
    }
    if (!Number.isFinite(location.accuracy) || location.accuracy > 1000) {
      update({ status: "error", location: null, places: [], error: "Location is too imprecise to rank nearby restaurants. Enable precise location, then try again." }); return;
    }
    return searchLocation(location, id);
  }

  async function searchLocation(location, id = ++requestId) {
    state.enabled = true;
    if (!isOnline()) { update({ status: "offline", places: [], nearbyPlaces: [], error: "Connect to check restaurant hours." }); return; }
    update({ status: "loading", location, places: [], nearbyPlaces: [], error: "" });
    aborter?.abort();
    aborter = new AbortController();
    const activeAborter = aborter;
    const timeout = setTimeout(() => activeAborter.abort(), 35000);
    try {
      const response = await fetchImpl("/api/restaurants", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ lat: location.lat, lng: location.lng, radius: state.radius }), signal: activeAborter.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Restaurant search is unavailable.");
      if (!Array.isArray(data.places) || !Number.isFinite(Date.parse(data.validUntil)) || Date.parse(data.validUntil) <= clock()) throw new Error("The restaurant check is out of date. Please refresh it.");
      if (id !== requestId) return;
      update({ status: "ready", places: data.places.filter((place) => place.openNow === true), nearbyPlaces: Array.isArray(data.nearbyPlaces) ? data.nearbyPlaces : [], checkedAt: data.checkedAt, validUntil: data.validUntil, unknownCount: Number(data.unknownCount) || 0, source: data.source || "OpenStreetMap", directoryCheckedAt: data.directoryCheckedAt || null, coverageNote: data.coverageNote || "", cacheable: data.cacheable !== false, error: "" });
    } catch (error) {
      if (id !== requestId) return;
      update({ status: "error", places: [], nearbyPlaces: [], error: error.name === "AbortError" ? "The restaurant search timed out. Please try again." : error.message });
    } finally { clearTimeout(timeout); }
  }

  async function selectArea(areaId) {
    const area = AREAS.find((item) => item.id === areaId);
    if (!area) return;
    state.areaId = area.id;
    state.locationLabel = area.name;
    return searchLocation({ lat: area.lat, lng: area.lng });
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    // Reuse a permission already granted to this site; never trigger a new
    // permission prompt until the user chooses Use my location.
    try {
      const permission = await permissions()?.query({ name: "geolocation" });
      if (permission?.state === "granted" && !state.enabled) await locateAndSearch();
    } catch { /* Unsupported Permissions API leaves the explicit button. */ }
  }

  function clear() {
    requestId += 1; aborter?.abort();
    update({ status: "idle", enabled: false, location: null, locationLabel: "", areaId: "", places: [], nearbyPlaces: [], checkedAt: null, validUntil: null, source: null, directoryCheckedAt: null, coverageNote: "", error: "" });
  }

  function refreshIfNeeded() {
    if (state.enabled && state.source === "Google Maps" && !fresh() && state.status === "ready") {
      update({ status: "stale", places: [], nearbyPlaces: [], error: "Refresh to check which restaurants are open now." });
      return Promise.resolve();
    }
    if (state.source === "Google Maps") return Promise.resolve();
    if (state.enabled && !["locating", "loading", "error"].includes(state.status) && !fresh()) return state.areaId ? selectArea(state.areaId) : locateAndSearch();
    return Promise.resolve();
  }

  function refreshForMeal() {
    // A successful meal selection is an explicit refresh action. Keep the
    // chosen location/radius, recheck hours, and rerank the new recipe when the
    // shared area response arrives. searchLocation supersedes older requests.
    // Never trigger a location prompt merely because the user changed a meal.
    if (!state.enabled || !state.location) return Promise.resolve();
    return searchLocation(state.location);
  }

  function handleOffline() {
    if (!state.enabled) return;
    requestId += 1; aborter?.abort();
    update({ status: "offline", places: [], nearbyPlaces: [], error: "Connect to the internet to check which restaurants are open now." });
  }

  function renderControls() {
    const busy = ["locating", "loading"].includes(state.status);
    const status = busy ? (state.status === "locating" ? "Getting your current location…" : "Checking nearby restaurant hours…")
      : fresh() ? `Menu matches checked separately for each meal within ${state.radius / 1000} km · ${state.locationLabel} · Evaluated ${new Date(state.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : state.error || "Use your current location to see open restaurants beside every meal.";
    return `<section class="dining-controls surface" aria-label="Nearby restaurant settings">
      <div><strong>Open restaurants near you</strong><p role="status">${esc(status)}</p><small>Open now follows published hours, not the meal’s scheduled time. Distances are straight-line estimates. Menus and dietary options need confirmation.</small>
      ${!state.enabled ? '<small>Location is used only for this search and isn’t saved with your meal plan. <a href="/privacy.html" target="_blank">Privacy</a></small>' : ""}${state.coverageNote ? `<small>${esc(state.coverageNote)} Source pages checked ${esc(state.directoryCheckedAt)}; temporary closures may differ.</small>` : ""}</div>
      <div class="dining-control-actions"><label>Within <select data-dining-radius aria-label="Restaurant search radius" ${busy ? "disabled" : ""}>${[1000,3000,5000,10000].map((radius) => `<option value="${radius}" ${radius === state.radius ? "selected" : ""}>${radius / 1000} km</option>`).join("")}</select></label><button type="button" class="button secondary" data-dining-enable ${busy ? "disabled" : ""}>${busy ? "Checking…" : "Use my location"}</button><label>Or choose an area <select data-dining-area aria-label="Restaurant search area" ${busy ? "disabled" : ""}><option value="">Choose area…</option>${AREAS.map((area) => `<option value="${area.id}" ${state.areaId === area.id ? "selected" : ""}>${esc(area.name)}</option>`).join("")}</select></label>${state.enabled ? '<button type="button" class="button secondary" data-dining-refresh>Refresh restaurants</button><button type="button" class="button secondary" data-dining-clear>Clear location</button>' : ""}</div>
      ${state.enabled && state.source === "OpenStreetMap" ? '<small class="dining-attribution">Restaurant data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors · ODbL</a>. Listings without usable opening hours are excluded.</small>' : ""}<small class="dining-attribution"><a href="/terms.html" target="_blank">Terms</a> · <a href="/privacy.html" target="_blank">Privacy</a></small>
    </section>`;
  }

  function renderMeal(recipe, { compact = false, limit = compact ? 1 : 3 } = {}) {
    if (!recipe) return "";
    const results = fresh() ? placesForMeal(recipe, state.places, limit) : { places: [], matchedMenu: false };
    const showingOpen = results.places.length > 0;
    const heading = showingOpen ? results.similar ? "Open nearby · similar meals" : "Restaurants open nearby" : "Restaurants nearby";
    let content;
    if (results.places.length) {
      const similarMeals = [...new Map(results.places.filter((place) => place.similarMeal).map((place) => [place.similarMeal.key, place.similarMeal])).values()];
      content = `${results.similar ? '<p class="dining-similar-intro">No match for your selected meal. These open restaurants have closely similar menu options.</p>' + similarMeals.map((suggestion) => `<p class="dining-similar-summary"><b>Suggested meal: ${esc(suggestion.name)}</b><small>Why similar: ${esc(suggestion.reason)}</small><small>What changes: ${esc(suggestion.differences)}</small></p>`).join("") : ""}<ul>${results.places.map((place) => {
        const directions = `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: `${place.lat},${place.lng}` })}`;
        const menu = safeExternalUrl(place.menuMatches?.[0]?.sourceUrl || place.menuUrl);
        const source = safeExternalUrl(place.sourceUrl);
        const status = place.openNow === true ? "Open per published hours" : place.openNow === false ? "Closed per published hours" : "Hours unconfirmed";
        return `<li><div><strong>${esc(place.name)}</strong><span>${esc(distanceText(place.distanceKm))} · <span class="${place.openNow === true ? "dining-open" : ""}">${status}</span></span>${place.similarMeal ? `<span class="dining-similar-meal">Alternative: ${esc(place.similarMeal.name)}</span>` : ""}<span class="dining-menu-match">${place.similarMeal ? "On the menu" : "Similar menu item"}: ${esc(place.menuMatches[0].name)}</span>${!compact ? `<span>${esc(place.address)}</span>${place.hoursText ? `<span>Hours: ${esc(place.hoursText)}</span>` : ""}` : ""}</div><div class="dining-place-links"><a href="${esc(directions)}" target="_blank" rel="noopener noreferrer" aria-label="Directions to ${esc(place.name)}">Directions ↗</a>${menu ? `<a href="${esc(menu)}" target="_blank" rel="noopener noreferrer">Menu match ↗</a>` : ""}${place.similarMeal ? `<a href="${esc(mealMapsUrl({ name: place.similarMeal.name }, state.location))}" target="_blank" rel="noopener noreferrer">Find this similar meal ↗</a>` : ""}${source ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer" title="Listed opening hours: ${esc(place.hours || 'Unconfirmed')}">${state.source === "Official restaurant directories" ? "Official hours" : "Hours"} ↗</a>` : ""}</div></li>`;
      }).join("")}</ul><small>Related menu option · Exact dish availability is unconfirmed. Dietary suitability needs confirmation.</small>${state.source === "Google Maps" ? `<div class="dining-data-source"><span class="gmp-attribution" translate="no">Google Maps</span>${results.places.flatMap((place) => place.attributions || []).map((attribution) => { const url = safeExternalUrl(attribution.providerUri); return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(attribution.provider)}</a>` : `<span>${esc(attribution.provider)}</span>`; }).join(" · ")}</div>` : state.source === "Official restaurant directories" ? `<small class="dining-data-source">Official merchant directory · Source pages checked ${esc(state.directoryCheckedAt)}. Temporary closures may differ.</small>` : '<small class="dining-data-source">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></small>'}`;
    } else {
      const message = ["loading", "locating"].includes(state.status) ? `Updating restaurants for ${esc(recipe.name)}…`
        : fresh() ? `No open restaurant with a verified menu match for ${esc(recipe.name)} was found within ${state.radius / 1000} km.`
          : state.error ? "Open-now listings are unavailable."
            : state.enabled ? "Refresh to check current opening hours." : "Enable location to see places open now.";
      content = `<p>${message}</p>${fresh() && results.checkedSimilarMeals?.length ? `<small>No open menu match for these similar meals either: ${results.checkedSimilarMeals.map((suggestion) => esc(suggestion.name)).join(" · ")}. Try a wider radius.</small>` : ""}${!state.enabled ? '<button type="button" class="dining-location-link" data-dining-enable>Use my location</button>' : ""}`;
    }
    return `<section class="meal-dining ${compact ? "compact" : ""}" aria-label="Restaurants for ${esc(recipe.name)}" aria-busy="${["loading", "locating"].includes(state.status)}"><strong class="dining-title">${heading}</strong><small class="dining-meal-context">Selected meal: ${esc(recipe.name)}</small>${content}<a class="dining-map-search" href="${esc(mealMapsUrl(recipe, state.location))}" target="_blank" rel="noopener noreferrer">Search this meal on Maps ↗</a></section>`;
  }

  function wire(root = document) {
    root.querySelectorAll("[data-dining-enable]").forEach((button) => button.addEventListener("click", locateAndSearch));
    root.querySelectorAll("[data-dining-clear]").forEach((button) => button.addEventListener("click", clear));
    root.querySelectorAll("[data-dining-refresh]").forEach((button) => button.addEventListener("click", () => state.areaId ? selectArea(state.areaId) : locateAndSearch()));
    root.querySelectorAll("[data-dining-area]").forEach((select) => select.addEventListener("change", () => selectArea(select.value)));
    root.querySelectorAll("[data-dining-radius]").forEach((select) => select.addEventListener("change", () => {
      const radius = Number(select.value);
      if (![1000,3000,5000,10000].includes(radius)) return;
      state.radius = radius;
      if (state.enabled) state.areaId ? selectArea(state.areaId) : locateAndSearch();
    }));
  }

  return { renderControls, renderMeal, wire, locateAndSearch, selectArea, initialize, clear, refreshForMeal, refreshIfNeeded, handleOffline, snapshot: () => structuredClone(state) };
}
