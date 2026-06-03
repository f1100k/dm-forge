# /.ai — Shared Agent Configuration

This folder is the **source of truth** for the technical configuration used by the project's AI agents (Claude Code, Cursor, and any others added in the future).

## Structure

```
.ai/
├── README.md                     ← this file
├── constitution.md               ← non-negotiable principles
├── engineering.md                ← stack, structure, standards (high-level)
├── mcp.json                      ← MCP server config (shared via symlink)
└── skills/
    ├── spec-writer.md            ← full content
    ├── design-handoff.md         ← full content
    ├── tech-design-writer.md     ← full content
    ├── tasks-writer.md           ← full content
    ├── spec-implementer.md       ← full content
    └── dependabot-sweep.md       ← full content (engineering/ops)

docs/
├── architecture-overview.md      ← bootstrap, BYOK, Tiptap, FTS, public wiki
├── coding-patterns.md            ← IDs, auto-save, optimistic, soft delete, snapshots
├── modular-principles.md         ← package boundaries, LLM via packages/ai
├── state-isolation.md            ← Zustand store, per-campaign scoping
├── resilience-observability.md   ← logs, errors, SSE, rate limits
├── implementation-checklist.md   ← pre-PR checklist
└── adr/                          ← Architecture Decision Records

.claude/skills/                   ← Claude Code thin adapters (point to .ai/skills/)
.cursor/rules/                    ← Cursor thin adapters + Constitution rule
.mcp.json                         ← symlink → .ai/mcp.json
.cursor/mcp.json                  ← symlink → ../.ai/mcp.json
```

Detail files in `docs/` are loaded **on demand** — only when the task touches their topic. The lookup table is in `engineering.md` ("When to dive deeper").

---

## Where each document lives

Two splits at once:

> **Artifact vs. process.** Specs, Tech Designs, Kanban cards, PRD, Research are *artifacts* that get reviewed and commented by the team — they live in **Notion**. The *process* of producing them (templates, checklists, gates) is technical configuration consumed by the agent — it lives in the **repo** (`.ai/skills/`).

> **Technical config vs. shared knowledge.** Constitution, engineering rules, ADRs, code, MCP config are technical truth that only devs and agents consult — they live in the **repo**. Anything PM, design, or stakeholders need to read or edit lives in **Notion**.

In practice the agent (skill) creates artifacts in Notion as the primary author; humans review and comment there. Process changes happen in the repo.

Application:

| Document | Lives in | Why |
|---|---|---|
| PRD | Notion | PM leads, stakeholders comment |
| Specs | Notion | PM, design, eng collaborate |
| Tech Designs | Notion | Mostly devs, but may involve discussion |
| Tasks (Kanban cards) | Notion | Execution tracking, visible to the team |
| **SDD process (Spec/Tech Design/Tasks creation)** | **`.ai/skills/`** | **Process lives in skills (full-content); Notion holds artifacts** |
| Research | Notion | PM, UX produce |
| **Constitution** | **`.ai/constitution.md`** | **Non-negotiable principles, devs and agents consult** |
| **Engineering rules** | **`.ai/engineering.md`** | **Stack, structure, standards — read alongside Constitution** |
| **Detail docs** | **`docs/*.md`** | **Loaded on demand when the task touches the topic** |
| ADRs | `docs/adr/` | Technical decisions tied to code |
| MCP config, Skills | `.ai/` | Agent technical configuration |
| README, code | repo | Obvious |

---

## Constitution and engineering rules

`constitution.md` defines the project's non-negotiable principles. `engineering.md` defines stack, structure, and standards — the operational layer that follows from the principles. Both are read together; every Spec, Tech Design, ADR, and implementation must respect them.

Detail docs in `docs/` carry deeper rules per topic and are loaded **only when the task touches them**, following the lookup table at the bottom of `engineering.md`.

**Reading guarantee:** agents read the Constitution on **every interaction** via:

- `.cursor/rules/constitution.mdc` with `alwaysApply: true` (Cursor)
- The Claude Code adapter that points to `.ai/constitution.md`

These adapters point to `.ai/constitution.md` — the source of truth. When the Constitution changes, both agents pick up the new version automatically.

---

## Notion configuration (contract)

**This section is the contract the skills consult.** If the Notion structure changes, update it here.

### Workspace and teamspace

- **Teamspace:** `DM Forge HQ`

### Databases

#### Docs
Main textual documentation database.

**Properties:**
- `Doc name` (title)
- `Category` (**multi_select**): `Product`, `Research`, `Spec`, `Tech Design`, `Playbook`
- `Status` (status): `Not started`, `In progress`, `In review`, `Done`
- `Owner` (person)

> **Verified against Notion (2026-05-02):** `Category` is `multi_select`, not `select` — filters and writes must use the multi-select API shape. `Tech Design` is now its own category value. `Status` values confirmed (`Done` is green).

**Canonical documents referenced by skills:**
- Project PRD → `Category` contains `Product`
- Specs → `Category` contains `Spec`, naming `Spec - [Feature]`
- Tech Designs → `Category` contains `Tech Design`, naming `Tech Design - [Feature]`

> **Process Playbooks deprecated.** Process for creating Specs, Tech Designs, and Tasks lives in the skills under `.ai/skills/`, not in Notion. Existing Notion Playbooks ("Como criar uma Spec", "Como criar um Tech Design") can be archived or kept as historical reference. Skills no longer fetch them.

