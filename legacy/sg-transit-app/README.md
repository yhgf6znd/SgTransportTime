# SG Transit — Singapore Bus & MRT/LRT Arrivals

Static vanilla-JS web frontend (GitHub Pages) + minimal optional Cloudflare Worker providing secure official LTA API access. No database or continuously-running server.

## Features
- Bus arrivals: five-digit stop code, optional bus service filter, next three ETAs, passenger load, accessible bus indicator.
- Find bus stops by code, name or road (from LTA BusStops).
- Search MRT/LRT stations by station name or ID (from LTA GTFS Schedule Train).
- MRT/LRT real-time GTFS trip updates where provided by LTA; displays *unavailable* when no matching prediction appears. No fabricated estimates.
- Favourite bus services and train stations stored locally, auto-refresh every 20 seconds, responsive UI.
- Optional OneMap geocoding backend route `/api/place?q=...` (OneMap token required). This is intended for later place-based proximity search; current UI uses authoritative LTA stop names for stop discovery instead.

## Deploy the Worker
1. Create an LTA DataMall account and obtain an AccountKey: https://datamall.lta.gov.sg/
2. Install Node.js 20+ and run `cd worker && npm install`.
3. Run `npx wrangler login` (requires a Cloudflare account).
4. Run `npx wrangler secret put LTA_ACCOUNT_KEY` and enter the key. **Never put the key in HTML, JavaScript or Git.**
5. Run `npm run deploy`; record the `https://....workers.dev` URL.
6. Update `ALLOWED_ORIGIN` in `wrangler.toml` to your real deployed site origin and redeploy (recommended for browser CORS; this is not authentication or robust abuse prevention).

**Optional OneMap**: OneMap search requires an access token (3-day lifetime). `npx wrangler secret put ONEMAP_TOKEN` enables the optional `/api/place` route, but the current frontend doesn't require it. For unattended OneMap integration, implement secure token renewal on the Worker using stored account credentials and avoid hardcoding credentials in the browser.

## Deploy static site
Publish `index.html`, `app.js`, `styles.css` to a GitHub Pages repository. Set the Worker URL using the ⚙ button in the app, saved in localStorage. For local testing, run `python3 -m http.server 8080` from the project directory and visit http://localhost:8080.

## Important limitations
- This is source code, not a hosted instance. Live ETAs require a valid LTA key and deployed Worker.
- LTA GTFS realtime availability and station stop-ID matching can vary; unavailable predictions are reported plainly. The GTFS schedule is downloaded (ZIP) and parsed for station autocomplete, while real-time trip updates are downloaded and decoded as protocol buffers. Heavy data feeds may hit Worker CPU/memory quotas; consider storing a refreshed station directory as a static JSON file or caching feed downloads in Workers KV/R2 for production.
- The Worker has memory-only caching of bus stops (24h) and GTFS stations (6h); Worker instance eviction triggers new downloads. Stop catalogue requests make multiple paginated LTA requests.
- Bus arrival time displays are refreshed every 20 seconds (subject to network and LTA updates). Train trip update frequencies depend on LTA.
- The app is NOT an offline arrival-time source.
- No synthetic demo arrival figures are shown.

## APIs / license
- https://datamall.lta.gov.sg/ — LTA DataMall (BusArrival v3, BusStops, GTFSScheduleTrain, GTFSRealtimeTrainTripUpdates)
- https://www.onemap.gov.sg/apidocs/ — OneMap optional place search
- Application code: MIT license. Data subject to the providers' respective terms.
