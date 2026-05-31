# Skill: Tech Design writer

This Skill is **full-content**: it carries the entire process for creating a Tech Design. It does not delegate to a human Playbook in Notion. To change the process, edit this file (the Cursor adapter picks it up automatically).

## When to use

Use when the user asks to:
- Create a Tech Design for a feature
- Design the technical architecture of a feature
- Document the approach before implementing
- "How are we going to implement X", "tech design for Y"

**Create a Tech Design when:**
- The Spec is approved (`Status = Done`) and the feature needs to be implemented
- The technical solution is not obvious or has more than one possible approach
- The feature involves more than one dev or more than one system
- Architectural decisions need to be discussed before coding
- The feature impacts critical areas (auth, sensitive data, performance)

**Heuristic:** if more than one person needs to understand the technical approach before starting, a Tech Design is worth it.

**Don't use when:**
- The related Spec is not `Done`
- It's a trivial fix, simple bug, isolated change to a single function, or small feature (1-2 days) one dev can solve alone
- The user asks to implement code (use `spec-implementer`)

## What a Tech Design is

> While the **Spec** describes *what* and *why*, the **Tech Design** describes *how*.

A Tech Design answers:
- What's the architecture?
- Which components will change?
- How does data flow?
- Which technical decisions do we need to make?

## Prerequisites

Before starting:

1. **Spec approved** — search Notion `Docs` for `Doc name` starting with `Spec - [Feature name]`, `Category` containing `Spec`, `Status = Done`. **If not `Done`, stop immediately** and instruct the user to finalize the Spec first.
2. **Design gates closed** — open the Spec body and check, in order:
   - The `**UI:**` header is set (not blank). If blank, **stop** and send the user back to `spec-writer` step 2.5 to run the UI detection.
   - If `UI: yes`, section 3.5 must carry a real `design_url` — neither empty nor still equal to the `[NEEDS DESIGN: link pending]` placeholder. If still pending, **stop** with: `Spec has UI: yes but design_url is empty. Run /design-handoff to attach the canonical link (claude.ai/design) or edit section 3.5 before retrying.`
   - The Spec must have **zero** open `[NEEDS DESIGN: …]` markers (in section 3.5 or elsewhere). If any remain, **stop** and quote each marker verbatim, then tell the user to close them via `/design-handoff` or by editing the Spec before retrying.
   - If `UI: no`, skip this check entirely and proceed.
3. **Tech Design not duplicated** — search for `Doc name` starting with `Tech Design - [Feature name]`, `Category` containing `Tech Design`. If it exists, ask whether to update the existing one.
4. **Existing ADRs consulted** — list files under `docs/adr/`. Past decisions constrain what can be proposed.

## Notion contract

See `.ai/README.md`, section "Notion configuration (contract)". In particular: `Docs` database, `Category` is `multi_select`, value `Tech Design`.

## Execution flow

### 1. Read principles and technical context

Read, in order:

1. `.ai/constitution.md` — non-negotiable principles.
2. `.ai/engineering.md` — stack, allowed dependencies, standards. **Pay attention to the "When to dive deeper" table** at the end.
3. **Specific docs in `docs/*.md`** that match the feature scope, per the table in `engineering.md`.
4. **Applicable ADRs** in `docs/adr/`.

### 2. Read the Spec

Via Notion MCP, read the approved Spec in full. In particular:
- **User stories** with their priorities and Independent Tests — they shape the Execution Plan
- **Acceptance scenarios** (Given/When/Then) — define "done" per story
- **Success Criteria** — drivers of architecture (perf, scale)
- **Functional + Non-Functional Requirements**
- **Out of scope** — bounds the Tech Design
- Any remaining `[NEEDS CLARIFICATION]` markers — must be resolved before proceeding (escalate to user)
- Any remaining `[NEEDS DESIGN]` markers — the Prerequisites design gate should already have stopped you here; if you reach this point with markers still open, the gate failed — abort and re-check Prerequisites step 2

### 3. Gather additional technical context

As needed:
- Relevant code that will be touched (read snippets in the repo)
- Current stack via `engineering.md`
- Infrastructure constraints (recall Constitution principle 7: lazy infrastructure)

### 4. Clarification protocol

