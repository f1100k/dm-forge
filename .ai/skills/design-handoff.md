# Skill: Design handoff

This Skill is **full-content**: it carries the entire process for the structured handoff to `claude.ai/design`. To change the process, edit this file (the Cursor adapter picks it up automatically).

## When to use

Use when the user asks to:
- Run the design handoff for a finalized Spec
- Attach a design to a Spec with UI
- "Run `/design-handoff`", "do the design step", "get the mockups for spec X"

Invoke it **after** the `spec-writer` flow ends with a Spec marked `UI: yes` — `spec-writer` recommends it explicitly in its step 8.5 (`Run /design-handoff before moving on to tech-design-writer`).

**Don't use when:**
- The Spec is backend/headless (`UI: no`) — there is no design step (FR-013). Stop and tell the user.
- The Spec isn't `Done` yet — finish `spec-writer` first.
- The user wants to write or implement code (use `spec-implementer`), or design the architecture (use `tech-design-writer`).

## What this skill does

A finalized Spec with UI carries a `## 3.5 Design` section seeded by `spec-writer` with `design_url: [NEEDS DESIGN: link pending]`. This skill closes that gap in three passes:

1. **Build** a copy-paste-ready handoff prompt from the Spec's UI-relevant user stories (Step 2).
2. **Pause** so the author runs the prompt in `claude.ai/design` and returns the shareable URL (Step 3).
3. **Validate** the returned URL against the canonical pattern and **absorb** it into `design_url` in section 3.5 — or record `[NEEDS DESIGN: …]` markers when the author defers (Step 4).

**Canonical channel: `claude.ai/design` only. No fallback** — no Figma, Excalidraw, or similar. If the author can't use it now, they register a `[NEEDS DESIGN: …]` marker and proceed; the downstream gate (`tech-design-writer` / `tasks-writer`) collects on it.

This skill **does not improvise**. It writes only into section 3.5 of the Spec. It does not edit the Spec's behavior, other sections, or any code.

## Contract

### Notion
- The Spec lives in the `Docs` database (contract in `.ai/README.md`). `Category` contains `Spec`, named `Spec - [Feature]`.
- The UI flag is the `**UI:** yes | no` line near the top of the Spec body — the single source of truth set by `spec-writer` step 2.5.3 (not a Notion property).
- Section `## 3.5 Design` is rendered only when `UI: yes`. Its shape (seeded by `spec-writer`):
  - `**Canonical channel:** claude.ai/design (no fallback)`
  - `**design_url:** [NEEDS DESIGN: link pending]` ← this skill replaces the value here
  - `### Scope` — Platforms / Flows / States
  - `### Known gaps` — pending design decisions
  - `### Active markers` — all `[NEEDS DESIGN: …]` markers (max 3)

### Repo
- Sibling skills: `.ai/skills/spec-writer.md` (defines the §3.5 contract this skill consumes), `tech-design-writer.md` and `tasks-writer.md` (the downstream gate).
- Principles: `.ai/constitution.md`, `.ai/engineering.md`.

### The `design_url` field
- **Field name (canonical):** `design_url`, stored as the value of the `**design_url:**` label line in section 3.5. Do not invent a Notion property.
- **Valid value:** a URL matching `^https://claude\.ai/design/.+`.
- **Placeholder:** `[NEEDS DESIGN: link pending]` (the seeded value, meaning "not yet filled").

