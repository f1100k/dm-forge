# Skill: Tasks writer (from Tech Design)

This Skill is **full-content**: it carries the entire process for breaking a Tech Design into Kanban cards. It does not delegate to a human Playbook in Notion. To change the process, edit this file (the Cursor adapter picks it up automatically).

## When to use

Use when the user asks to:
- Break a Tech Design into tasks
- Create cards in the Kanban from the Execution Plan
- "Create tasks for feature X", "prepare implementation of Y"
- Start the execution phase of an already-designed feature

**Don't use when:**
- The Tech Design is not yet `Done`
- It's a trivial feature without a Tech Design (full SDD doesn't apply)
- The user asks to implement code (use `spec-implementer`)

## Core principle

**Each item in section 9 (Execution plan) of the Tech Design becomes one card in the Kanban.** The Skill does not invent tasks, doesn't merge items, doesn't split items — granularity comes from the Tech Design. If the Execution Plan has wrong granularity, **stop and ask the user to adjust the Tech Design** instead of improvising here.

The cards inherit three things from the Tech Design:
- **Phase** (Foundational / User Story P1 / User Story P2 / Polish) — user stories ship as MVP slices
- **`[P]` parallel marker** — tasks that can run alongside other `[P]` tasks in the same group
- **Dependencies** — tasks that must complete first (e.g., a User Story task usually depends on the Foundational phase)

## Prerequisites

Before starting:

1. **Tech Design `Done`** — search Notion `Docs` for `Doc name` starting with `Tech Design - [Feature name]`, `Category` containing `Tech Design`, `Status = Done`. **If not `Done`, stop** and instruct the user to finalize it first.
2. **Spec `Done`** — the related Spec (same feature, prefix `Spec - `) must be `Done`. Card acceptance criteria are pulled from there.
3. **Tasks not duplicated** — search the `Kanban` for cards already linked to this Tech Design (link in the body). If they exist, ask whether to complement (create only the missing ones) or replace (after archiving the old ones).

## Notion contract

See `.ai/README.md`, section "Notion configuration (contract)" → "Kanban". The canonical properties are documented there; here's the summary of what this skill uses:

- **`Task name`** (title) — `[Phase prefix] Feature: item description` (see template below)
- **`Status`** (status) — `Not started` (initial); later moved by `spec-implementer` to `In progress` → `Review` → `Done`
- **`Description`** (rich_text) — 1-line summary
- **`Task type`** (multi_select) — default: `💬 Feature request`. Use `💅 Polish` for Polish-phase cards. Use `ADR` if the task is "write ADR X". Use `🐞 Bug` for bug cards.
- **`Assignee`** (people) — optional, if the user defines it
- **`Priority`** (select) — set from the user-story priority: P1 → `High`, P2 → `Medium`, P3 → `Low`. Foundational defaults to `High`. Polish defaults to `Low`.
- **`Effort level`** — leave blank; user fills later

If the README contract is out of date relative to the actual Notion, **stop** and ask to update it before creating cards.

## Execution flow

### 1. Read principles and context

Read, in order:
1. `.ai/constitution.md`
2. `.ai/engineering.md`

Don't load `docs/*.md` files — task granularity is defined by the Tech Design.

### 2. Read the Tech Design

Via Notion MCP, read the full Tech Design. In particular:
- **Section 9. Execution plan** — each item becomes a card; respect Phase grouping (Foundational / User Story P1 / P2 / ... / Polish) and `[P]` markers
- **Section 1. Summary** and **3. Proposed architecture** — pull short context for the card body
- **Section 5. APIs and contracts** and **4. Data model** — disambiguate scope when needed
- **Section 12. Complexity Tracking** — if a task is implementing a justified violation, surface it in the card body so the implementer doesn't trip on the Constitution check

### 3. Read the Spec

Via Notion MCP, read the related Spec. In particular:
- **Section 3. User Stories** — each card in a User Story phase carries the parent story title and its Independent Test reference
- **Acceptance scenarios** (Given/When/Then) — clip the ones that apply to each card's scope
- **Section 7. Success Criteria** — surface the relevant SCs for the implementer to keep in mind

### 4. Validate granularity, phases, and parallelism

Before creating cards, validate the Execution Plan:

