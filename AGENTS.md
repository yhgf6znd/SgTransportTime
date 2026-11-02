# AGENTS.md — SG Transit project rules

You are contributing to SG Transit, an MIT-licensed Singapore public transport arrivals PWA. Read `docs/00-product-requirements.md`, `docs/01-architecture.md`, `docs/02-api-contract.md`, `docs/03-data-sources.md`, and `docs/04-security-and-privacy.md` before significant changes. Follow task-relevant `.agents/skills/*/SKILL.md`.

## Non-negotiable architecture

- One GitHub repository -> one **Cloudflare Pages** deployment. Frontend = static HTML/CSS/native JS ES modules. Backend = **Pages Functions** using the Workers runtime under `/functions/api/` only. **No separate Worker deployment** and no conventional server.
- Avoid frontend frameworks, production databases and build steps unless justified in an ADR. Use relative static paths. Preserve the MIT license.
- Place source under `src/`, Pages handlers under `functions/api/`, and frontend static output under `public/` or `dist/` (choose one, document it). The `/functions` folder must remain at the project root; do not accidentally publish it as a static asset.
- Add `_routes.json` or platform-generated equivalent to keep non-API assets out of billable Function invocations; verify routing against current Cloudflare documentation.
- Only Pages Functions may call authenticated LTA DataMall and OneMap endpoints. Never ship LTA keys, OneMap passwords, access tokens or refresh material in client JS, WASM, HTML, static JSON, service-worker caches, logs or git.
- Never invent bus or train arrival estimates, line identities, destinations, predictions or schedule coverage. Distinguish LIVE/PREDICTED, SCHEDULED, STALE and UNAVAILABLE.

## Source reliability

- Before implementing each provider integration, check the current official LTA DataMall specification and OneMap API docs. Record verified request paths, auth method, response fields, pagination, feed formats, terms/limits and verification date in `docs/03-data-sources.md`. If unavailable, isolate assumptions and mark **UNVERIFIED**.
- Treat GTFS Realtime train data as feed-specific and coverage-dependent: validate station/platform mapping and prediction availability with real feed samples. A listed dataset is not a coverage guarantee.
- Never claim live testing without actual permitted authenticated calls.

## Engineering practices

- Typed-by-documentation ES modules; small functions; dependency minimization; use robust validation and `AbortController` for fetches; never render unsafe remote strings as HTML.
- Use test fixtures and mocks in CI; separate opt-in live smoke tests that require secrets. Validate timezone and zero-padded stop codes.
- Accessible, responsive, keyboard-friendly UI; empty/error/offline states; respect reduced-motion; data-source timestamps visible. Pause polling when tab hidden.
- Browser favourites in localStorage, schema-versioned; no logins, analytics or precise location retention by default.
- Minimize upstream fetches with safe caching and deduplication; observe quotas and terms. Do not rely on `Cache-Control` alone to guarantee cross-request edge caching.

## Routine for each prompt

1. Inspect current files and existing functionality before editing.
2. State assumptions and plan; avoid speculative endpoints.
3. Implement scoped change and test coverage.
4. Run lint/tests/build/local smoke checks available; record actual commands and results.
5. Update README/docs and relevant milestone checklist.
6. Report modified files, remaining risks and explicit manual actions. Never assert completion if checks did not execute.

## Deployment constraints

- Manual confirmation required for live credential setup and production deploy. Do not print secret values. `.dev.vars` and `.env` files with real values must be gitignored.
- Use official Pages Git integration or Pages deployment action. Distinguish build-time frontend config (public) from secret environment bindings (private).
- Security controls: input limits, outbound host allowlist, HTTP timeouts, correct CORS without treating CORS as auth, quota/abuse protection, safe logs, no publicly available secret-bearing responses.
