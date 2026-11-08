# Bus experience improvements

Verified against the official LTA Bus Services page and DataMall documentation on 2026-11-08.

Implemented:

- Search by five-digit stop code, stop name, road, or bus service number.
- Scheduled service directory showing operator, category, direction, endpoints, loop description, and dispatch frequency.
- Ordered route view grouped by direction, with stop codes, names, roads, distances, coordinates and first/last-bus schedules.
- Arrival cards showing the documented LTA load, vehicle type, wheelchair-accessibility, destination, monitored status and estimated location when supplied.
- Safe text rendering and external map links without exposing provider credentials.
- One-day isolate-memory caching for the shared stop catalogue to avoid repeating the same static lookup for every service/route/arrival request.

Deliberate limits:

- The app does not scrape the LTA website or reproduce fare calculations. Fare data is not present in the verified BusArrival/BusServices/BusRoutes response fields.
- Scheduled service and route metadata are labeled `scheduled`; only BusArrival predictions are labeled `live`.
- A missing LTA field remains unknown rather than being inferred. Live API behavior still requires an authorized deployment smoke test.