- ✅ Each item describes a reasonably independent unit of work (1 PR each, ideally)
- ✅ Items are grouped by phase (Foundational / User Stories / Polish) — if not, ask the user to adjust the Tech Design
- ✅ Each User Story phase contains tasks that, together, deliver that story end-to-end (so each P1/P2/P3 story is a usable MVP slice when done)
- ✅ `[P]` markers are present on items the Tech Design judged parallelizable — if missing entirely, ask the user whether to infer (rule: tasks touching different files with no shared mutation can be `[P]`)
- ❌ Giant item mixing backend + frontend + migration + tests
- ❌ Vague item ("do the backend") with no scope indication
- ❌ User Story phase with no test coverage

If granularity, phasing, or parallelism is wrong, **stop and tell the user**. Suggest updating the Tech Design.

### 5. Plan tests per User Story phase

**Tests for new behavior are not optional.** For each User Story phase, ensure at least one card has a `## Tests` section listing:
- Unit/integration coverage for the new behavior (Vitest)
- Mapping to Acceptance scenarios (the Given/When/Then from the Spec)
- No E2E (MVP rule)

If a user-story task is too small to deserve a separate test card, the test goes inline in the implementation card. The test is part of the same PR.

### 6. Confirm the list with the user

Before creating any card, build and show the user, **grouped by phase**:

```
Foundational:
  - [ ] Card 1 — short scope (Priority: High)
  - [ ] Card 2 [P] — short scope (Priority: High)

User Story 1 (P1) — [Story title]:
  - [ ] Card 3 — short scope (Priority: High, depends on: Card 1)
  - [ ] Card 4 [P] — short scope (Priority: High, depends on: Card 2)
  - [ ] Card 5 — tests for US1

User Story 2 (P2) — ...:
  - ...

Polish:
  - [ ] ...
```

Show how many acceptance criteria each card carries and any declared Constitution complexity violations from section 12.

Ask: "create this list in the Kanban?" Wait for confirmation. **Don't create cards in bulk silently.**

### 7. Create the cards in the Kanban

Via Notion MCP, create one card per Execution Plan item with:

- **`Task name`:** `[Phase] [Feature]: [item]` — e.g., `[Foundational] Bootstrap: add AiConnection table` or `[US1] Bootstrap: list connections in settings`. Prefix conventions: `[Foundational]`, `[US1]`, `[US2]`, `[US3]`, `[Polish]`.
- **`Status`:** `Not started`
- **`Task type`:** per phase mapping above
- **`Priority`:** per phase mapping above (P1 → High, P2 → Medium, P3 → Low; Foundational → High; Polish → Low)
- **`Description`:** 1-line summary (more detail goes in the body)
- **`Assignee`:** empty or set by the user
- **`Effort level`:** empty (user fills later)

Use the body template below.

### 8. Update the Tech Design with card links

After creating the cards, edit the Tech Design in Notion to include links to the created cards — append to the end of section 9 (or in a new "Tasks" section) using the page links obtained via Notion MCP, **grouped by phase** (matching the Execution Plan structure).

This guarantees bidirectional traceability: Tech Design → cards and card → Tech Design.

### 9. Validate coverage and traceability

Before closing:
- [ ] Each item in section 9 of the Tech Design has exactly 1 card in the Kanban
- [ ] Each card carries Phase, User Story (or N/A), Parallel info, Depends-on, Acceptance, Tests, References
- [ ] Each User Story phase has test coverage represented (separate card or inline)
- [ ] Each card points to the Tech Design and the Spec
- [ ] The Tech Design was updated with card links grouped by phase
- [ ] No card was created without corresponding to an Execution Plan item

### 10. Hand off and orient next steps

Report to the user in up to 8 lines:
- Total cards created (with links), grouped by phase
- Tech Design updated (link)
- Which cards are parallelizable now (no blocking dependencies) — useful when more than one dev can pick work
- Next steps: implementation via `spec-implementer`, **one task per invocation**. Suggest starting with the Foundational phase; once Done, P1 user-story cards unlock.

## Card body template (Markdown)

````markdown
## Phase
Foundational | User Story 1 (P1) | User Story 2 (P2) | User Story 3 (P3) | Polish

## User Story
[US1: short title from the Spec — link to the Spec section]
(or `N/A` for Foundational/Polish)

## Parallel
- Yes — can run alongside: [card name(s)]
- No — exclusive

## Depends on
- [card name or task ID that must be `Done` first]
(or `None`)

## Context
[1-2 lines: what this task delivers in the context of the feature]

