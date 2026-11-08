# Data source verification log

**Verified documentation links on 2026-11-08.** The links and fields below were checked against the current official pages available on that date. No authenticated provider call was made from this repository, so live behavior remains pending.

- LTA DataMall datasets: https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html
- Local LTA API guide reference: [`docs/reference/LTA_DataMall_API_User_Guide.pdf`](reference/LTA_DataMall_API_User_Guide.pdf), version 6.11 (30 Oct 2026).
- LTA portal: https://datamall.lta.gov.sg/
- OneMap API documentation: https://www.onemap.gov.sg/apidocs/
- OneMap authentication: https://www.onemap.gov.sg/apidocs/authentication
- OneMap Search: https://www.onemap.gov.sg/apidocs/search
- Cloudflare Workers static assets: https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare Workers static assets: https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare secrets: https://developers.cloudflare.com/workers/configuration/secrets/

## LTA

Dynamic datasets list Bus Arrival, Bus Stops, Bus Services, Bus Routes, GTFS Schedule (Train), GTFS Realtime (Train Trip Updates), and GTFS Realtime (Train Service Alerts). Access to dynamic APIs uses a DataMall AccountKey.

### Bus Arrival v3

- Official request: `GET https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival` with `AccountKey` header, required `BusStopCode` and optional `ServiceNo` query parameters.
- Provider guide version checked: 6.2, 21 Nov 2024. It states a 20-second update frequency and `Services[].NextBus`, `NextBus2`, `NextBus3` objects. The implementation preserves provider timestamps and recognizes load/accessibility fields without inventing missing values.
- Static catalogue endpoints are `BusStops` (paged with `$skip`), `BusRoutes`, and `BusServices`; pagination is bounded and cached only in isolate memory.
- `LTA_ACCOUNT_KEY` is server-only. Fixture tests cover validation and transformation; live calls are **PENDING**.

### Train feeds

- The official LTA API guide version 6.11 (30 Oct 2026), now retained at `docs/reference/LTA_DataMall_API_User_Guide.pdf`, specifies these endpoints and responses:
  - `GET https://datamall2.mytransport.sg/ltaodataservice/GTFSScheduleTrain` — GTFS static schedule ZIP via a temporary `Link`.
  - `GET https://datamall2.mytransport.sg/ltaodataservice/GTFSRealTimeTrainServiceAlerts` — GTFS realtime service-alert protobuf via a temporary `Link`.
  - `GET https://datamall2.mytransport.sg/ltaodataservice/GTFSRealtimeTrainTripUpdates` — GTFS realtime trip-update protobuf via a temporary `Link`; the guide scopes this feed to train disruptions.
- All three requests use the `AccountKey` header. The guide’s documented temporary host is `dmprod-datasets.s3.ap-southeast-1.amazonaws.com`, with links expiring after 15 minutes. The implementation applies an exact allowlist for that host and the LTA/Data.gov.sg API hosts; it never follows arbitrary hosts.
- The implementation parses `stops.txt` and groups platform records using `parent_station`; it also indexes `trips.txt`, `stop_times.txt`, `routes.txt`, `calendar.txt`, and `calendar_dates.txt` to produce the next planned arrivals. These results are explicitly marked `scheduled` and are never labeled live.
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
