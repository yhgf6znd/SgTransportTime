# Worker cache policy

Static transport data is cached for four hours (`14,400` seconds):

- LTA BusStops pages and the bus-stop search response
- LTA BusServices metadata and the service-directory response
- LTA BusRoutes data and route responses
- LTA GTFS Schedule Train feed and station-directory responses

The Worker uses both the Workers response cache (`[cache] enabled = true` plus `s-maxage=14400`) and the Cache API for authenticated static LTA payloads. Cache keys contain the dataset and request path, never the `AccountKey`.

These responses remain uncached and are fetched on every request:

- LTA BusArrival v3 predictions
- Service-wide bus arrivals and location aggregations (each upstream BusArrival call remains uncached)
- LTA train Trip Updates
- LTA train service alerts
- OneMap place search and nearby transport lookups

The four-hour cache is an edge optimization, not a freshness guarantee across every Cloudflare data center. Cache entries expire and repopulate from the provider; no static cache value is presented as live data.
