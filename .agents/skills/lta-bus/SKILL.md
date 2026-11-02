---
name: lta-bus
description: LTA DataMall bus integration
---

# LTA DataMall bus integration

## When to use
Use when modifying relevant SG Transit functionality. Read `AGENTS.md`, the applicable docs and current source files first.

## Workflow
Recheck official v3 BusArrival, BusStops, BusRoutes and BusServices specs. Use five-character strings for bus stop codes, allow service suffixes, paginate static catalogues and preserve ETA timestamp offsets. Normalize NextBus/NextBus2/NextBus3, load, wheelchair and missing values. Mock CI; live validation requires credentials. Never fabricate results.

## Definition of done
- Changes remain within the single Cloudflare Pages architecture.
- Relevant tests run, with results and unverified checks reported.
- Documentation and milestone checklist updated.
