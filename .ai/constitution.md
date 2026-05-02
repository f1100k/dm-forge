# Constitution

The non-negotiable principles of dm-forge. Every Spec, Tech Design, ADR, and line of code must respect what is written here. To contradict the Constitution, propose an ADR that updates it — never proceed silently against a principle.

## Project context

SaaS platform for tabletop RPG dungeon masters to plan campaigns with AI assistance via BYOK (Bring Your Own Key). Stage: greenfield. Team: 2-3 devs.

The PRD lives in Notion (`Docs`, `Category = Product`). Specs and Tech Designs also live in Notion. Constitution and engineering rules live in this repository.

## Principles

### 1. Spec before code
Every non-trivial change starts as **PRD → Spec → Tech Design → Tasks → Implementation**. Trivial fix (typo, dependency bump, config tweak) doesn't need this. Anything else does. If unsure, treat it as non-trivial.

### 2. Constitution above all
Any Spec, Tech Design, ADR, or code that contradicts the Constitution is wrong. The path to override is: propose ADR → update Constitution → then change downstream artifacts. Never silently.

### 3. Notion = artifacts; repo = process and rules
PRD, Specs, Tech Designs, Kanban cards, and Research live in Notion — that's where the team comments, reviews, and tracks. The SDD process itself (how to write a Spec, a Tech Design, break tasks, implement) lives in the skills under `.ai/skills/`. Constitution, engineering rules, ADRs, and code live in the repo. Each side links to the other; neither duplicates.

### 4. Client is the source of truth during the session
Monolithic bootstrap, rich local store, optimistic mutations. The server reflects state — it doesn't drive UX state.

### 5. Dumb server, smart client
Backend is database + authorization + LLM orchestration. UX state, sequencing, and derived data live on the client. New backend complexity needs explicit justification.

### 6. Determinism over sophistication
Choose the simple, predictable solution over the sophisticated probabilistic one when both work. String matching beats vector similarity here.

### 7. Lazy infrastructure
No Redis, queue, vector DB, or WebSocket without an ADR and a concrete problem the existing stack cannot solve. Every infra dependency is a permanent tax.

### 8. Every complexity has permanent cost; every simplicity preserves optionality
Code is added in minutes and lived with for years. When in doubt, choose the path that keeps doors open and removes the fewest.

## How to use this document

- **Always read together with `engineering.md`.** This file is the principles; `engineering.md` is the stack, structure, and standards the principles imply.
- **Detail only when relevant.** Files in `docs/` carry deeper rules — load them when the task touches their topic. The lookup table is in `engineering.md`.
- **When this document conflicts with anything else** — Notion docs, ADRs, code comments, PR feedback — the Constitution wins. Path to override: ADR + Constitution update, in that order.

## Source of truth hierarchy

When two sources disagree, resolve in this order:

1. **Constitution** (this file)
2. **Engineering rules** (`engineering.md` and `docs/*.md`)
3. **ADRs** (`docs/adr/*.md`) — newest decision wins among ADRs, but never overrides the Constitution
4. **Tech Design** of the feature being implemented (Notion)
5. **Spec** of the feature being implemented (Notion)
6. **Existing code**

Higher items constrain lower ones. To break a higher one, propose an ADR.
