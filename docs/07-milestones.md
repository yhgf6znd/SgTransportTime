# Milestones & task board

- [x] M0: legacy audit and single Workers project restructure (prompts 00–01)
- [x] M1: stable API contract and tests (02)
- [x] M2: BusArrival v3 + stop/service search (03–04)
- [x] M3: train GTFS station directory, predictions/coverage assessment, alerts (05–07)
- [x] M4: OneMap, nearby and location privacy (08–09)
- [x] M5: polished UI + favourites (10–11)
- [x] M6: PWA offline shell (12)
- [x] M7: hardening, CI, Workers deploy and live smoke (13–15; code/runbook complete, live credentials and deployment pending)
- [x] M8: LTA bus directory and route parity improvements (service metadata, ordered routes, schedules, documented arrival telemetry)
- [x] M9: configurable 15-second polling increments with a 30-second default
Service API review checkpoint (2026-11-08): service-wide live fan-out uses uncached BusArrival calls with bounded concurrency; exact-coordinate location deduplication is covered by fixtures. Live credential behavior remains pending.
- [x] M10: four-hour Cloudflare Workers cache for static transport datasets
- [x] M11: canonical train station-code lookup and single-code interchange expansion
- [x] M12: live bus service-wide arrivals, service locations, and single-service/single-stop API coverage

Implementation checkpoint (2026-11-08): the bus directory, route schedule, arrival telemetry, refresh settings and static cache policy are represented in code, fixtures and docs. Provider calls, browser E2E, `npm run dev`, credential setup, and production deployment remain explicitly unverified until authorized secrets and a Workers project are supplied.

At each milestone log: commit, files changed, commands run, pass/fail, pending credentials, verified provider behavior, release notes. No promise of universal live MRT/LRT arrival coverage.
- [x] M13: unified ranked search GUI for bus stops, bus services, MRT/LRT stations, postal codes, and place-name nearby lookup

Frontend checkpoint (2026-11-08): one accessible search bar now drives transport and nearby-place lookup with debounced hints, keyboard navigation, and exact/prefix/wildcard result grouping.
- [x] M14: inline star saving with saved-first search suggestions and empty-query saved entries

Frontend checkpoint (2026-11-09): the dedicated Saved tab was removed; saved bus stops, services, stations, and nearby places are shown and managed directly in global search.
