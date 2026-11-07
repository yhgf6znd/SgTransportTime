# Architecture decision log

## ADR-001: Single Cloudflare Pages project (superseded)
Superseded by ADR-004 after the deployment target was explicitly migrated to Cloudflare Workers.

## ADR-002: Secrets server-side only
Accepted: LTA and OneMap credentials are server-side encrypted Worker bindings; browser/WASM obfuscation does not protect secrets.

## ADR-003: Train predictions must be verified
Accepted: GTFS feed listings alone don't prove station-level realtime coverage; show explicit status and fail honestly.

## ADR-004: Single Cloudflare Workers deployment
Accepted: the static frontend and API handlers deploy together as one Worker. `worker/index.js` routes `/api/*`, while the Worker `ASSETS` binding serves `public/`. The repository no longer relies on Pages Functions discovery or a Pages project.
