# Prompt 00 — Repository bootstrap and legacy audit

Paste all text below into Cursor + Codex as a **single prompt** after prior stages are completed.

---

You are the implementation agent for **SG Transit**, a free MIT-licensed Singapore bus and MRT/LRT arrival web app.

First read `AGENTS.md`, `docs/00-product-requirements.md`, `docs/01-architecture.md`, `docs/02-api-contract.md`, `docs/03-data-sources.md`, `docs/04-security-and-privacy.md`, and the relevant `.agents/skills/*/SKILL.md` files.

**Non-negotiable**: One Cloudflare Pages deployment; static HTML/CSS/vanilla JS frontend and Cloudflare Pages Functions under `/functions/api/` for secure authenticated LTA and OneMap calls. No separate Worker, React, Vue, traditional backend, frontend secrets or invented arrival predictions.

## This stage: Repository bootstrap and legacy audit

Inspect `legacy/sg-transit-app/` and all planning documents. Inventory functionality, data sources, weaknesses, worker-specific assumptions, existing tests and assets. Create an implementation matrix. Do not copy unsafe patterns or claim existing code is production ready. Determine a minimal no-framework static asset layout and explain why. Create a concise `docs/legacy-audit.md`.

Read `README.md`, `AGENTS.md`, every `docs/*.md` and `.agents/skills/*/SKILL.md` relevant to this project first. Use `legacy/` as input and never confuse it with target architecture.

## Required process

1. Inspect relevant source and existing tests before editing. List stage assumptions and any unverified official API details.
2. When integrating an external endpoint, verify its current official documentation and record source, date, method, auth, response schema, pagination, quotas and any provider limitations in `docs/03-data-sources.md`.
3. Implement functionality end to end, with minimal dependencies, accessible user-facing states and server-side secret isolation.
4. Add tests covering normal cases, invalid inputs, missing data, upstream failure, timeouts, and edge cases relevant to this stage.
5. Run actual appropriate lint/test/build/local browser checks. Fix failures. Do not mark external APIs as live-verified if only mocked fixtures were used.
6. Update README, affected docs and `docs/07-milestones.md`. Preserve working unrelated functionality and MIT license.
7. Do not perform production deployment without explicit user authorization.

## Final report format

- Stage objectives met and not met
- Files added/changed
- Test commands and actual outcomes
- Official API specifications verified vs assumptions
- Security/privacy and quota notes
- Blockers / credential-dependent tasks
- Suggested next prompt (`prompts/01-migrate-to-pages.md` if i<15 else 'release review')

If incomplete, say so plainly and leave actionable next steps. Do not silently skip requirements.
