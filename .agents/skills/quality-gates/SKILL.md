---
name: quality-gates
description: Testing and review workflow
---

# Testing and review workflow

## When to use
Use when modifying relevant SG Transit functionality. Read `AGENTS.md`, the applicable docs and current source files first.

## Workflow
Before stage completion run lint/unit/integration/E2E appropriate to modified scope; record exact results, identify mocks and missing real credential validation. Review security, API schema, cache staleness, quota behavior, page layout and docs. Never delete failing tests to claim completion.

## Definition of done
- Changes remain within the single Cloudflare Pages architecture.
- Relevant tests run, with results and unverified checks reported.
- Documentation and milestone checklist updated.
