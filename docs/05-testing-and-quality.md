# Testing plan

## Layers
- Unit: timestamp parsing, ETA minute rounding, nulls, service suffixes, stop leading zeros, name matching, haversine, canonical GTFS ids, storage migrations.
- Integration (mock upstream): LTA response transform, OneMap token lifecycle, GTFS protobuf parsing, caching, timeouts, upstream 429/5xx, paginated catalogues, malformed payload.
- Browser E2E: bus search -> arrivals -> service filter -> favourite -> refresh, train station search with unavailable cases, OneMap place lookup, GPS permission denied, accessibility, responsive layout, offline app shell.
- Opt-in authenticated smoke: only run with real secrets and explicit approval; capture sanitized evidence, never raw credentials.

## Quality gates
- One change per prompt; tests and lint pass; no false confidence from mocked data; explicit incomplete checklist.
- Use Node test/Vitest and Playwright where justified; run wrangler Pages local dev to validate routing and env bindings.
- At least 320, 375, 390, 768, 1024 px widths; keyboard and screen reader considerations; offline, reduced motion and high latency.
- CI secretless and deterministic. Dependabot/audit if useful, version-lock actions as appropriate.
- Manual acceptance: actual clock timestamp and feed freshness; permission denial; no API credentials visible in browser devtools or built artifacts.
