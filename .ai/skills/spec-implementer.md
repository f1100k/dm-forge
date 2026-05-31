# Skill: Spec implementer

## When to use

Use when the user asks to:
- Implement a specific Kanban task
- "Implement task X", "do card Y", "start the implementation of Z"
- Execute an item from the Execution Plan that's already broken into a card

**Don't use when:**
- There's no Kanban card for the change (use the SDD flow: spec-writer → tech-design-writer → tasks-writer first)
- It's a trivial untracked fix (typo, dep bump, config tweak) — implement directly, no ceremony
- The user asks to implement multiple tasks at once — execute only **one** and ask the user to invoke the Skill again for the next

## Core principle

**One invocation = one task implemented.**

All **behavior** rules come from the feature's Spec and Tech Design. All **how-to-implement** rules come from the Constitution, `engineering.md`, and the relevant `docs/*.md`.

The Skill **does not improvise**. If the Spec, Tech Design, or card is ambiguous or conflicts with the Constitution, it **stops and asks**.

## Contract

### Notion
- Task card lives in the `Kanban` database (contract in `.ai/README.md`).
- Tech Design and Spec live in the `Docs` database.
- The card points to the Tech Design (and transitively to the Spec) — convention created by `tasks-writer`.

### Repo
- Constitution: `.ai/constitution.md`
- Engineering rules: `.ai/engineering.md`
- Detail docs: `docs/*.md` (load per the "When to dive deeper" table in `engineering.md`)
- ADRs: `docs/adr/`
- Pre-PR checklist: `docs/implementation-checklist.md`

## Execution flow

### 1. Identify the task

Confirm with the user **which card** will be implemented in this invocation:
- ID, title, or Notion page link
- If ambiguous (e.g., two cards with similar names), list options and ask
- If the user says "the next one", search the `Kanban` for the first available card per the contract convention (e.g., `Status = Not started`, no assignee or assignee = the user)

### 2. Read the card and extract links

Via Notion MCP, read the full card. Extract:
- **Phase** (Foundational / User Story P1/P2/P3 / Polish)
- **User Story label** (`[US1]`, `[US2]`, or `N/A`)
- **Parallel** info (does this card block others, or run alongside?)
- **`Depends on`** list (cards that must be `Done` first)
- **Acceptance criteria** (in the body)
- **Success Criteria touchpoint** (which SCs from the Spec this card contributes to)
- **Tests** section (required test coverage for the new behavior)
- **Constitution complexity** (if the card implements a declared violation)
- **Tech Design link**
- **Spec link**
- **Current status** and **Assignee**

If the link to the Tech Design or Spec is missing, **stop and ask** — don't implement without traceability.

### 2.1 Validate dependencies

For each card listed in **`Depends on`** in the card body:
- Look it up in the Kanban via Notion MCP.
- If its `Status` is not `Done`, **stop and tell the user**. Don't start a card whose prerequisites haven't shipped — you'll either block on missing pieces or have to mock work that's still being implemented.
- If the user wants to proceed anyway (e.g., "I know it's almost done, just implement around it"), require an explicit confirmation and surface this in the final handoff.

### 3. Read the Spec and Tech Design

Via Notion MCP, read both documents in full:
- The **Spec** defines **behavior** and complete acceptance criteria for the feature.
- The **Tech Design** defines **architecture, technical approach, file structure, contracts** and the specific Execution Plan item this task implements.

If the Spec or Tech Design isn't `Status = Done`, **stop and warn** the user. Implementation over unfinalized Spec/Tech Design is waste.

### 4. Read principles and technical context

Read, in order:

1. `.ai/constitution.md`
2. `.ai/engineering.md`
3. **Relevant `docs/*.md`** — use the "When to dive deeper" table in `engineering.md` (canonical source) to identify which files to load based on the task scope. Load all that match — don't skimp. If the table and the scope don't clearly align, prefer to load less.
4. **Applicable ADRs** in `docs/adr/`. If an ADR's name or content suggests relation to the task, read it.

### 5. Check for conflicts before touching code

Before any change:

