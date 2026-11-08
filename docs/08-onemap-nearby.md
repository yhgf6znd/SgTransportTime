# OneMap nearby transport integration

Verified against the official OneMap Nearby Transport API documentation on 2026-11-08:
https://www.onemap.gov.sg/apidocs/nearbytransport

The nearby API uses OneMap’s dedicated transport services rather than searching the LTA catalogue locally:

- Bus stops: `GET https://www.onemap.gov.sg/api/public/nearbysvc/getNearestBusStops`
- MRT/LRT stations: `GET https://www.onemap.gov.sg/api/public/nearbysvc/getNearestMrtStops`
- Query parameters: `latitude`, `longitude`, and optional `radius_in_meters` (default 2,000 m; maximum 5,000 m).
- Header: `Authorization` with a server-side OneMap access token.
- Response: an array of `{ id, name, lat, lon, road }` records.

The application calls both services by default through `GET /api/nearby?lat=...&lon=...&radius=...` and returns separate `buses` and `trains` arrays. An optional `type=bus` or `type=train` can request one category for API callers. Distances are calculated from the returned WGS84 coordinates for display and each category is capped at 20 records.

If one category fails, the other successful category is still returned with `meta.partial: true`. If both fail, the request returns the upstream/configuration error. OneMap credentials remain Worker-only: configure either the encrypted `ONEMAP_TOKEN` secret or `ONEMAP_EMAIL` and `ONEMAP_PASSWORD`.
