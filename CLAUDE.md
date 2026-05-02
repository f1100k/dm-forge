# dm-forge — Claude Code instructions

This file is read by Claude Code at the start of every conversation in this repository. It exists to guarantee the agent reads the project's principles and engineering rules before acting.

## Always read first

- **`.ai/constitution.md`** — non-negotiable principles. Every Spec, Tech Design, ADR, and line of code must respect them.
- **`.ai/engineering.md`** — stack, structure, standards, and the lookup table for deeper docs.

If anything you're about to do conflicts with either, **stop and surface the conflict** — never proceed silently against a higher source of truth.

## Detail docs (load on demand)

`docs/*.md` carry deeper rules per topic. Load them only when the task touches their subject. The lookup table is at the bottom of `.ai/engineering.md` ("When to dive deeper").

## Workflow

This project follows Spec-Driven Development. The pipeline is:

```
PRD → spec-writer → Spec → tech-design-writer → Tech Design → tasks-writer → Kanban → spec-implementer → Code + PR
```

For non-trivial work, use the corresponding skill. Skills live in `.ai/skills/` (full content) and are exposed as Claude Code skills via `.claude/skills/*/SKILL.md` adapters.

Trivial fixes (typos, dep bumps, config tweaks) skip SDD — implement directly.

## Configuration root

Everything about how AI agents (Claude Code, Cursor) operate in this project is configured in `.ai/`:

- `.ai/README.md` — Notion contract, skill model, adapters
- `.ai/constitution.md` — principles
- `.ai/engineering.md` — stack and standards
- `.ai/skills/` — full-content skills
- `.ai/mcp.json` — MCP server config (Notion, tldraw, context7)

When changing how the agent works, edit `.ai/`. The `.claude/` and `.cursor/` folders contain only thin adapters that point back to `.ai/`.

## Source of truth hierarchy

Defined in `.ai/constitution.md`. In short: Constitution > Engineering rules > ADRs > Tech Design > Spec > existing code. Higher items constrain lower ones.