When the design has gaps, **don't ask blindly**. Apply this rule:

**Do not ask if there's a reasonable default.** Make an informed choice and document it in section "Alternatives considered" (rejected alternatives) or "Trade-offs and risks" (chosen path implications). Use existing patterns in the codebase as defaults.

**Ask only when** the choice meaningfully impacts:
- **Architecture** (changes the dependency graph or introduces new infra — highest priority)
- **Security/privacy** (BYOK, encryption, retention)
- **Performance** (hot path, latency budget)
- **Migration risk** (breaking changes, data backfill)

**Limit: max 3 questions per round.** Format as a table:

```
Question 1: [Crisp question, ≤15 words]
| Option | Approach | Implication |
|---|---|---|
| A | ... | ... |
| B | ... | ... |
| C | ... | ... |
| Custom | (the user writes it) | (the user describes) |
```

Number the questions (Q1, Q2, Q3). After answers, update the design and continue.

If a question can't be answered now, mark the Tech Design with `[NEEDS CLARIFICATION: short question]` (max 3 markers total) and proceed. Surface these in the handoff so they can be resolved before implementation.

### 5. Constitution check — pre-design gate

**Before proposing the architecture**, check the rough approach against the Constitution and `engineering.md`:

- Does the approach assume new infra (Redis, queue, vectors, WS)? → Constitution principle 7 — needs ADR justification
- Does it bypass `packages/ai`? → forbidden by `modular-principles.md`
- Does it touch the dependency graph? → check `engineering.md`
- Does it duplicate a coding pattern instead of reusing? → check `coding-patterns.md`
- Does it propose hard delete on campaign entities? → forbidden — see `coding-patterns.md`

**If any check fails, you have three options** (in this order of preference):

1. **Adjust the approach** to comply (prefer this).
2. **Justify the violation** in section "12. Complexity Tracking" of the template — only if the simpler alternative was actually evaluated and is worse for this case.
3. **Propose an ADR** that changes the Constitution/engineering rule (only if the rule itself is the problem, not this feature).

Don't proceed with a hidden violation.

### 6. Create the page in Notion

Via Notion MCP, create a page in `Docs` with:
- **`Doc name`:** `Tech Design - [Feature name]` (same name as the Spec, swapped prefix)
- **`Category`:** contains `Tech Design`
- **`Status`:** `Not started`
- **`Owner`:** the dev responsible (ask if ambiguous)
- **Spec link** in the template header

### 7. Fill the template

Use the full template below. Start with **Proposed Architecture** — it orients everything else.

### 8. Diagrams

Author diagrams as **Mermaid** (`mermaid` code blocks) directly in **Proposed Architecture** (section 3) — Notion renders them natively, so no external tool or MCP is needed. Suggested types: flowchart, sequence, state, architecture (graph). Criterion: only when they help. See ADR 0006.

Embed the `mermaid` code block in section 3 of the Tech Design body (no link to paste).

### 9. Identify decisions for ADR

Identify decisions that should become standalone ADRs in `docs/adr/`. Qualitative criterion:

> Big decisions that will last a long time. The Tech Design describes the complete solution; an ADR records a specific decision that persists.

List those decisions in **section 11** of the template. **Don't create the ADRs automatically.**

**Special attention:** if a decision is big enough to contradict the Constitution, it must become an ADR **and** a proposed Constitution update.

### 10. Constitution check — post-design re-check

After the template is fully filled, re-evaluate against Constitution and `engineering.md`:

- Did any pattern emerge during design that violates a principle?
- Did the data model break the canonical structure (`apps/web` → `packages/db` import, etc.)?
- Did the rollout strategy require unstated infra?
- Are all violations declared in section 12 (Complexity Tracking) with justification?

If new violations appear and aren't declared, fix or declare before moving to review.

### 11. Move to review

When complete (passes the final checklist), set `Status` to `In review` via Notion MCP. Define a comment window (reference: 2-3 business days).

A Tech Design has more "back and forth" than a Spec. **Decisions must live in the document, not in comment threads.**

### 12. Approve

After review and iteration, set `Status` to `Done`. Criterion: reviewed by tech lead + involved devs.

### 13. Keep alive during implementation

If something changes significantly during coding, **update the Tech Design**. A document that becomes a lie is an antipattern.

