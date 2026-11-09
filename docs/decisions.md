# Architecture decision log

## ADR-001: Single Cloudflare Pages project (superseded)
Superseded by ADR-004 after the deployment target was explicitly migrated to Cloudflare Workers.

## ADR-002: Secrets server-side only
Accepted: LTA and OneMap credentials are server-side encrypted Worker bindings; browser/WASM obfuscation does not protect secrets.

## ADR-003: Train predictions must be verified
Accepted: GTFS feed listings alone don't prove station-level realtime coverage; show explicit status and fail honestly.

## ADR-004: Single Cloudflare Workers deployment
Accepted: the static frontend and API handlers deploy together as one Worker. `worker/index.js` routes `/api/*`, while the Worker `ASSETS` binding serves `public/`. The repository no longer relies on Pages Functions discovery or a Pages project.

## ADR-005: Persist the BusRoutes catalogue in D1
Accepted: the complete LTA BusRoutes dataset is refreshed by the same Worker's Cron handler in bounded 15-page batches and stored as indexed D1 rows. Public route requests query D1 by service or stop and make no BusRoutes provider calls.

This is necessary because LTA documents a maximum of 500 records per BusRoutes request, while a cold full-catalogue scan plus Cache API operations exceeded Cloudflare Workers Free's 50-subrequest limit. D1 keeps the single-Worker deployment and atomically retains the previous complete generation if refresh fails. The trade-offs are a required D1 binding/migration, Free-plan row-read/write limits, a short initial warm-up, and scheduled operational monitoring.
