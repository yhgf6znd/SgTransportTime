# Architecture and decisions

```text
User browser / installable PWA
  ↕ HTTPS same-origin
Cloudflare Worker (static public/ assets + API router)
  ├─ HTML/CSS/ES modules, search/favourites/geolocation/local catalogue
  └─ /api/* -> Worker handlers (Workers runtime)
      ├─ validation, error mapping, timeouts, caching, quota safeguards
      ├─ LTA DataMall AccountKey [server-side secret]
      └─ OneMap credentials/token [server-side secret]
```

- Keep `/functions/` at repo root, separate from static publish output. Prefer colocated same-origin calls `/api/...`, avoiding browser CORS friction.
- Frontend can use static generated bus/station catalogues if publishing terms permit, with provenance/version/refresh instructions; no live countdowns embedded in static assets.
- Worker handlers may use Cache API where effective, but study cache behavior and per-region limitations; don't promise globally shared cache by default. GTFS bulk feeds may require preprocessing or a changed plan after profiling.
- For token lifetimes and cross-isolate cache, use a minimal robust strategy: authenticated OneMap calls server-side, optionally cache expiring tokens in a permitted shared store only if justified. Don't assume module-global state is durable.
- Avoid Cloudflare KV/D1 until demonstrated necessary; if used, explain costs, consistency and operations.
- Document major architecture changes as ADR entries in `docs/decisions.md`.

## Suggested structure (Codex to implement)

```text
public/index.html
worker/index.js
public/manifest.webmanifest
public/sw.js
public/assets/*
src/app.js
src/api/client.js
src/components/*
src/services/*
src/styles/*
functions/api/health.js
functions/api/bus/arrivals.js
functions/api/bus/stops.js
functions/api/train/stations.js
functions/api/train/arrivals.js
functions/api/train/alerts.js
functions/api/places/search.js
functions/api/nearby.js
functions/_lib/*
scripts/*
tests/unit/*
tests/integration/*
tests/e2e/*
.github/workflows/*
```

If static content source is in `public/`, ensure imports/assets are deployed correctly without a mandatory framework bundler. Code can be authored directly under `public/` instead of `src/` if no-copy/no-bundler; document the choice.
