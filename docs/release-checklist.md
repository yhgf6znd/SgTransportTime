# Release checklist

## Repository and Pages

- [x] One repository contains `src/`, `public/` build output, and root `functions/`.
- [x] `npm run build` creates the Pages output and `_routes.json` invokes Functions only for `/api/*`.
- [x] CI runs secretless tests, syntax checks, and build.
- [ ] Connect the repository to one Cloudflare Pages project with build command `npm run build` and output directory `public`.
- [ ] If Git integration is enabled, clear the custom deploy command; do not use `npx wrangler deploy`.
- [ ] If using Direct Upload instead, use `npm run deploy:pages` / `npx wrangler pages deploy public` and provide the Pages project name when prompted.
- [ ] Confirm preview and production environments use separate secret bindings.

## Secrets and provider verification

- [ ] Register LTA DataMall and set encrypted `LTA_ACCOUNT_KEY` in Pages.
- [ ] Run authorized BusArrival, BusStops, GTFS schedule, GTFS realtime, and TrainServiceAlerts smoke calls; record sanitized timestamps and coverage.
- [ ] Register OneMap Search access and set `ONEMAP_EMAIL`/`ONEMAP_PASSWORD` as encrypted secrets, or set a managed `ONEMAP_TOKEN`.
- [ ] Run authorized OneMap search and confirm quota/terms permit this use.
- [ ] Confirm no secrets occur in `public/`, service-worker caches, logs, or API response bodies.

## Manual acceptance

- [ ] Test 320, 375, 390, 768, 1024, and 1440px layouts, keyboard navigation, reduced motion, offline shell, and denied location permission.
- [ ] Confirm arrivals show provider status/timestamp and never claim live data when stale or unavailable.
- [ ] Verify train station/platform matching from an actual current GTFS sample; do not infer universal MRT/LRT coverage.
- [ ] Run `npx wrangler pages dev public` with local `.dev.vars` and check `/api/health` plus sanitized provider responses. The current restricted environment compiled the Pages worker but could not open its local socket (`uv_interface_addresses`); rerun on a normal developer machine.
- [ ] Deploy only after explicit operator approval; record URL, commit, rollback path, and key rotation contacts.
