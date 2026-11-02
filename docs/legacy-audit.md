# Legacy audit and implementation matrix

The legacy prototype was reviewed on 2026-11-02. It had a useful vanilla-JS bus/train UI and provider transforms, but it depended on a separately deployed Worker, a browser-configured API URL, permissive CORS, raw upstream errors, unbounded feed work, unversioned favourites, and `innerHTML` rendering of remote values. It is retained as historical reference only.

| Area | Legacy behavior | Pages implementation | State |
|---|---|---|---|
| Hosting | GitHub Pages plus a separate Worker | One static `public/` artifact plus root `functions/` | Implemented |
| Bus arrival | LTA v3 proxy and three ETA slots | `/api/bus/arrivals`, validated server-side, normalized timestamps/load/accessibility | Implemented; live key pending |
| Bus search | Worker catalogue cache | Paginated `/api/bus/stops` with bounded search | Implemented; live key pending |
| Train directory | Worker downloaded/unzipped schedule per cache | LTA GTFS schedule download, CSV grouping by `parent_station` | Implemented; live key pending |
| Train realtime | Third-party protobuf package in Worker | Small feed-specific protobuf decoder with explicit unavailable state | Implemented; feed coverage pending |
| OneMap | Optional token supplied to Worker | Server-side token issuance/cache or private token binding | Implemented; account pending |
| Nearby | Planned only | Consent-gated browser location, server-side Haversine against provider coordinates | Implemented; provider key pending |
| UI/data safety | Escaped HTML strings | DOM text nodes and source/status labels | Implemented |
| Offline/PWA | No service worker | Static shell cache only; `/api/*` excluded | Implemented |
| Tests/docs | No target test suite | Node unit/integration fixtures, build/lint scripts, docs and release runbook | Implemented |

The current app deliberately does not ship guessed station coordinates, embedded ETA examples, secrets, or synthetic demo predictions. Authenticated smoke tests and train coverage verification remain deployment tasks.