### 14. Hand off and orient next steps

Report to the user in up to 7 lines:
- Link to the created Tech Design
- Current status
- Approach summary (1 sentence)
- Diagrams created (if any)
- Decisions that should become ADRs
- Declared complexity violations (section 12) and unresolved `[NEEDS CLARIFICATION]`
- Next steps: create tasks via `tasks-writer` (from the Execution Plan)

## Tech Design template (fill in on creation)

````markdown
# Tech Design - [Feature name]

**Related Spec:** [Notion link]
**Status:** Not started | In progress | In review | Done
**Owner:** [responsible dev]
**Reviewers:** [names]
**Last updated:** [YYYY-MM-DD]

## 1. Summary
2-3 sentences describing what we'll build and how, at a high level.

## 2. Technical context
Relevant current state: what already exists, which systems will be touched, which limitations we must respect. Refer to the Constitution and the `docs/*.md` that apply.

## 3. Proposed architecture
Solution overview. Components involved and how they communicate.
(Include diagrams as Mermaid `mermaid` code blocks if they help — flowchart, sequence, state, architecture.)

## 4. Data model
- New tables/collections
- Changes to existing schemas
- Required migrations
- Client-generated IDs (cuid2), no Prisma `@default` — see `docs/coding-patterns.md`

## 5. APIs and contracts
- New endpoints (method, route, payload, response)
- Changes to existing endpoints
- Events published/consumed
- tRPC for authenticated traffic; REST under `/api/public/*` for the public wiki

## 6. Main flows
Step-by-step of critical scenarios:
- Happy path
- Relevant error flows
- Edge cases

## 7. Alternatives considered
Other approaches evaluated and why each was not chosen. Prevents the discussion from repeating in the future.

## 8. Trade-offs and risks
- What we're giving up with this approach
- Technical risks and mitigations
- Attention points for performance, security, scalability

## 9. Execution plan
Break into phases or main tasks (becomes the basis of cards in the Kanban via `tasks-writer`). **Mirror the user-story priority from the Spec** — group items by which user story they unblock.

**Foundational** (blocking prerequisites — must complete before user stories can start):
- [ ] Foundational task A
- [ ] Foundational task B

**User Story 1 (P1) — [title from Spec]:**
- [ ] Task for US1
- [ ] Task for US1

**User Story 2 (P2) — [title from Spec]:**
- [ ] Task for US2

**Polish (cross-cutting, post-MVP):**
- [ ] Polish task

For each task, when known, mark **`[P]`** if it can run in parallel with other `[P]` tasks of the same group (different files, no shared mutation). The `tasks-writer` will use this to coordinate parallel work.

## 10. Observability and rollout
- How we'll monitor (structured logs, metrics) — see `docs/resilience-observability.md`
- Deploy strategy (feature flag, gradual rollout, big bang)
- Rollback plan if something goes wrong

## 11. Decisions that become ADRs
Architectural decisions worth a separate ADR in `docs/adr/`.
- [ ] Decision X → ADR to create
- [ ] Decision Y → ADR to create

## 12. Complexity tracking (only if any Constitution/engineering rule is intentionally violated)
Each row is a justified violation. If empty, delete this section.

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| ... | ... | ... |

## 13. References
Links to: Spec, related ADRs, external docs, PoCs, loaded `docs/*.md` files.
````

## Best practices

- **Start with architecture, not details.** If the architecture is wrong, no detail saves it. Sketch first, refine later.
- **Always list considered alternatives.** Even if the choice seems obvious, recording prevents the discussion from coming back in 3 months.
- **Trade-offs are mandatory.** Every technical decision has a cost. If you can't list trade-offs, you haven't thought enough.
- **Mirror the Spec's user-story structure in section 9.** Foundational → P1 → P2 → P3 → Polish. Implementer can ship MVP after P1 alone.
- **Mark parallelism in section 9.** `[P]` on tasks that touch different files and have no shared mutation. The `tasks-writer` consumes this.
- **Diagrams are worth a thousand words.** But only when they help. Author them as **Mermaid** code blocks (rendered natively in Notion).
- **Stay focused on "how", not "what".** Behavior is Spec — go back and adjust there.
- **Big decisions become ADRs.** The Tech Design describes the full solution; the ADR records a specific decision that lasts.
- **Declare Constitution violations openly in section 12.** Hidden violations rot the system. Visible ones with a justification are tracked debt.

