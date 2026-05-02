# Skill: Spec writer

This Skill is **full-content**: it carries the entire process for creating a Spec. It does not delegate to a human Playbook in Notion. To change the process, edit this file (the Cursor adapter picks it up automatically).

## When to use

Use when the user asks to:
- Create a new Spec
- Write a feature specification
- Document a feature before implementing
- "Let's start feature X" or "I need to spec Y"

**Create a Spec when:**
- The feature is described in the **PRD or roadmap**
- There's more than one plausible way to solve the problem
- The feature impacts more than one product area
- Behavior alignment with other stakeholders is needed (design, PM, eng)

**Don't use when:**
- It's a trivial fix, bug, copy change, or small visual polish
- The user asks to create a Tech Design (use `tech-design-writer`)
- The user asks to implement code (use `spec-implementer`)

## What a Spec is

> A Spec describes **what** a feature does and **why** it exists. It does not describe *how* to implement it — that's the Tech Design.

Every significant feature must have a Spec before it becomes code.

## Prerequisites

Before starting:

1. **PRD exists** — search Notion `Docs` for `Category` containing `Product`. If missing, warn the user and ask whether to proceed anyway.
2. **Spec not duplicated** — search `Docs` for `Doc name` starting with `Spec - [Feature name]`. If it exists, ask whether to update the existing one instead of creating a new one.
3. **Problem and Goal are clear** — if the user can't describe each in 2-3 sentences, it's not yet time to write the Spec. Ask before continuing.

## Notion contract

See `.ai/README.md`, section "Notion configuration (contract)". In particular: `Docs` database, `Category` is `multi_select`, value `Spec`.

## Execution flow

### 1. Read principles and context

Read, in order:
1. `.ai/constitution.md` — the Spec must respect every principle.
2. `.ai/engineering.md` — to ensure the Spec doesn't assume behavior incompatible with the canonical stack.

A Spec is about **behavior**, not implementation. Don't load `docs/*.md` files here — those belong to the Tech Design.

### 2. Gather context from the user

Before writing, confirm with the user:
- **Problem** the feature solves (1-2 sentences)
- **Goal** desired (1-2 sentences)
- **Target users** and **at least one real usage scenario**
- Are there known **dependencies** or **risks**?
- Which **PRD or PRD section** originates this Spec?

Use the **clarification protocol** below for anything ambiguous.

### 3. Clarification protocol

When the description has gaps, **don't ask blindly**. Apply this rule:

**Do not ask if there's a reasonable default.** Make an informed guess and document it in section "Assumptions". Reasonable defaults:
- **Data retention**: industry-standard practices for the domain
- **Performance targets**: standard web/mobile expectations
- **Error handling**: user-friendly messages
- **Auth method**: standard session-based or OAuth2 for web
- **Integration patterns**: REST/tRPC for app, REST for public API

