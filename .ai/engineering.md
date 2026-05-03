# Engineering

High-level stack, structure, and standards for dm-forge. Read together with `constitution.md`. For deeper rules on specific topics, load the file from `docs/` indicated in the table at the bottom.

## Stack

| Area | Choice |
|---|---|
| Database | PostgreSQL |
| ORM | Prisma + zod-prisma-types |
| Auth | Better Auth |
| Backend | Hono + TypeScript |
| API | tRPC (app) + REST (`/public/*`) |
| Validation | Zod |
| Frontend | Vite + React 18 + TanStack Router |
| State | Zustand + TanStack Query |
| Editor | Tiptap |
| UI | shadcn/ui + Tailwind |
| LLM | Vercel AI SDK + `@openrouter/ai-sdk-provider` |
| Streaming | SSE |
| IDs | cuid2 (client-generated) |
| Monorepo | pnpm workspaces + Turborepo |
| Lint/Format | Biome |
| Tests | Vitest |

Stack changes require an ADR.

## Repository structure

```
dm-forge/
├── apps/
│   ├── web/         # Vite + React frontend
│   └── api/         # Hono + tRPC backend
├── packages/
│   ├── db/          # Prisma schema, client, migrations, seed
│   ├── shared/      # Zod schemas, types, constants
│   ├── ai/          # AI SDK setup, prompt builders, BYOK
│   └── srd/         # Versioned SRDs (dnd5e, pf2e, ...)
├── docs/            # Detailed rules, ADRs
└── .ai/             # Constitution, engineering, skills, MCP config
```

## Allowed dependencies

```
apps/web    → packages/shared
apps/api    → packages/db, packages/shared, packages/ai
packages/ai → packages/shared, packages/db
packages/db, packages/srd  (leaves)
```

`apps/web` MUST NOT import from `packages/db` or `packages/ai`. Cross-package types reach the frontend through tRPC, never by direct import. Detailed rationale and exceptions: `docs/modular-principles.md`.

## Standards

- **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`). No `any`. Use `unknown` and narrow when needed. `as` only at boundaries (parsing, third-party). `@ts-expect-error` requires a comment explaining why.
- **ESM only** (`"type": "module"`).
- **File names**: `kebab-case.ts`. React components and their files: `PascalCase.tsx`.
- **Type names**: `PascalCase`, no `I` prefix. Hooks prefixed `use`. Zod schemas suffixed `Schema`.
- **No default exports** in internal code.
- **Language**: everything in the codebase in English — identifiers, comments, internal logs, and user-facing strings (error messages returned via tRPC/REST, UI copy).
- **Tests**: Vitest, organized as a pyramid (unit colocated under `src/`, integration under `tests/integration/` per app/package). `describe`/`it` descriptions in English. **Tests for new behavior ship in the same PR — not optional.** Each PR adds at least unit/integration coverage for the new behavior. No E2E in MVP. Full strategy and harnesses in `docs/testing.md`.
- **Lint/format**: Biome. CI gates on `pnpm lint` and `pnpm typecheck`.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/). Format: `type(scope): description`.
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - `scope` is optional but encouraged — usually the package or area (`api`, `web`, `db`, `ai`, `srd`, `shared`, or a feature folder).
  - Description in imperative mood, lowercase, no trailing period (`add bootstrap endpoint`, not `Added bootstrap endpoint.`).
  - Breaking change: `feat(api)!: ...` or `BREAKING CHANGE: ...` in the footer.
  - Body (optional): blank line after subject, wrapped at ~72 chars, explains *why* not *what*.
  - PR titles follow the same convention (the merge commit inherits it).

## Documentation language

- **All repo files in English** — constitution, engineering, README, `docs/*.md`, `.ai/skills/*.md`, ADRs, adapters in `.claude/` and `.cursor/`. One language for everything written for devs and agents.
- **All codebase content in English** — identifiers, code comments, test descriptions, internal logs, and user-facing runtime strings (error messages returned via tRPC/REST, UI copy). The product targets Portuguese-speaking GMs, but UI copy translation is handled separately (i18n layer when introduced); source strings stay English.
- **Notion artifacts** (Specs, Tech Designs, Kanban cards) stay in PT-BR — default and confirmed team preference. Codebase language and Notion language are independent.

When in doubt, copy the language of the closest sibling file.

## Common commands

```bash
pnpm install
pnpm dev                       # web + api in parallel
pnpm dev --filter=web|api
pnpm typecheck
pnpm lint
pnpm format                    # Biome --write
pnpm test
pnpm test --filter=api
pnpm db:migrate dev --name <name>
pnpm db:studio
pnpm db:seed
pnpm db:reset                  # CAREFUL — dev only
pnpm db:seed:srd dnd5e
```

## When to dive deeper

Load these only when the task touches their topic.

| Working on… | Load |
|---|---|
| Bootstrap, data flow, BYOK encryption, Tiptap canonical format, FTS for SRD, public wiki | `docs/architecture-overview.md` |
| Client IDs, auto-save with partial PATCH, optimistic mutations, soft delete, snapshots, beats inside Tiptap | `docs/coding-patterns.md` |
| Boundaries between packages, LLM access via `packages/ai` only, when to lift code into `packages/shared` | `docs/modular-principles.md` |
| Local store shape, per-campaign isolation, `EntityState`, snapshot semantics | `docs/state-isolation.md` |
| Logging policy, error contracts, SSE cancellation, rate limits, retries | `docs/resilience-observability.md` |
| Test pyramid layout, Testcontainers harness, MSW patterns, what to mock | `docs/testing.md` |
| Writing a good test — E.B.C.D. flow, mock discipline, AAA, anti-patterns | `docs/test-practices.md` |
| Before opening a PR | `docs/implementation-checklist.md` |
