---
name: gtfs-trains
description: GTFS train schedules, updates and station linking
---

# GTFS train schedules, updates and station linking

## When to use
Use when modifying relevant SG Transit functionality. Read `AGENTS.md`, the applicable docs and current source files first.

## Workflow
Inspect actual authorized GTFS Schedule files and Realtime protobuf structures. Map stop_id, parent_station, platform and trip identifiers reliably. Test sample coverage; distinguish live/scheduled/unavailable. Prefer preprocessed static catalogues over repeatedly unzipping feeds in each request. Inspect CPU/memory and quota. Never claim all MRT/LRT lines have live ETA.

## Definition of done
- Changes remain within the single Cloudflare Pages architecture.
- Relevant tests run, with results and unverified checks reported.
- Documentation and milestone checklist updated.