## Scope
[bullets: what's in this card]
- ...
- ...

## Acceptance criteria
Clip the Given/When/Then scenarios from the Spec User Story that this card directly enables. Add any task-specific criteria.
- [ ] Given [...], when [...], then [...].
- [ ] ...

## Success criteria touchpoint
List the SC IDs from the Spec this card contributes to (no need to fully satisfy — just contribute).
- SC-001
- SC-003

## Tests
**Required.** New behavior ships with tests in the same PR.
- [ ] [Type: Vitest unit | integration] — [what's tested]
- [ ] ...

## Constitution complexity (if any)
If this card implements a violation declared in section 12 of the Tech Design, summarize the violation and the justification here. Otherwise: `None`.

## References
- **Tech Design:** [page link]
- **Spec:** [page link]
- **Execution Plan item:** "[verbatim text of the item]"
````

## Best practices

- **Granularity = 1 PR.** If the task doesn't fit in one reasonable PR, it's too big — go back to the Tech Design.
- **Phases drive Priority.** Foundational and P1 User Story → High. P2 → Medium. P3/Polish → Low. Implementer naturally drains the queue in MVP order.
- **`[P]` only when truly parallel.** Different files, no shared mutation, no shared DB transaction. When in doubt, mark No.
- **Tests in every User Story phase.** No exceptions. Either as separate test cards or inline test items in implementation cards.
- **Acceptance criteria on the card.** Pulled from the Spec's User Story scenarios. Implementer doesn't need to round-trip to the Spec.
- **Bidirectional traceability.** Card points to Tech Design and Spec. Tech Design points back to the cards (grouped by phase).
- **Confirmation before bulk creation.** Always show the grouped list and ask for OK.
- **Verbatim Execution Plan item.** Paste the original item text in the card. Helps detect drift if the Tech Design is edited later.

## Antipatterns

- ❌ **Card without acceptance criteria.** Implementer won't know when to stop.
- ❌ **Card without tests.** Tests are not optional in this project.
- ❌ **Card called "polish" or "final adjustments".** Too vague. Split it or attach to a specific phase.
- ❌ **Card mixing areas (back + front + DB).** Almost always too big.
- ❌ **Generic cards** ("do backend", "do frontend"). No scope = TODO list, not Kanban.
- ❌ **Inventing tasks outside the Execution Plan.** If tasks are missing, the Tech Design is incomplete — update the Tech Design, don't invent cards.
- ❌ **All cards marked `[P]`.** Real parallelism is rare. Default is sequential within a phase.
- ❌ **User Story cards without dependency on Foundational.** They'll fail when the implementer picks them up out of order.
- ❌ **Polish cards before User Stories Done.** Polish is post-MVP — those cards block on user stories ending.

## Final checklist before handoff

- [ ] Tech Design and Spec both `Done`
- [ ] Execution Plan has phase grouping (Foundational / US1..N / Polish) and healthy granularity
- [ ] List of cards confirmed with the user before creation
- [ ] Each card carries Phase, US label (or N/A), Parallel info, Depends-on, Acceptance, Success Criteria touchpoint, Tests, Constitution complexity (if any), References
- [ ] Each User Story phase has test coverage represented
- [ ] Tech Design updated with card links grouped by phase
- [ ] No duplicate cards from previous runs
- [ ] Notion contract validated for the `Kanban` database

## Available resources

- **Notion MCP** — search Spec/Tech Design; verify `Kanban` shape; create cards; update the Tech Design
- **tldraw MCP** — not used in this skill
- **context7 MCP** — not used in this skill (no new code here)
- **Filesystem** — `.ai/constitution.md`, `.ai/engineering.md`

## On error

**If the Tech Design is not `Done`:**
- Stop and instruct the user to finalize it first

**If the related Spec is not `Done`:**
- Stop and warn — criteria come from the Spec; it must be stable

**If the Execution Plan is missing, vague, or has wrong granularity / no phases / no `[P]` info:**
- Point out the specific problem
- Suggest updating the Tech Design before creating cards
- Don't improvise splits, merges, or paralellism inference (unless the user explicitly asks)

**If a User Story phase has no test representation:**
- Stop and ask: which task carries the tests, or should we add a dedicated test card?
- Don't create cards without resolving this

**If cards already exist in the Kanban linked to this Tech Design:**
- List them for the user
- Ask: complement (create only missing) or replace (after archiving old)?
- Don't create duplicates silently

**If the `Kanban` contract in `.ai/README.md` diverges from Notion's actual state:**
- Stop and ask to update the contract
- Don't invent properties
