# Worker cache policy

These static datasets use Workers Cache until the next 04:00 Singapore time:

- LTA BusStops pages and the bus-stop search response
- LTA BusServices metadata and service-directory responses
- LTA GTFS Schedule Train feed and station-directory responses

LTA BusRoutes is different: a scheduled importer refreshes the complete catalogue into indexed D1 rows in bounded batches. Route requests read the active D1 generation and never scan LTA pages. Refresh is weekly because LTA marks BusRoutes as ad hoc and D1 Free enforces daily row-write limits; incomplete or failed imports do not replace the active generation. Obsolete generations are deleted in 5,000-row chunks starting at least 24 hours after activation so import and cleanup writes occur on different UTC days.

The Worker uses both the Workers response cache (`[cache] enabled = true` plus the dataset TTL) and the Cache API for authenticated static LTA payloads. Cache keys contain the dataset and request path, never the `AccountKey`.

These responses remain uncached and are fetched on every request:

- LTA BusArrival v3 predictions
- Service-wide bus arrivals and location aggregations (each upstream BusArrival call remains uncached)
- LTA train Trip Updates
- LTA train service alerts
- OneMap place search and nearby transport lookups

Workers Cache remains an edge optimization rather than a cross-region freshness guarantee. D1 is the persistent source for scheduled bus routes; no static cache or D1 value is presented as live arrival data.
