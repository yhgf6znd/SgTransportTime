---
name: cloudflare-pages
description: Cloudflare Pages deployment and Functions routing
---

# Cloudflare Pages deployment and Functions routing

## When to use
Use when modifying relevant SG Transit functionality. Read `AGENTS.md`, the applicable docs and current source files first.

## Workflow
Validate that `/functions` is repository-root and static assets are published separately. Keep handlers under `/api/*`. Verify `_routes.json` excludes static routes, secret bindings are set as Pages secrets, and preview/production env are distinct. No separate Worker. Perform local `wrangler pages dev` smoke checks and require explicit deployment approval.

## Definition of done
- Changes remain within the single Cloudflare Pages architecture.
- Relevant tests run, with results and unverified checks reported.
- Documentation and milestone checklist updated.
