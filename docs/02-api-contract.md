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
| `/api/bus/services` | `search` service number; `limit` optional | scheduled service directory metadata from LTA BusServices |
| `/api/bus/routes` | `service` | LTA served-stop route data |
| `/api/bus/service-arrivals` | `service` | live arrivals for every unique stop in every direction of one service |
| `/api/bus/service-locations` | `service` | live bus locations from that service, with duplicate coordinate observations removed |
| `/api/bus/service-arrival` | `service`, `stop` | live arrivals for one service at one five-digit stop |
| `/api/train/stations` | `search` or `code` | ranked canonical LTA GTFS station-code hints by station code, name, or stop ID |
| `/api/train/arrivals` | `station` (one station code) | LTA GTFS Trip Updates and planned arrivals for every line in the selected interchange |
| `/api/train/alerts` | — | LTA train service advisories |
| `/api/places/search` | `q` | server-authenticated OneMap Search |
| `/api/nearby` | `lat`, `lon`, `radius`; optional `type=bus\|train` | OneMap nearby bus stops and MRT/LRT stations by default; an explicit type may request one category; location is not retained |

Nearby default success data is `{ "buses": [], "trains": [] }`. With an explicit type, it is `{ "type": "bus"|"train", "results": [] }`. Bus records contain `kind`, string `code`, `name`, `road`, coordinates, and `distanceMetres`; train records contain `kind`, canonical `id`, `name`, `road`, coordinates, and `distanceMetres`. The server validates and caps the radius and result count. `meta.partial` is true if one of the two default category requests fails while the other succeeds.

Limit query lengths, result count and nearby radius. Bus stop codes are **strings** (leading zeros). Validate latitude [-90,90], longitude [-180,180]. Train station ID must be canonical, not assumed same as public code. Conditional cache policy by data class and source terms; `stale`/`unavailable` must not be represented as `live`.

Bus arrivals include `stopName`/`stopRoad` when the stop catalogue is available. Each prediction preserves documented fields without inventing values: `estimatedArrival`, `estimatedLocation`, `load` (`SEA`, `SDA`, `LSD`), `wheelchairAccessible`, `vehicleType` (`SD`, `DD`, `BD`), `originCode`, `destinationCode`, `monitored`, and `visitNumber`. Destination and origin names are resolved from the server-side stop catalogue when available.
For a bus-stop query, `services` is the union of the static `BusRoutes` stop coverage and the live `BusArrival` response. Each service has `status` `live` when predictions are present or `unavailable` when LTA provides no ETA slots; an empty `arrivals` array is never treated as zero wait time.

Bus service data is scheduled metadata: `serviceNo`, `operator`, `direction`, `category`, origin/destination codes and names, dispatch `frequencies`, and optional `loopDescription`. Bus route data is `{ service, directions[] }`; each direction has ordered `stops[]` with stop code/name/road, coordinates, distance, and weekday/Saturday/Sunday `firstLast` times.
Service-based live responses return `{ "service": "36", "directions": [...] }`; each route stop includes the scheduled route fields plus an `arrivals` array. `/api/bus/service-locations` returns `{ "service": "36", "locations": [...] }`, where each location contains provider coordinates and nullable arrival telemetry; the API does not claim a vehicle identifier because BusArrival does not provide one. These endpoints query uncached BusArrival data for each unique route stop with bounded concurrency, so callers should poll sensibly and expect one upstream request per unique stop.

Suggested bus data view:

```json
{"stopCode":"01012","services":[{"serviceNo":"36","status":"live","arrivals":[{"estimatedArrival":"2026-11-02T18:12:00+08:00","load":"SEA","wheelchairAccessible":true,"vehicleType":"DD","destinationCode":"02020"}]}]}
```

Train station lookups accept a station code, station name, or canonical stop ID. Results are ranked exact, starting-with, then wildcard matches; a query such as `NS9` or `TE2` still returns one verified station directory entry. If the code belongs to an interchange, the arrival response expands it to all GTFS station codes sharing that interchange name, so either `NS9` or `TE2` returns both lines. Train arrival data is `{ "station": object|null, "stations": [{ "station": object, "arrivals": [], "status": "live"|"scheduled"|"stale"|"unavailable" }], "arrivals": [], "status": "live"|"mixed"|"scheduled"|"stale"|"unavailable" }`. The merged `arrivals` list is provided for callers that want one view, while `stations` keeps each line separate. Each arrival includes `estimatedArrival`, `route`, `trip`, `directionId`, `destination`, `delaySeconds`, and `predictionStatus`. `directionId` and `destination` come from the GTFS trip metadata when supplied; the UI groups arrivals by route/direction/destination within each interchange code. The UI labels each direction card with the feed destination/final station rather than exposing the numeric direction identifier. Bus route cards likewise use the final stop name or stop code instead of displaying a numeric direction label. Missing provider destination metadata is shown as `Final station not provided`, never inferred. Train coverage and live provider behavior remain credential-dependent and are not claimed live-verified by fixtures.