## Antipatterns

- ❌ **Tech Design became a Spec** — describing what the feature does instead of how. Go back to the Spec.
- ❌ **Tech Design without alternatives** — picked an approach without recording what was discarded.
- ❌ **Exhaustive Tech Design** — every line of code described. Direction, not transcription.
- ❌ **Tech Design ignored during implementation** — code went elsewhere and no one updated. Document becomes a lie.
- ❌ **Tech Design for a trivial feature** — 2 days documenting something that codes in 4 hours.
- ❌ **Architectural decision hidden in the Tech Design** — promote to ADR.
- ❌ **Hidden Constitution violation** — pretending the rule doesn't apply. Either comply, declare in section 12, or open an ADR.
- ❌ **Execution plan as a flat TODO list** — without user-story grouping, the implementer can't ship MVP early.

## Final checklist before approving

- [ ] Related Spec is approved and linked
- [ ] All `[NEEDS CLARIFICATION]` from the Spec are resolved
- [ ] Proposed architecture is clear (with diagram if needed)
- [ ] Data model changes described
- [ ] APIs and contracts defined
- [ ] Happy path and main errors mapped
- [ ] At least 1-2 considered alternatives listed
- [ ] Trade-offs explicit
- [ ] Execution plan grouped by user story (Foundational → P1 → P2 → ... → Polish), with `[P]` markers where applicable
- [ ] Rollout and observability strategy defined
- [ ] Decisions that become ADRs identified
- [ ] Section 12 (Complexity Tracking) is either empty or filled with justification for every Constitution/engineering rule violated
- [ ] Doesn't contradict the Constitution, `engineering.md`, loaded detail docs, or existing ADRs (silently)
- [ ] Reviewed by tech lead + involved devs

If any item fails, fix it before moving to `Done`.

## Available resources

- **Notion MCP** — search Spec, existing Tech Designs; create the Tech Design in `Docs`; move status
- **Mermaid (diagrams-as-code)** — architecture, sequence, flowchart, state diagrams as `mermaid` code blocks in Notion (no MCP needed)
- **context7 MCP** — current library/SDK/CLI docs when designing approaches that use external APIs
- **Filesystem** — `.ai/constitution.md`, `.ai/engineering.md`, relevant `docs/*.md`, ADRs in `docs/adr/`, code

## On error

**If the related Spec is not `Done`:**
- Stop and instruct the user to finalize the Spec first

**If the Spec has unresolved `[NEEDS CLARIFICATION]`:**
- Stop and either resolve them via the clarification protocol (with the user) or send the user back to update the Spec
- Don't paper over with assumptions in the Tech Design

**If the Spec has `UI: yes` and `design_url` is empty or still `[NEEDS DESIGN: link pending]`:**
- Stop and tell the user to run `/design-handoff` to attach the canonical link (`claude.ai/design`), or to edit section 3.5 of the Spec directly
- Don't invent a design or proceed without the link

**If the Spec carries open `[NEEDS DESIGN: …]` markers:**
- Stop and quote every marker verbatim so the user can see exactly what's open
- Tell the user to close them via `/design-handoff` or by editing the Spec before retrying
- Don't paper over with assumptions in the Tech Design

**If the Spec's `UI:` header is blank (step 2.5 of `spec-writer` was skipped):**
- Stop and send the user back to `spec-writer` to set `UI: yes` or `UI: no`
- Don't guess the verdict — downstream gating depends on this single source of truth

**If the Constitution and the proposed approach conflict:**
- Apply the pre-design gate (step 5): adjust, justify in section 12, or propose ADR
- Don't proceed silently

**If existing ADRs contradict the proposed approach:**
- Point out the conflict
- Ask whether to propose a new ADR superseding the previous one, or adjust the approach

**If the Spec doesn't cover a behavior the Tech Design needs to decide on:**
- Stop and point out the gap
- Suggest updating the Spec first (principle: the Spec is the source of truth for behavior)

**If the contract in `.ai/README.md` diverges from Notion's actual state:**
- Stop and warn the user
- Ask to update the contract before proceeding
