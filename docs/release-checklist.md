# Release checklist

## Repository and Workers

- [x] One repository contains `src/`, `public/` build output, root `functions/` handlers, and `worker/index.js`.
- [x] `npm run build` creates the Worker static asset output and `wrangler.toml` routes only `/api/*` through the Worker.
- [x] CI runs secretless tests, syntax checks, and build.
- [ ] Connect the repository to one Cloudflare Workers project through Workers Builds.
- [ ] Configure build command `npm run build`; use the standard Wrangler deployment from `wrangler.toml`.
- [ ] Confirm preview and production environments use separate Worker secret bindings.
- [ ] Run `npm run db:create`, review the generated `ROUTES_DB` binding, and apply `npm run db:migrate:remote` before deployment.
- [ ] Confirm the five-minute Cron activates the first complete BusRoutes generation without crossing 50 subrequests.
- [ ] Smoke-test D1-backed routes for services 56 and 36 after the initial catalogue warm-up.

## Secrets and provider verification

- [ ] Register LTA DataMall and set encrypted Worker secret `LTA_ACCOUNT_KEY`.
- [ ] Run authorized BusArrival, BusStops, GTFS schedule, GTFS realtime, and TrainServiceAlerts smoke calls; record sanitized timestamps and coverage.
- [ ] Register OneMap Search access and set `ONEMAP_EMAIL`/`ONEMAP_PASSWORD` as encrypted Worker secrets, or set a managed `ONEMAP_TOKEN`.
- [ ] Run authorized OneMap search and confirm quota/terms permit this use.
- [ ] Confirm no secrets occur in `public/`, service-worker caches, logs, or API response bodies.

## Manual acceptance

- [ ] Test 320, 375, 390, 768, 1024, and 1440px layouts, keyboard navigation, reduced motion, offline shell, and denied location permission.
- [ ] Confirm arrivals show provider status/timestamp and never claim live data when stale or unavailable.
- [ ] Verify train station/platform matching from an actual current GTFS sample; do not infer universal MRT/LRT coverage.
- [ ] Run `npm run dev` with Node.js 22+ and local `.dev.vars`, then check `/api/health` plus sanitized provider responses. The current restricted environment may not open the local Worker socket; rerun on a normal developer machine.
- [ ] Deploy only after explicit operator approval; record Worker URL, commit, rollback path, and key rotation contacts.
