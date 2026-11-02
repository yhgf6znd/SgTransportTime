# Architecture decision log

## ADR-001: Single Cloudflare Pages project
Accepted: static frontend + Pages Functions `/api/*` in one repo/deployment. No separately deployed Worker unless a future documented decision changes this.

## ADR-002: Secrets server-side only
Accepted: LTA and OneMap credentials are server-side encrypted Pages bindings; browser/WASM obfuscation does not protect secrets.

## ADR-003: Train predictions must be verified
Accepted: GTFS feed listings alone don't prove station-level realtime coverage; show explicit status and fail honestly.
