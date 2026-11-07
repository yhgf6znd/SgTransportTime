# Security, privacy and abuse protection

- Secret storage: Cloudflare Worker Settings > Variables and Secrets (encrypted secrets). Local `.dev.vars` gitignored. Never use a `VITE_` / browser-prefixed secret.
- Accept only known upstream URLs; never proxy arbitrary user-supplied URL or path. Limit query length, pagination and radius; validate stop codes and service formats.
- Timeouts via AbortController, handle 429/5xx, safe generic user errors; never echo raw upstream errors with auth context. Use HTTPS.
- Same-origin `/api/` means CORS can remain restrictive; **CORS is not authentication**. Add Cloudflare rate limits/WAF as permitted, upstream caching and reasonable budget protection.
- Static caches must not contain authenticated responses or sensitive data; PWA must not display outdated estimates as live.
- Treat location as transient, ask permission only after explicit interaction; no logging raw lat/lon, IP or personal searches by default.
- Sanitize/expose API strings as text nodes (not unsanitized innerHTML). Consider CSP, `Referrer-Policy`, `X-Content-Type-Options`, cache-control.
- Third-party service terms: verify redistribution rights for catalogues and GTFS samples; explain attribution.
- For public launch, test abuse scenarios and confirm free-tier limits and request costs against current docs.