**Naming convention:**
- Specs: `Spec - [Feature name]`
- Tech Designs: `Tech Design - [Feature name]`

#### Kanban
Tasks and execution. Skills create cards here derived from the "Plano de execução" of Tech Designs.

**Database ID:** `3510ea46-68e8-80a5-bcb3-c6c9fc054517`
**Data source ID:** `3510ea46-68e8-8055-a15f-000b5660109f`

**Properties:**
- `Task name` (title) — name of the task
- `Status` (status): `Not started`, `In progress`, `Review`, `Done`
  - Groups: `To-do` (`Not started`), `In progress` (`In progress`, `Review`), `Complete` (`Done`)
- `Description` (rich_text) — short summary; full body goes in the page content
- `Assignee` (people) — who owns it
- `Priority` (select): `High`, `Medium`, `Low`
- `Effort level` (select): `Small`, `Medium`, `Large`
- `Due date` (date)
- `Task type` (multi_select): `🐞 Bug`, `💬 Feature request`, `💅 Polish`, `ADR`
- `Attach file` (files)

> **Verified against Notion (2026-05-02).**
>
> Status differs from `Docs`: Kanban uses `Review` (not `In review`). When a skill moves a card to "in review", use `Review`.
>
> Cards created by `tasks-writer` from Tech Design execution plans default to: `Status = Not started`, `Task type = 💬 Feature request`. `Priority`, `Effort level`, `Due date`, `Assignee` left blank for the user to fill (or filled if the user provides).

#### Meetings
Meeting notes. Skills usually only read, don't create.

### Linkage between documents

Currently: **paste the Notion page link in the body of the target page**, in the appropriate template section.

Accepted link formats (both work):
- `https://app.notion.com/p/[id]?...`
- Short link via "Copy link"

> **Future improvement:** add a Relation property in the `Docs` database for structured and bidirectional relationships. Update this contract when implemented.

---

## Adapter principle

The adapters in `.claude/skills/` and `.cursor/rules/` are **thin**:

1. Frontmatter in the format each tool requires
2. A single line pointing to `.ai/skills/[skill].md` or `.ai/constitution.md`

**Identical description** across both adapters. **No extra content** — if any appears, move it to `.ai/`.

## Skill model

All skills are **full content**: process, template, checklist, antipatterns, and error handling live inside each skill file in `.ai/skills/`. There is no Notion Playbook to fetch — to change a process, edit the skill file (the adapter for Cursor reads the same source automatically).

Skills consume the **artifacts** stored in Notion (PRD, Specs, Tech Designs, Kanban cards), but the **process** lives in the repo.

## Available skills

| Skill | When to use |
|---|---|
| `spec-writer` | Create a feature Spec (no prerequisite) |
| `design-handoff` | Run the structured handoff to `claude.ai/design` for a `UI: yes` Spec, after it's `Done` (fills `design_url` in section 3.5) |
| `tech-design-writer` | Create a Tech Design (requires Spec `Done`) |
| `tasks-writer` | Break a Tech Design's Execution Plan into Kanban cards (requires Tech Design `Done`) |
| `spec-implementer` | Implement a single Kanban card end-to-end (one task per invocation) |
| `dependabot-sweep` | Resolve **all** open Dependabot PRs at once — consolidate into one tested branch, open a single PR, close the originals (engineering/ops; not part of the SDD pipeline) |

## SDD workflow

```
PRD (Notion)
  │
  ▼  spec-writer
Spec (Notion)              gate: Status = Done
  │
  ▼  tech-design-writer
Tech Design (Notion)       gate: Status = Done
  │
  ▼  tasks-writer
Kanban cards (Notion)      gate: card ready for implementation
  │
  ▼  spec-implementer (one card per invocation)
Code + PR
```

## Resources available to agents

- **Notion MCP** — read/create pages in `Docs`, move `Kanban` cards, retrieve database schemas
- **Mermaid (diagrams-as-code)** — diagrams (flow, architecture, sequence, state) authored as `mermaid` code blocks in the Notion artifact; Notion renders them natively, so no MCP/server is needed (see ADR 0006)
- **context7 MCP** — current library/framework docs (preferred over web search for SDK/API references)
- **GitHub MCP** — create/comment on PRs and issues, read files via API. Code push still via `git` + SSH (the MCP does not replace `git push`).
- **Filesystem** — code, ADRs in `docs/adr/`, Constitution in `.ai/constitution.md`, Engineering rules in `.ai/engineering.md`, detail docs in `docs/*.md`

> **GitHub MCP setup** — server: `@modelcontextprotocol/server-github`. Auth: `GITHUB_PERSONAL_ACCESS_TOKEN` in `.env` (fine-grained PAT, scoped to `f1100k/dm-forge`, with at minimum `Pull requests: read/write`, `Contents: read`, `Issues: read/write`, `Metadata: read`).

## Principles

- **Constitution above all** — any document or code that contradicts the Constitution is wrong
- **Notion = artifacts** (PRD, Specs, Tech Designs, Kanban cards); **repo = process and rules** (skills, Constitution, engineering rules, ADRs)
- Skills must **gather context before acting**: Constitution, `engineering.md`, the contract in this README, PRD, related Spec/Tech Design, existing ADRs
- Skills must **ask when critical information is missing** — never invent
- Skills must **stop and surface** any conflict with the Constitution, `engineering.md`, or existing ADRs — never proceed silently against a higher source of truth (see hierarchy in `constitution.md`)