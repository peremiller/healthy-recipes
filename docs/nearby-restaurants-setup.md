# Nearby restaurants

The deployed API returns real restaurant names directly without a key or an upstream request. `server/data/official-restaurants.mjs` contains 812 public branch records from the [McDonald’s Philippines locator](https://www.mcdonalds.com.ph/store-locator) (805) and [Denny’s Philippines locations](https://www.dennys.ph/location) (7), retrieved November 7, 2026. It covers selected Philippine chains, not all nearby restaurants. These are nearby dining options; exact planned dishes and dietary suitability are not established.

McDonald’s coordinates and ordinary operating-hour descriptions come from its locator's embedded store records. Service badges such as “24 Hours” never supply missing hours. Of 805 records, 682 have usable general schedules and 123 remain unknown. Many merchant records carry September 2025 update dates; retrieval in November 2026 does not mean their hours were updated then. Denny’s branch addresses, hours and exact place-marker coordinates come from its official directions links. Ambiguous/inconsistent directions are excluded, including the NAIA Terminal 2 link pointing to Terminal 3. Only factual branch fields are bundled, not source-page HTML.

The API evaluates schedules in each venue's timezone at request time. The UI says **Open per published hours**, not confirmed live opening. Exceptional closures, menu availability and dietary suitability need confirmation with the restaurant. If no open option is available, real nearby names still display with **Hours unconfirmed** or **Closed per published hours**. Outside directory coverage, the UI reports no covered restaurants within the chosen radius.

One location request serves all meals. Each planner timeslot has one restaurant section shared by its original meal and alternatives. GPS starts from the user's action; an already granted site permission is reused at startup. Choosing an area uses its explicitly labeled public anchor and never requests GPS. Coordinates, area selection and restaurant responses stay out of localStorage, cloud meal payloads and offline archives. Responses are private/no-store, expire after five minutes and clear offline.

## Optional wider live coverage

The owner can configure a restricted server-only `GOOGLE_PLACES_API_KEY` (or `GOOGLE_MAPS_API_KEY`), enable Places API (New), review billing/quotas and redeploy. This change creates no key or paid account. Never put keys in client code or chat. Google Text Search (New) requests only displayed fields, explicitly open and operational restaurants within the selected radius. Google results remain in active memory, show provider attribution and refresh only on user action. A failure or empty result falls back to the official directory where covered. The failing public Overpass service is no longer the default provider.

## Verification

Run `npm run test:official-dining`, `npm run test:nearby-dining`, `npm run test:google-restaurants`, and `npm run build`. In the planner, choose McKinley or SM Southmall, or use current GPS, and verify names, distances, published hours and one restaurant section per timeslot. Production POST `/api/restaurants` should return 200 with names in supported areas without any key. Public notices are `/privacy.html` and `/terms.html`.