- Does the Tech Design contradict the Constitution, `engineering.md`, or a loaded `docs/*.md` **without** declaring the violation in section 12 (Complexity Tracking)? **Stop and tell the user.** Hidden violations are a no-go.
- Does the Tech Design contradict an existing ADR without mentioning it? **Stop and tell.**
- Does the Spec describe behavior the Tech Design doesn't cover? **Stop and tell.**
- Does the card scope go beyond the Execution Plan item? **Stop and tell.**
- Does the card carry a `[NEEDS CLARIFICATION]` marker inherited from the Spec/Tech Design? **Stop and resolve via the clarification protocol below.**

### 5.1 Clarification protocol

If a non-trivial decision shows up that isn't covered by the card / Tech Design / Spec, **don't decide silently**. Apply this rule:

**Don't ask if there's a reasonable default.** Use the existing patterns in the codebase as the default. Document the choice in a code comment (in English) referencing the section of `docs/*.md` or `engineering.md` that justified it.

**Ask only when** the choice meaningfully impacts:
- **Behavior** visible to the user (escalate to the Spec)
- **Architecture** (escalate to the Tech Design)
- **Security/privacy** or **data integrity**

**Limit: max 3 questions.** Format as a table:

```
Question 1: [Crisp question, ≤15 words]
| Option | Approach | Implication |
|---|---|---|
| A | ... | ... |
| B | ... | ... |
| Custom | (the user writes it) | (the user describes) |
```

If the answer reveals that the Spec or Tech Design has a real gap (not just an implementation detail), **stop and suggest updating the upstream document** before continuing. Don't paper over Spec/Tech Design holes with code decisions.

### 6. Update the card status in the Kanban

Via Notion MCP, move the card to `Status = In progress`. If `Assignee` is empty, set it to the user (ask if ambiguous).

> **Watch the `Kanban` status names** (different from `Docs`): `Not started` → `In progress` → `Review` → `Done`. Use `Review` during PR review, not `In review`.

### 7. Prepare the branch

From `master` (or whichever branch the user indicates):

```bash
git checkout master
git pull
git checkout -b feature/<card-id-or-slug>-<short-description>
```

Branch naming convention: `feature/<slug>` derived from the card title. If the card has a short ID/number, use it as the prefix.

### 8. Implement per the Tech Design

Implement **only the scope of the Execution Plan item matching the card**.

Operating principles:
- **Surgical** — touch only what the task asks for. Don't "improve" adjacent code.
- **No invention** — if a non-trivial decision shows up that isn't covered, apply the **Clarification protocol** (step 5.1). Don't decide silently.
- **Patterns before new code** — before creating something new (component, hook, utility), look for an equivalent in the codebase. Reuse.
- **Tests are mandatory, not optional** — every new behavior on this card ships with test coverage in the same PR. Vitest unit and/or integration. The card's `## Tests` section lists what's required; complete it. Acceptance scenarios from the Spec map to test cases. No E2E (MVP rule).
- **No filler comments** — only comments where the "why" isn't obvious from the code.
- **Language**: everything in the codebase in English — identifiers, comments, code-internal strings, and user-facing strings (error messages returned via tRPC/REST, UI copy). Notion artifacts (Specs, Tech Designs, Kanban) stay in PT-BR.

### 9. Run the pre-PR checklist

Open `docs/implementation-checklist.md` and walk every item. For each:
- Conformance: Spec/Tech Design/Constitution/ADRs OK? Acceptance scenarios from the card covered?
- Code quality: `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm test`?
- **Tests gate**: did you add tests for **every** new behavior? Each item in the card's `## Tests` section is implemented? `pnpm test` passes? **This is a hard gate — no exception.**
- Patterns: client IDs, soft delete, optimistic, bootstrap, LLM via `packages/ai`, beats in Tiptap?
- Security/privacy: no BYOK/prompt/content in logs? typed errors? row-level auth?
- Notion/Kanban: card in the right status? PR links card and docs?

If anything fails, **fix it before proceeding**. Don't skip items. Don't use `--no-verify`. Don't skip tests with the excuse "I'll add them next PR".

