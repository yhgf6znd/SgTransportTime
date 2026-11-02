---
name: onemap
description: OneMap authenticated geocoding
---

# OneMap authenticated geocoding

## When to use
Use when modifying relevant SG Transit functionality. Read `AGENTS.md`, the applicable docs and current source files first.

## Workflow
Use server-side OneMap token issuance with secure environment secrets; tokens expire (approx 3 days), re-authenticate as needed. Never expose token to frontend. Verify search params/pagination and rate limits from official API. Use OneMap for place names, LTA stop coordinates for nearest-stops calculation. Consent before geolocation.

## Definition of done
- Changes remain within the single Cloudflare Pages architecture.
- Relevant tests run, with results and unverified checks reported.
- Documentation and milestone checklist updated.
