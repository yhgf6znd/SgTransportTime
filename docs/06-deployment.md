# Cloudflare Workers deployment runbook

1. Register LTA DataMall API access and OneMap account; verify lawful use and quota.
2. Connect this GitHub repository to a **Workers** project through Workers Builds. Do not commit `.dev.vars`, `.env`, API keys or generated private captures.
3. Configure the build command as `npm run build` and leave the production deploy command at the Workers default `npx wrangler deploy`. The Wrangler configuration supplies the Worker entrypoint and static asset directory (`worker/index.js` and `public`). Set the root directory to `/` or leave it blank.
4. Add encrypted Worker environment secrets: `LTA_ACCOUNT_KEY`, and if OneMap Search is used, `ONEMAP_EMAIL`, `ONEMAP_PASSWORD`. Use exact binding names consistently.
5. Keep `main = "worker/index.js"` and `[assets] directory = "./public"` in `wrangler.toml`. The Worker invokes only `/api/*`; static requests use the `ASSETS` binding.
6. Local development: use Node.js 22 or newer, then run `npm install`, `npm run build`, and `npm run dev`. Provide local `.dev.vars` only on your own machine, gitignored.
7. Verify `/api/health`, then authorized bus arrival and OneMap search, then verified train data. Test the deployed browser network console for no exposed key.
8. Configure Workers Builds to deploy the production branch only after review, with preview command `npx wrangler preview` if previews are enabled. Keep preview bindings separate from production bindings. Do not add a manually managed `CLOUDFLARE_API_TOKEN` unless required; Workers Builds can generate its own build token.
9. Validate live station coverage, source attribution, quotas, errors, caching, PWA behavior. Document rollback and key rotation.

### D1 route catalogue setup

Create the D1 database and apply its migration before deploying this version:

```sh
npm run db:create
npm run db:migrate:remote
```

`db:create` is an external Cloudflare operation. It appends the `ROUTES_DB` binding and generated database UUID to `wrangler.toml`; review and commit that non-secret binding configuration. Use `npm run db:migrate:local` for local Wrangler development.

After deployment, the configured five-minute Cron imports at most 15 BusRoutes pages per invocation. Until its first complete generation is activated, route endpoints return `CATALOGUE_WARMING` instead of retrying the full provider catalogue. Keep the existing Worker deployed until the D1 binding and migration are ready.

### Manual Wrangler deployment

For an explicitly authorized manual deployment, run:

```sh
npm run deploy
```

This runs `npm run build && wrangler deploy`, which publishes the Worker and its `public/` assets. Wrangler authentication is required for manual deployment. Do not use `wrangler pages deploy`; that targets Pages rather than this Worker.

**Important:** production deployment and credential setup require operator approval. Never claim deployed until the Worker URL and results are confirmed.
