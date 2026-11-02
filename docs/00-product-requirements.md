# Product requirements and scope

## Goal
A fast, free/open-source, mobile-first Singapore bus and MRT/LRT arrival web app, installable as a PWA, hosted as static files on Cloudflare Pages with only minimal Pages Functions for secured live API access.

## Must-have (MVP)
- Bus search by five-digit stop code, stop name and road name; filter by service number, including letter suffixes (e.g. 36A). Support combined service + stop searches.
- LTA Bus Arrival v3: up to 3 arrivals per bus service, load and accessibility when provided; correct remaining time; manual refresh; sensible polling; freshness information.
- Local favourites for stop+service, no account.
- Useful errors when API unavailable; accessible mobile responsive UI.
- Single Cloudflare Pages deployment and secret-safe authenticated API proxy.

## Phase 2
- Public MRT/LRT station directory searchable by name and (verified) codes; GTFS schedule/stops matching; GTFS Realtime Trip Updates, where confirmed available; honest no-data statuses; service alerts.
- OneMap authenticated place/geocoding search, nearest bus stops and stations using geocoordinates; browser geolocation only after user consent.
- Dark mode, offline shell, versioned storage, optional JSON export/import.

## Non-goals (initial)
- Travel payment/ticketing, user accounts, route optimization, guaranteed train ETAs for every line, live bus position maps, push notifications, proprietary library licenses.

## Acceptance requirements
- No guessed arrival time; each ETA tied to provider timestamp and source/status.
- No secret in page source, frontend assets, source control, API response, error pages, service worker, logs.
- Lighthouse/accessibility and cross-device smoke testing; CI fixtures pass; production key live smoke tests documented separately.
- On loss of network, app shell and stored favourites work; old ETAs are **never** labeled live.
- Quotas and licensing are reviewed before production.