### The `[NEEDS DESIGN]` marker
- **Syntax:** `[NEEDS DESIGN: <short question, ≤80 chars>]` — sibling of `[NEEDS CLARIFICATION]`, **independent budget of max 3** (a Spec can carry up to 3 + 3).
- **Lives in:** section 3.5 → `Active markers` (aggregated). Never in section 4 (that's `[NEEDS CLARIFICATION]`).
- **Created by:** `spec-writer` (author flags a gap up front) and/or this skill (author chooses to register a gap instead of delivering a `design_url`).
- **Resolved by:** this skill removes a marker when `design_url` is filled **and** the gap it described is covered by the delivered design.

## Execution flow

### 1. Read the Spec and verify prerequisites

Identify the target Spec (ID, title, or Notion link; if ambiguous, list candidates and ask). Read it in full via Notion MCP, then verify **all** prerequisites before doing anything else:

- **(a)** The Spec exists in Notion (`Docs`, `Category` contains `Spec`).
- **(b)** `UI: yes` in the Spec body. If `UI: no` → **stop**: there is no design step for headless Specs (FR-013).
- **(c)** Section `## 3.5 Design` is present. If missing → **stop and tell the user** the Spec wasn't seeded by an up-to-date `spec-writer`; suggest re-running it or adding §3.5 manually. Don't fabricate the section here.
- **(d)** `design_url` is still the placeholder (`[NEEDS DESIGN: link pending]`) **OR** the author explicitly asked to re-run. If `design_url` already holds a valid URL and no re-run was requested → tell the user it's already filled and ask whether to replace it (idempotent re-run) before proceeding.

If a prerequisite fails, stop with a clear message — don't paper over it.

### 2. Pass 1 — Build the handoff prompt

From the Spec's section 3 (User Stories), keep only the **UI-relevant** stories: a story is UI-relevant if its text hits any UI token (same vocabulary as `spec-writer` step 2.5.1):

> `screen`/`tela`, `view`, `form`/`formulário`, `button`/`botão`, `modal`, `drawer`, `flow`/`fluxo`, `wizard`, `dashboard`, `landing`, `onboarding`, `page`/`página`, `listing`/`listagem`, `table`, `dropdown`, `tooltip`, `menu`, `navbar`, `sidebar`, `card`, `toast`.

Emit the copy-paste-ready block below. Fill placeholders from the Spec; where a value is absent, use the inline default shown (`|` separates the field from its default):

```
[HANDOFF → claude.ai/design]

Project: {{spec.title}}
Problem: {{spec.problem_one_liner}}

UI user stories:
{{#each ui_stories}}
  - As {{as_a}}, I want {{want}}, so that {{so_that}}.
{{/each}}

Critical flows: {{critical_flows | "[NEEDS DESIGN: enumerate critical flows]"}}

Constraints:
  - Brand/design system: {{constraints.brand | "—"}}
  - Platform(s): {{constraints.platform | "—"}}
  - Accessibility: {{constraints.a11y | "WCAG AA"}}

States to cover per screen:
  empty, loading, success, error, edge cases ({{listed or "[NEEDS DESIGN]"}})

Deliver:
  - Navigable prototype covering all critical flows
  - Org-scoped shareable link (view or comment access)
```

If there are **no** UI-relevant stories despite `UI: yes`, that's a contradiction in the Spec — stop and tell the user; the UI flag or the stories need fixing in `spec-writer`, not here.

### 3. Pass 2 — Pause and instruct the author

Present the block from Step 2 and these instructions, then **stop and wait** for the author:

> Paste the block above into `https://claude.ai/design` (a new project, or the product's existing design project). When the design is ready, return **only** the shareable URL — it must match `^https://claude\.ai/design/.+`.
>
> ⚠ This skill accepts `claude.ai/design` URLs only. No fallback (no Figma, Excalidraw, or similar). If you can't use `claude.ai/design` right now, reply with a short reason and I'll register a `[NEEDS DESIGN: <reason>]` marker and proceed — the downstream gate will collect on it.

### 4. Pass 3 — Validate the URL and absorb it into the Spec

When the author responds:

- **A valid URL** (matches `^https://claude\.ai/design/.+`): write it as the value of the `**design_url:**` line in section 3.5 via Notion MCP, replacing the placeholder. Then update section 3.5:
  - **Known gaps / Scope:** if the author named the flows/states/platforms covered, reflect them; otherwise leave as-is.
  - **Active markers:** remove every `[NEEDS DESIGN: …]` marker whose gap the delivered design now covers (a marker is resolved only when `design_url` is filled **and** its question is answered by the design). Leave markers that remain genuinely open.
- **An invalid URL** (doesn't match): reject it, explain the required pattern, and repeat Step 3. Do not write anything.
- **No URL + a reason:** register `[NEEDS DESIGN: <reason>]` in section 3.5 → `Active markers` (it counts toward the cap of 3). Leave `design_url` at its placeholder. Do not exceed 3 markers — if the cap is already reached, tell the user and ask which to drop.

**Notion write mapping** (see the operational note in `spec-writer.md`): the MCP accepts more block types than its schema advertises. Update the `**design_url:**` paragraph keeping its bold label; use `bulleted_list_item` for marker lists. Don't replace heading blocks or reflow the whole section — touch only the `design_url` value and the marker/gap lists.

**Idempotency:** re-running is safe. When the author delivers a new link, replace `design_url`; the previous value's history is preserved by Notion's edit history / comments.

### 5. Hand off to the user

Report in up to 5 lines:
- Spec (Notion link) and its `UI: yes` status
- Outcome: `design_url` filled (paste the URL) **or** N `[NEEDS DESIGN]` markers registered (list them)
- Remaining open markers, if any
- Output contract met? (`design_url` valid **or** markers recorded with a reason in `Known gaps`)
- Next step: run `tech-design-writer` — it aborts if `UI: yes` and `design_url` is still empty or a `[NEEDS DESIGN]` marker is unresolved

## Smoke tests

This skill is a process artifact (Markdown), so its acceptance is validated by manual smoke tests, not Vitest:

- **Positive:** invoke `/design-handoff` on a Spec with `UI: yes` → the prompt is generated from the UI-relevant stories (Step 2), the skill pauses (Step 3), a valid `claude.ai/design` URL is accepted, and `design_url` in section 3.5 is filled (Step 4).
- **Negative:** provide a URL outside `^https://claude\.ai/design/.+` → the skill rejects it and asks for a new URL (Step 4), writing nothing.

## Antipatterns

- ❌ **Accepting a non-`claude.ai/design` link** — canonical channel only, no fallback.
- ❌ **Running on a `UI: no` Spec** — there is no design step for headless features (FR-013).
- ❌ **Fabricating section 3.5** — if it's missing, the Spec wasn't seeded correctly; fix it in `spec-writer`, don't invent it here.
- ❌ **Editing anything beyond section 3.5** — this skill only fills `design_url` and reconciles markers/gaps.
- ❌ **More than 3 `[NEEDS DESIGN]` markers** — independent budget of 3; ask which to drop instead of overflowing.
- ❌ **Putting `[NEEDS DESIGN]` in section 4** — that's `[NEEDS CLARIFICATION]`'s home; design markers live in 3.5 → Active markers.
- ❌ **Looping forever on a missing design** — let the author register a marker and proceed; the downstream gate collects on it.

## On error

**If `UI: no`:** stop — no design step (FR-013). Tell the user.

**If section 3.5 is missing on a `UI: yes` Spec:** stop and tell the user the Spec wasn't seeded by an up-to-date `spec-writer`; suggest re-running it. Don't fabricate the section.

**If the author keeps returning invalid URLs:** after a couple of rejections, offer the marker path (`[NEEDS DESIGN: <reason>]`) so they aren't blocked.

**If `design_url` is already filled and no re-run was requested:** report it and ask whether to replace before writing.

**If the `.ai/README.md` contract diverges from Notion's actual state:** stop and warn the user; ask to update the contract before proceeding.

## Available resources

- **Notion MCP** — read the Spec; update section 3.5 (`design_url`, markers, gaps)
- **Filesystem** — `.ai/constitution.md`, `.ai/engineering.md`, sibling skills in `.ai/skills/`
- **context7 MCP** — not typically needed (this is a process handoff, not an API integration)