### 10. Commit and push

Create small commits. Messages follow **Conventional Commits** (rule in `.ai/engineering.md` Standards): `type(scope): description`. Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Scope is usually the package (`api`, `web`, `db`, `ai`) or feature.

The last line of the body (or footer) references the Kanban card — ID or link.

```bash
git push -u origin <branch>
```

### 11. Open the PR via the GitHub MCP

Via the **GitHub MCP** (`create_pull_request`), open the PR against `master`:

- **Repo:** `f1100k/dm-forge` (or whatever `git remote -v` shows)
- **Head:** the branch published in step 10
- **Base:** `master`
- **Title:** Conventional Commits — `<type>(<scope>): <description>`. Use the appropriate type (`feat`, `fix`, `docs`, `refactor`, `chore`, etc.) and scope (package or area). No card ID in the title — that goes in the body.
- **Body:**
  - Link to the Kanban card
  - Link to the Spec
  - Link to the Tech Design
  - `## What` section (1-3 bullets of what changed observably)
  - `## Why` section (link to the Spec; don't repeat the Spec)
  - `## Test plan` section (manual or automatic checks)

If the call fails (token without permission, branch without upstream, etc.), stop and report the error to the user — don't try a workaround.

### 12. Update the card in the Kanban

Via Notion MCP:
- Move the card to `Status = Review` (the Kanban uses `Review`, not `In review`)
- Paste the PR link in the card body, in a `## PR` section

### 13. Hand off to the user

Report to the user in up to 5 lines:
- Card implemented (Kanban link)
- PR opened (link)
- Current card status (`Review`)
- Did the checklist pass? (yes or items with caveats)
- Next steps: human review → merge → move card to `Done`

## Available resources

- **Notion MCP** — read card/Spec/Tech Design, move the card in the Kanban, paste links
- **GitHub MCP** — create the PR (`create_pull_request`); read files via API if needed; comment on PRs/issues
- **context7 MCP** — current library/SDK/CLI docs (use when touching external APIs instead of guessing from memory)
- **Diagrams** — Tech Design diagrams are Mermaid `mermaid` code blocks; read them inline in Notion. This skill doesn't create diagrams.
- **Filesystem** — Constitution, engineering, relevant `docs/*.md`, ADRs, code
- **Bash** — project commands (pnpm, git). Code push goes via `git` + SSH (existing setup).

## On error

**If the card has no link to a Tech Design or Spec:**
- Stop and ask the user to confirm traceability
- Don't implement without it

**If the Spec or Tech Design isn't `Done`:**
- Stop and instruct the user to finalize first
- Don't implement over drafts

**If the Tech Design contradicts the Constitution / engineering / docs / ADRs:**
- Stop and tell the user
- Suggest: (a) adjust the Tech Design, or (b) propose an ADR + Constitution update
- Don't proceed silently against it

**If the task scope turns out to exceed one card during implementation:**
- Stop and warn
- Suggest splitting the card (`tasks-writer` or manual edit in the Kanban)
- Don't blow the scope without aligning

**If the Tech Design has a hole (uncovered decision) during implementation:**
- Stop and ask the user
- If the answer is non-trivial, suggest updating the Tech Design (with a Notion comment explaining) before continuing
- Don't decide silently

**If `typecheck`/`lint`/`test` fails:**
- Fix at the source
- Don't bypass the checklist with `--no-verify`
- If the failure indicates a Spec/Tech Design problem (e.g., impossible contract), go back to those documents before continuing

**If the user asks for multiple tasks in one invocation:**
- List the identified tasks
- Implement **only the first**
- Report and tell the user to invoke the Skill again for the next

## Non-duplication principle

All **architecture, pattern, and convention** rules live in the Constitution, `engineering.md`, and `docs/*.md`. All **feature behavior** rules live in the Spec and Tech Design. This Skill is the **runner** — it orchestrates reading those documents and executes the task. If you find yourself adding implementation rules here, stop and move them to the right place (`engineering.md` for high level, `docs/X.md` for specific, ADR for design decision).
