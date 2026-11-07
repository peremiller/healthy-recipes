# Nearby restaurant setup

The deployed UI shows restaurant slots beside every meal and alternative. Google Maps links work without an API key. In-app live lists require a working provider; the public OpenStreetMap search provider timed out during the November 7, 2026 production check.

1. Open the healthy-recipes Vercel project's environment-variable settings.
2. Configure `GOOGLE_PLACES_API_KEY` for production with a server-only key restricted to Places API (New). Keep the key out of source, browser code and chat.
3. Enable Places API (New) in the owner's Google Cloud project, review its billing and set suitable quotas.
4. Redeploy the project so the function can use that variable.
5. Choose **Use my location** in the planner. Results must be operational, explicitly open now and within the selected radius. No exact menu or dietary suitability is inferred.

The owner performs key and billing configuration. This change creates neither a key nor a paid account. Google requests use Text Search (New), `openNow: true`, distance ranking and a limited field mask. Google restaurant names/addresses are not written into localStorage, the synced meal state, server caches or offline archives. The user refreshes expired Google results explicitly. Required source/provider attribution appears with each list; public usage/privacy notices are `/terms.html` and `/privacy.html`.

Without a configured Google key, the app attempts the public OpenStreetMap data service. Ordinary schedules are evaluated in each venue's timezone. Missing, unsupported, holiday-dependent or solar-dependent hours are excluded. An outage produces an explicit unavailable state, not invented restaurant data. The public provider can be replaced or self-hosted in a future infrastructure task if stronger service guarantees are needed.
