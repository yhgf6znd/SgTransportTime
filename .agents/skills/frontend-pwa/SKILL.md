---
name: frontend-pwa
description: Accessible vanilla JS frontend / PWA
---

# Accessible vanilla JS frontend / PWA

## When to use
Use when modifying relevant SG Transit functionality. Read `AGENTS.md`, the applicable docs and current source files first.

## Workflow
Use native JS ES modules, semantic HTML and adaptive CSS; keyboard access and clear source/freshness labels. Store favourites locally with versioned schema; pause refresh when tab hidden and avoid overlapping calls. Offline shell is permitted but arrival predictions must be unavailable/stale, never shown as current.

## Definition of done
- Changes remain within the single Cloudflare Pages architecture.
- Relevant tests run, with results and unverified checks reported.
- Documentation and milestone checklist updated.
