const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const FRESH_MS = 5 * 60 * 1000;

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
  const profile = diningProfile(recipe);
  const open = places.filter((place) => place.openNow === true && Number.isFinite(place.distanceKm));
  const matching = open.filter((place) => profile.cuisines.some((cuisine) =>
    `${place.cuisine};${place.amenity}`.toLowerCase().split(/[;, ]+/).includes(cuisine)));
  return { places: [...(matching.length ? matching : open)].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit), matchedCuisine: matching.length > 0 };
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
  isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false, clock = Date.now } = {}) {
  let state = { status: "idle", enabled: false, location: null, places: [], checkedAt: null, validUntil: null, radius: 5000, unknownCount: 0, error: "" };
  let requestId = 0;
  let aborter;
  const fresh = () => state.status === "ready" && Date.parse(state.validUntil) > clock();
  const update = (values) => { state = { ...state, ...values }; onChange(); };

  async function locateAndSearch() {
    if (state.status === "locating" || state.status === "loading") return;
    const id = ++requestId;
    state.enabled = true;
    if (!isOnline()) { update({ status: "offline", places: [], error: "Connect to the internet to check which restaurants are open now." }); return; }
    const geo = geolocation();
    if (!geo) { update({ status: "error", places: [], error: "This browser cannot get your location. Use the meal’s Maps search instead." }); return; }
    update({ status: "locating", places: [], error: "" });
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
    update({ status: "loading", location, places: [] });
    aborter = new AbortController();
    const timeout = setTimeout(() => aborter?.abort(), 35000);
    try {
      const response = await fetchImpl("/api/restaurants", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ lat: location.lat, lng: location.lng, radius: state.radius }), signal: aborter.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Restaurant search is unavailable.");
      if (!Array.isArray(data.places) || !Number.isFinite(Date.parse(data.validUntil)) || Date.parse(data.validUntil) <= clock()) throw new Error("The restaurant check is out of date. Please refresh it.");
      if (id !== requestId) return;
      update({ status: "ready", places: data.places.filter((place) => place.openNow === true), checkedAt: data.checkedAt, validUntil: data.validUntil, unknownCount: Number(data.unknownCount) || 0, error: "" });
    } catch (error) {
      if (id !== requestId) return;
      update({ status: "error", places: [], error: error.name === "AbortError" ? "The restaurant search timed out. Try again or search Maps." : error.message });
    } finally { clearTimeout(timeout); }
  }

  function clear() {
    requestId += 1; aborter?.abort();
    update({ status: "idle", enabled: false, location: null, places: [], checkedAt: null, validUntil: null, error: "" });
  }

  function refreshIfNeeded() {
    if (state.enabled && !["locating", "loading", "error"].includes(state.status) && !fresh()) return locateAndSearch();
    return Promise.resolve();
  }

  function handleOffline() {
    if (!state.enabled) return;
    requestId += 1; aborter?.abort();
    update({ status: "offline", places: [], error: "Connect to the internet to check which restaurants are open now." });
  }

  function renderControls() {
    const busy = ["locating", "loading"].includes(state.status);
    const status = busy ? (state.status === "locating" ? "Getting your current location…" : "Checking nearby restaurant hours…")
      : fresh() ? `${state.places.length} restaurants listed open within ${state.radius / 1000} km · Checked ${new Date(state.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : state.error || "Use your current location to see open restaurants beside every meal.";
    return `<section class="dining-controls surface" aria-label="Nearby restaurant settings">
      <div><strong>Open restaurants near you</strong><p role="status">${esc(status)}</p><small>Open now follows published hours, not the meal’s scheduled time. Distances are straight-line estimates. Menus and dietary options need confirmation.</small>
      ${!state.enabled ? '<small>Only your location is used for the search. Approximate coordinates are shared with OpenStreetMap’s search service and aren’t saved with your meal plan.</small>' : ""}</div>
      <div class="dining-control-actions"><label>Within <select data-dining-radius aria-label="Restaurant search radius" ${busy ? "disabled" : ""}>${[1000,3000,5000,10000].map((radius) => `<option value="${radius}" ${radius === state.radius ? "selected" : ""}>${radius / 1000} km</option>`).join("")}</select></label><button type="button" class="button secondary" data-dining-enable ${busy ? "disabled" : ""}>${busy ? "Checking…" : state.enabled ? "Refresh location" : "Use my location"}</button>${state.enabled ? '<button type="button" class="button secondary" data-dining-clear>Clear location</button>' : ""}</div>
      ${state.enabled ? '<small class="dining-attribution">Restaurant data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors · ODbL</a>. Listings without usable opening hours are excluded.</small>' : ""}
    </section>`;
  }

  function renderMeal(recipe, { compact = false, limit = compact ? 1 : 3 } = {}) {
    if (!recipe) return "";
    const results = fresh() ? placesForMeal(recipe, state.places, limit) : { places: [], matchedCuisine: false };
    const heading = fresh() ? "Open nearby" : "Restaurants nearby";
    let content;
    if (results.places.length) {
      content = `<ul>${results.places.map((place) => {
        const directions = `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: `${place.lat},${place.lng}` })}`;
        const menu = safeExternalUrl(place.menuUrl);
        const source = safeExternalUrl(place.sourceUrl);
        return `<li><div><strong>${esc(place.name)}</strong><span>${esc(distanceText(place.distanceKm))} · <span class="dining-open">Listed open now</span></span></div><div class="dining-place-links"><a href="${esc(directions)}" target="_blank" rel="noopener noreferrer" aria-label="Directions to ${esc(place.name)}">Directions ↗</a>${menu ? `<a href="${esc(menu)}" target="_blank" rel="noopener noreferrer">Menu ↗</a>` : ""}${source && !compact ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer" title="Listed opening hours: ${esc(place.hours)}">Hours ↗</a>` : ""}</div></li>`;
      }).join("")}</ul>${compact ? "" : `<small>${results.matchedCuisine ? "Cuisine match" : "Nearby options"} · Exact dish availability is unconfirmed.</small>`}`;
    } else {
      const message = ["loading", "locating"].includes(state.status) ? "Checking restaurants…"
        : fresh() ? "No nearby restaurants with usable open-now hours were found."
          : state.error ? "Open-now listings are unavailable."
            : state.enabled ? "Refresh to check current opening hours." : "Enable location to see places open now.";
      content = `<p>${message}</p>${!state.enabled ? '<button type="button" class="dining-location-link" data-dining-enable>Use my location</button>' : ""}`;
    }
    return `<section class="meal-dining ${compact ? "compact" : ""}" aria-label="Restaurants for ${esc(recipe.name)}"><strong class="dining-title">${heading}</strong>${content}<a class="dining-map-search" href="${esc(mealMapsUrl(recipe, state.location))}" target="_blank" rel="noopener noreferrer">Search this meal on Maps ↗</a></section>`;
  }

  function wire(root = document) {
    root.querySelectorAll("[data-dining-enable]").forEach((button) => button.addEventListener("click", locateAndSearch));
    root.querySelectorAll("[data-dining-clear]").forEach((button) => button.addEventListener("click", clear));
    root.querySelectorAll("[data-dining-radius]").forEach((select) => select.addEventListener("change", () => {
      const radius = Number(select.value);
      if (![1000,3000,5000,10000].includes(radius)) return;
      state.radius = radius;
      if (state.enabled) locateAndSearch();
    }));
  }

  return { renderControls, renderMeal, wire, locateAndSearch, clear, refreshIfNeeded, handleOffline, snapshot: () => structuredClone(state) };
}
