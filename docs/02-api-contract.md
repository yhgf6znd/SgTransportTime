# Internal API contract

All browser requests are same-origin `GET /api/...` where possible. Implemented success shape:

```json
{"success":true,"data":{},"meta":{"source":"LTA DataMall","updatedAt":"2026-11-02T10:00:00+08:00","fetchedAt":"2026-11-02T10:00:05+08:00","status":"live","cached":false}}
```

Errors: `{ "success": false, "error": { "code": "INVALID_INPUT", "message": "..." } }` with appropriate HTTP status. Do not leak upstream bodies/headers. Data/status and timestamps may differ by endpoint; describe exact schemas after verifying source.

| Endpoint | Parameters | Purpose |
|---|---|---|
| `/api/health` | — | dependency-safe health status, no secrets |
| `/api/bus/stops` | `search`, `limit` | paginated LTA catalogue search |
| `/api/bus/arrivals` | `stop` required 5 digits; `service` optional | normalized LTA BusArrival v3, up to three predictions per service |
| `/api/bus/routes` | `service` | LTA served-stop route data |
| `/api/train/stations` | `search` | grouped LTA GTFS station/platform directory |
| `/api/train/arrivals` | `station` | LTA GTFS Trip Updates where feed coverage matches |
| `/api/train/alerts` | — | LTA train service advisories |
| `/api/places/search` | `q` | server-authenticated OneMap Search |
| `/api/nearby` | `lat`, `lon`, `radius`; optional `type=bus\|train` | OneMap nearby bus stops and MRT/LRT stations by default; an explicit type may request one category; location is not retained |

Nearby default success data is `{ "buses": [], "trains": [] }`. With an explicit type, it is `{ "type": "bus"|"train", "results": [] }`. Bus records contain `kind`, string `code`, `name`, `road`, coordinates, and `distanceMetres`; train records contain `kind`, canonical `id`, `name`, `road`, coordinates, and `distanceMetres`. The server validates and caps the radius and result count. `meta.partial` is true if one of the two default category requests fails while the other succeeds.

Limit query lengths, result count and nearby radius. Bus stop codes are **strings** (leading zeros). Validate latitude [-90,90], longitude [-180,180]. Train station ID must be canonical, not assumed same as public code. Conditional cache policy by data class and source terms; `stale`/`unavailable` must not be represented as `live`.

Suggested bus data view:

```json
{"stopCode":"01012","services":[{"serviceNo":"36","arrivals":[{"estimatedArrival":"2026-11-02T18:12:00+08:00","load":"SEA","wheelchairAccessible":true}],"predictionStatus":"live"}]}
```

Train coverage and live provider behavior remain credential-dependent and are not claimed live-verified by fixtures.
