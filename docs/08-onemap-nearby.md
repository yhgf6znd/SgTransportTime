# OneMap nearby transport integration

Verified against the official OneMap Nearby Transport API documentation on 2026-11-08:
https://www.onemap.gov.sg/apidocs/nearbytransport

The nearby API uses OneMap’s dedicated transport services rather than searching the LTA catalogue locally:

- Bus stops: `GET https://www.onemap.gov.sg/api/public/nearbysvc/getNearestBusStops`
- MRT/LRT stations: `GET https://www.onemap.gov.sg/api/public/nearbysvc/getNearestMrtStops`
- Query parameters: `latitude`, `longitude`, and optional `radius_in_meters` (default 2,000 m; maximum 5,000 m).
- Header: `Authorization` with a server-side OneMap access token.
- Response: an array of `{ id, name, lat, lon, road }` records.

The application exposes these through `GET /api/nearby` with required `type=bus|train`, plus `lat`, `lon`, and a supported radius of 250, 500, 1,000, or 2,000 m. It returns only the requested category. Distances are calculated from the returned WGS84 coordinates for display and the result is capped at 20 records.

OneMap credentials remain Worker-only. Configure either the encrypted `ONEMAP_TOKEN` secret or `ONEMAP_EMAIL` and `ONEMAP_PASSWORD`; no token is sent to browser code. No authenticated live provider call was performed by the fixture tests, so quota, account access, and live response behavior remain deployment checks.