**Ask only when** the choice meaningfully impacts:
- **Scope** (what's in/out — highest priority)
- **Security/privacy** (BYOK, encryption, retention)
- **User experience** (visible flows, paywalls, limits)
- **Technical architecture** (only if it changes the Spec's behavior contract)

**Limit: max 3 questions per round.** When you ask, format as a table with options:

```
Question 1: [Crisp question, ≤15 words]
| Option | Description | Implication |
|---|---|---|
| A | ... | ... |
| B | ... | ... |
| C | ... | ... |
| Custom | (the user writes it) | (the user describes) |
```

Number the questions (Q1, Q2, Q3) so the user can answer "Q1: A; Q2: Custom: ...".

After answers, update the Spec and continue. **If the user can't answer or the answer is ambiguous, mark the Spec with `[NEEDS CLARIFICATION: short question]` (max 3 markers total) and proceed — don't loop forever.**

### 4. Create the page in Notion

Via the Notion MCP, create a page in the `Docs` database with:
- **`Doc name`:** `Spec - [Feature name]`
- **`Category`:** contains `Spec`
- **`Status`:** `Not started`
- **`Owner`:** the user (ask if ambiguous)

### 5. Fill the template

Use the full template below. Start with **Problem** and **Goal** — if those two can't be written clearly, stop and talk to the user.

### 6. Move to review

When content is complete (passes the final checklist below), set `Status` to `In review` via Notion MCP. Suggest the user define a comment window (reference: 3 business days).

### 7. Approve

After review and adjustments, set `Status` to `Done`. **Who moves it:** the owner, after absorbing comments (decisions live in the document, not in comment threads).

### 8. Hand off and orient next steps

Report to the user in up to 5 lines:
- Link to the created Spec
- Current status
- Assumptions made (if any) and `[NEEDS CLARIFICATION]` markers (if any)
- Next steps: Tech Design via `tech-design-writer`, then Tasks via `tasks-writer`, then implementation via `spec-implementer`

## Spec template (fill in on creation)

````markdown
# Spec - [Feature name]

**Status:** Not started | In progress | In review | Done
**Owner:** [your name]
**Reviewers:** [names]
**Last updated:** [YYYY-MM-DD]

## 1. Context and Problem
What problem does this feature solve? Why now?

## 2. Goal
What do we want to achieve? What's the expected outcome?

## 3. User Stories
Prioritized as user journeys. **Each story must be INDEPENDENTLY TESTABLE** — implementing only one delivers a viable MVP slice on its own. List in priority order: P1 (MVP), P2, P3...

### Story 1 — [Title] (Priority: P1) 🎯 MVP
**Why this priority:** [1 sentence — what value this delivers alone]
**Independent test:** [How a user/QA validates this story works without P2/P3 implemented]

**Acceptance scenarios** (Given/When/Then):
- **Scenario 1:** Given [precondition], when [action], then [expected outcome].
- **Scenario 2:** Given [...], when [...], then [...].

### Story 2 — [Title] (Priority: P2)
**Why this priority:** ...
**Independent test:** ...
**Acceptance scenarios:**
- Given [...], when [...], then [...].

### Edge Cases
- [Edge case 1 — what happens when X is empty / Y times out / Z conflicts]
- [Edge case 2 — ...]

## 4. Functional Requirements
Numbered, testable, format `System MUST [capability]`. Mark uncertainty with `[NEEDS CLARIFICATION: question]` (max 3).
- **FR-001:** System MUST [capability]
- **FR-002:** System MUST [capability]

## 5. Non-Functional Requirements
Performance, security, accessibility, observability, etc. Numbered if useful.
- **NFR-001:** [requirement]

## 6. Out of Scope
What this feature **does not** do. As important as what it does.
- ...
- ...

## 7. Success Criteria
**Measurable, technology-agnostic outcomes.** Don't write "API responds in 200ms" — write "user sees results in under 1 second". Don't write "DB handles 1000 TPS" — write "system supports N concurrent campaigns without lag".
- **SC-001:** [Outcome with a number]
- **SC-002:** [Outcome with a number]

## 8. Dependencies and Risks
- **Depends on:** [other features, integrations, pending decisions]
- **Risks:** [technical, product, schedule]

## 9. Assumptions
Decisions made by the spec author when the user description was silent. Each assumption should be reversible (the user can override during review).
- ...
- ...

## 10. References
Links to: PRD, related research, ADRs, mockups.
````

> The status header (`Not started | In progress | In review | Done`) reflects the actual values of the Notion DB — source: contract in `.ai/README.md`.

## Diagrams

A Spec usually does not need diagrams — textual scenarios (section 3) are enough. If the feature has non-obvious flows and the user asks, use the **tldraw MCP** and paste the link in section 3 or 10.

## Best practices

- **Focus on "what" and "why", never on "how".** Architecture, database, algorithm is Tech Design — move it there.
- **User stories as MVP slices.** Each P1/P2/P3 story should deliver value alone. If story 2 can't ship without story 1, it's not really independent — rethink the slice.
- **Success Criteria are user-facing metrics.** "Users complete setup in <2 min", "campaign opens with <500ms perceived latency". Tech metrics belong in the Tech Design.
- **Acceptance Scenarios in Given/When/Then.** Forces concrete preconditions and outcomes; vague ones don't survive the format.
- **Write "Out of Scope" early.** Prevents misunderstandings. "Does this fit?" → into that section.
- **Limit clarifications.** Max 3 NEEDS CLARIFICATION markers in the Spec; max 3 questions per round to the user. Use defaults otherwise.
- **Specs live.** If something changes during implementation, update the Spec **first**, then the code.
- **One Spec, one cohesive feature.** Past 5 pages? Split.

## Antipatterns

- ❌ **Spec became a Tech Design** — full of implementation details. Move them to the Tech Design.
- ❌ **Spec became meeting minutes** — records discussions instead of decisions. Reflect outcomes.
- ❌ **User stories that aren't independent** — Story 2 needs Story 1 to be useful. Then they're one story.
- ❌ **Acceptance "the system works"** — not verifiable. Use Given/When/Then.
- ❌ **Success Criteria with tech metrics** — "200ms response" belongs to Tech Design. Use user-facing metrics.
- ❌ **More than 3 NEEDS CLARIFICATION markers** — you're asking too much. Use defaults.
- ❌ **Giant Spec** — past 5 pages? Split it.
- ❌ **Spec written after the code** — defeats the purpose.

## Final checklist before approving

Walk through this before moving `Status` to `Done`:

- [ ] Problem and goal are clear in 2-3 sentences each
- [ ] At least one P1 user story with Independent Test and Acceptance scenarios in Given/When/Then
- [ ] Each user story is independently testable as an MVP slice
- [ ] Functional requirements are specific and testable (`System MUST...`)
- [ ] "Out of Scope" is filled
- [ ] Success Criteria are measurable and technology-agnostic
- [ ] Dependencies and Risks mapped
- [ ] Assumptions explicit (not silent guesses)
- [ ] No more than 3 `[NEEDS CLARIFICATION]` markers remain (zero is the goal)
- [ ] Reviewed by at least 1 person from each relevant area (PM, Eng, Design)
- [ ] Does not contradict the Constitution (`.ai/constitution.md`)
- [ ] Does not assume a stack or structure different from the canonical one (`.ai/engineering.md`)

If any item fails, fix it before moving to `Done`.

## Available resources

- **Notion MCP** — search PRD and existing Specs; create the Spec in `Docs`; move status
- **tldraw MCP** — occasional diagrams, when useful (rare in a Spec)
- **context7 MCP** — not typical in a Spec (Spec is behavior, not API). Use only if the user asks for a specific library reference to validate feasibility.
- **Filesystem** — `.ai/constitution.md`, `.ai/engineering.md`, ADRs in `docs/adr/`

## On error

**If the PRD is not found:**
- Warn the user and ask whether to proceed anyway or create the PRD first

**If a Spec with a similar name already exists:**
- List it for the user and ask: update existing or create new?

**If the Constitution and the proposed Spec conflict:**
- Point out the specific conflict
- Ask whether to adjust the Spec or propose an ADR to change the Constitution
- Don't proceed silently against it

**If the user can't answer a clarification question:**
- Don't loop. Mark the Spec with `[NEEDS CLARIFICATION: short question]` (max 3 total) and continue.
- Flag in the handoff so the Tech Design phase can resolve it.

**If the contract in `.ai/README.md` diverges from Notion's actual state:**
- Stop and warn the user
- Ask to update the contract before proceeding
