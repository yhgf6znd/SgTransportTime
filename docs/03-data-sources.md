# Data source verification log

**Verified documentation links on 2026-11-08.** The links and fields below were checked against the current official pages available on that date. No authenticated provider call was made from this repository, so live behavior remains pending.

- LTA DataMall datasets: https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html
- Local LTA API guide reference: [`docs/reference/LTA_DataMall_API_User_Guide.pdf`](reference/LTA_DataMall_API_User_Guide.pdf), version 6.11 (30 Oct 2026).
- LTA portal: https://datamall.lta.gov.sg/
- OneMap API documentation: https://www.onemap.gov.sg/apidocs/
- OneMap authentication: https://www.onemap.gov.sg/apidocs/authentication
- OneMap Search: https://www.onemap.gov.sg/apidocs/search
- Cloudflare Workers static assets: https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare secrets: https://developers.cloudflare.com/workers/configuration/secrets/

## LTA

Dynamic datasets list Bus Arrival, Bus Stops, Bus Services, Bus Routes, GTFS Schedule (Train), GTFS Realtime (Train Trip Updates), and GTFS Realtime (Train Service Alerts). Access to dynamic APIs uses a DataMall AccountKey.

### Bus Arrival v3

- Official request: `GET https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival` with `AccountKey` header, required `BusStopCode` and optional `ServiceNo` query parameters.
- Provider guide version checked: 6.11, 30 Oct 2026. It states a 20-second update frequency and `Services[].NextBus`, `NextBus2`, `NextBus3` objects.
- Documented prediction fields used by the app are `EstimatedArrival`, `Monitored`, `Latitude`, `Longitude`, `VisitNumber`, `Load` (`SEA`, `SDA`, `LSD`), `Feature` (`WAB`), `Type` (`SD`, `DD`, `BD`), `OriginCode`, and `DestinationCode`. Missing or unknown values remain null.
- The UI labels load, vehicle type, wheelchair accessibility, destination and monitored status; estimated coordinates are offered as an external map link. No ETA is calculated by the app.
- `LTA_ACCOUNT_KEY` is server-only. Fixture tests cover validation and transformation; live calls are **PENDING**.

### Bus Stops, Services and Routes

- `BusStops` is paged with `$skip` and supplies stop code, description, road name and coordinates. The Worker keeps a bounded four-hour stop catalogue in Workers Cache and isolate memory to resolve names and coordinates; the client never receives the AccountKey.
- `BusServices?ServiceNo=...` supplies service number, operator, direction, category, origin/destination codes, loop description, and AM/PM peak/off-peak dispatch frequencies. These are scheduled metadata, not live arrival predictions.
- `BusRoutes?ServiceNo=...` supplies ordered stop sequence, stop code, distance, operator/direction, and weekday/Saturday/Sunday first/last bus times. The UI groups by direction and displays the schedule as scheduled data.
- `BusRoutes` is paged and cached for four hours as a stop-to-service index used by `/api/bus/arrivals`; this keeps statically served services visible when the live `BusArrival` response has no ETA slots. Such services are marked `unavailable`, never given invented predictions.
- When a service record is selected, the frontend pairs its route using the documented origin/destination stop codes and uses the numeric direction as a secondary match; this prevents a direction label mismatch from displaying the wrong ordered stop list.
- The official LTA Bus Services page also exposes service-category navigation and a map-oriented experience. This implementation uses the documented DataMall APIs rather than scraping the page. Fare data and a complete public-service category catalogue are not exposed by the verified response fields and are not invented.

### Train feeds

- The official LTA API guide version 6.11 (30 Oct 2026), now retained at `docs/reference/LTA_DataMall_API_User_Guide.pdf`, specifies these endpoints and responses:
  - `GET https://datamall2.mytransport.sg/ltaodataservice/GTFSScheduleTrain` — GTFS static schedule ZIP via a temporary `Link`.
  - `GET https://datamall2.mytransport.sg/ltaodataservice/GTFSRealTimeTrainServiceAlerts` — GTFS realtime service-alert protobuf via a temporary `Link`.
  - `GET https://datamall2.mytransport.sg/ltaodataservice/GTFSRealtimeTrainTripUpdates` — GTFS realtime trip-update protobuf via a temporary `Link`; the guide scopes this feed to train disruptions.
- All three requests use the `AccountKey` header. The current guide’s documented temporary host is `dmproddatasets.s3.ap-southeast1.amazonaws.com`, with links expiring after 15 minutes. The implementation accepts the documented JSON or XML/Atom link envelope, allowlists this current host and the previously documented equivalent host, plus the LTA/Data.gov.sg API hosts; it never follows arbitrary hosts.
- The implementation selectively extracts GTFS files: station-code lookup extracts only `stops.txt`; an arrival request extracts the required files once for all requested station codes and retains only their `stop_times` rows. It groups platforms using `parent_station` and indexes the calendar/trip data to produce planned arrivals. `direction_id` and `trip_headsign` are retained per trip so each terminal direction can be rendered separately; live trip updates are enriched from the matching scheduled trip when possible. A request for either interchange code, such as `NS9` or `TE2`, returns per-line results plus a merged arrival list, without replacing canonical codes with a full station name. These results are explicitly marked `scheduled` and are never labeled live. If a four-hour schedule refresh fails after a valid timetable was loaded, the last known planned timetable remains available and is marked `stale`.
- The separate legacy `TrainServiceAlerts` JSON endpoint remains supported for existing alerts; the GTFS service-alert protobuf feed requires a separate decoder before it can replace that path.
- Feed IDs, platform mapping, current coverage, quotas, and redistribution terms require an authorized sample and are **PENDING**. When the disruption-only Trip Updates feed has no matching station predictions, the app falls back to the current planned schedule and labels it `scheduled`; it does not calculate or imply delay.

### Important train coverage caveat

Availability of a GTFS Realtime feed **does not mean** public live ETAs are available for all MRT/LRT stations or lines. A 2026 Ministry of Transport statement specifically says LRT live arrival data is not planned for public applications/DataMall; the available GTFS listing and actual scope require reconciliation through authorized feed samples. Don't promise universal MRT/LRT coverage. If no real stop-level predictions, show `unavailable` or clearly labeled `scheduled` data.

MOT: https://www.mot.gov.sg/news-resources/newsroom/publishing-real-time-lrt-arrival-data-via-public-apps-and-datamall-during-off-peak-hours-and-weekends--and-technical-limitations-on-data-release/

## OneMap

OneMap Search requires a token in the `Authorization` header. The official authentication page checked 2026-11-02 documents `POST https://www.onemap.gov.sg/api/auth/post/getToken` with registered email/password and a three-day token expiry. Search uses `GET https://www.onemap.gov.sg/api/common/elastic/search` with `searchVal`, `returnGeom=Y`, `getAddrDetails=Y`, and `pageNum`; the implementation limits results to 20 and returns only label/address/coordinates. `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` are server-only; an explicitly provisioned `ONEMAP_TOKEN` is also supported. Account limits/terms and live response validation are **PENDING**.

## Verification checklist before each API integration

- [ ] Official request URL/method/headers recorded
- [ ] Required credential binding and token expiry recorded
- [ ] Upstream response schema and missing values captured
- [ ] Pagination, max sizes, quota and caching terms recorded
- [ ] Live authorized test performed (if credentials available) OR marked pending
- [ ] Fixture contains no credentials or unauthorized copyrighted data
- [ ] Date of last source verification updated
