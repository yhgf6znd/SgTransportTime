# Cloudflare Pages deployment runbook

1. Register LTA DataMall API access and OneMap account; verify lawful use and quota.
2. Create GitHub repository from this directory after Codex migration. Do not commit `.dev.vars`, `.env`, API keys or generated private captures.
3. Cloudflare dashboard > Workers & Pages > create Pages project, connect repository. Configure static build output directory (e.g. `public/` or `dist/`), build command only if needed. Pages Functions live in top-level `functions/`.
4. Add encrypted Pages environment secrets: `LTA_ACCOUNT_KEY`, and if OneMap Search used, `ONEMAP_EMAIL`, `ONEMAP_PASSWORD`. Use exact chosen binding names consistently.
5. Configure `_routes.json` to invoke functions only under `/api/*` so static assets avoid function charges; verify actual behavior per current Pages routing docs.
6. Local development: `npm install`, `npm run build`, then `npx wrangler pages dev public`; provide local `.dev.vars` only on own machine, gitignored. The repository pins Wrangler 3.114.17 for the current supported Node 18 local toolchain; upgrade the toolchain and dependency together when adopting a newer Wrangler.
7. Verify `/api/health`, then authorized bus arrival and OneMap search, then verified train data. Test deployed browser network console for no exposed key.
8. Add tests/checks to GitHub Actions, validate Cloudflare Pages preview vs production bindings/origins. Restrict production deploy to main.
9. Validate live station coverage, source attribution, quotas, errors, caching, PWA behavior. Document rollback and key rotation.

**Important:** local command and deployment steps are templates; check current Wrangler/Pages docs during implementation. A GitHub Pages workflow or separate `wrangler deploy` Worker is NOT the target. Never claim deployed until URL and results confirmed.
