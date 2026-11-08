# SG Transit — Singapore arrivals PWA

An MIT-licensed, no-framework Singapore bus and MRT/LRT arrivals PWA for a **single Cloudflare Workers project**. The authored frontend is in `src/` and a copy-only `npm run build` publishes `public/`; authenticated providers are accessed only through the Worker entrypoint and server-side handlers.

## Local development

```sh
npm install
npm test
npm run lint
npm run build
npm run dev
```

For Workers Builds, configure `npm run build` and keep the default deploy command `npx wrangler deploy`; the standard Workers deployment reads `wrangler.toml`. For an explicitly authorized manual deployment, use `npm run deploy`. Do not use Pages-specific Wrangler commands.

For live local requests, create a gitignored `.dev.vars` with `LTA_ACCOUNT_KEY` and/or `ONEMAP_EMAIL` plus `ONEMAP_PASSWORD`. Never put credentials in frontend files or commit that file. Without credentials, deterministic tests still run but live provider features correctly return configuration/unavailable states.

## Start here (Cursor)

1. Extract this archive and open **this folder** in Cursor. Keep `.agents/`, `AGENTS.md`, `docs/`, and `prompts/` in the repository.
2. Read `AGENTS.md` and `docs/00-product-requirements.md`.
3. Open Codex in Cursor and paste `prompts/00-bootstrap.md` (the full file contents). Continue with `01` through `15` **in order**, one at a time. Use `prompts/99-stage-review.md` after each stage.
4. The older runnable prototype is preserved under `legacy/sg-transit-app/`; see `docs/legacy-audit.md`. **Do not deploy the old Worker as-is.**
5. Obtain your own LTA DataMall key and OneMap account. Put secrets only in Cloudflare encrypted Worker environment variables (or gitignored local `.dev.vars`), not chat, git, JS or WASM.
6. Every stage must end with test results and a list of anything that still needs real credentials. Do not mark live LTA/OneMap validation complete on mocks alone.

**The repository code is implemented, but not live-verified or deployed.** Provider credentials, Workers project setup, and authorized smoke tests remain release tasks.

## Runtime behavior

- Bus arrival requests use LTA DataMall BusArrival v3 and display provider timestamps, load/accessibility when supplied, and `live` status.
- Train stations are queried by canonical LTA GTFS station code (including comma-separated interchange codes such as `NS9,TE2`). Realtime Trip Updates are feed-specific; absent predictions show `unavailable`, with planned arrivals retained as the fallback.
- OneMap token issuance and search are server-side. Browser geolocation is requested only after the user presses the nearby button and is not stored.
- Favourites/settings are schema-versioned local storage. The service worker caches only the static shell; it never caches `/api/*` arrival responses.

## Directory guide

- `AGENTS.md`: repository-wide rules Codex should follow.
- `.agents/skills/*/SKILL.md`: task-specific agent playbooks; optional to invoke by name in Codex, but usable as reference even if a particular Cursor version doesn't auto-discover skills.
- `docs/`: product, architecture, data contracts, security, testing, deployment, checkpoints and API-source verification.
- `prompts/`: numbered, copy/paste development prompts.
- `src/`: authored static frontend and shared validation modules.
- `worker/`: Cloudflare Worker entrypoint; `functions/`: server-side API handlers and provider adapters.
- `tests/`: secretless unit and handler integration fixtures.
- `legacy/`: prior SG Transit prototype, for migration, not for direct deployment.
- `.env.example`: non-secret variable names only.

## Principle

The site is *static-first*, not 100% static: the Worker executes only for authenticated API routes and serves static assets through the ASSETS binding. No separate Pages project, database or paid third-party webhook is required by default. Verify current Cloudflare and data-provider quotas before launch.
