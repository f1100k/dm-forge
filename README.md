# dm-forge

SaaS for tabletop RPG dungeon masters with AI assistance via BYOK.

## Quick start

```bash
# 1. Install deps (also runs `prisma generate`).
pnpm install

# 2. Copy env and fill required values.
cp .env.example .env
#   - Generate BETTER_AUTH_SECRET: `openssl rand -base64 48`
#   - Generate ENCRYPTION_KEY:     `openssl rand -base64 32`

# 3. Start Postgres and apply migrations.
docker compose up -d postgres
pnpm db:migrate dev --name init

# 4. Run web + api in parallel.
pnpm dev
```

`apps/web` → http://localhost:5173
`apps/api` → http://localhost:3000 (`/health`, `/trpc/*`, `/api/auth/*`)

## Layout

```
apps/web        # Vite + React + TanStack Router + tRPC client
apps/api        # Hono + tRPC + Better Auth
packages/db     # Prisma schema, client, seed
packages/ai     # Vercel AI SDK + OpenRouter, BYOK encryption
packages/shared # Zod contracts shared by web and api
packages/srd    # Versioned SRDs (placeholder)
```

Detailed dependency graph and rationale: `.ai/engineering.md` and `docs/modular-principles.md`.

## Scripts

```bash
pnpm dev            # web + api in parallel
pnpm typecheck
pnpm lint
pnpm format         # writes
pnpm format:check
pnpm test
pnpm db:migrate dev --name <name>
pnpm db:studio
pnpm db:seed
pnpm db:reset       # CAREFUL — dev only
```

## Where to look

- **`.ai/constitution.md`** — non-negotiable principles. Read first.
- **`.ai/engineering.md`** — stack, structure, standards.
- **`docs/`** — deeper rules per topic (loaded on demand by agents).
- **`docs/adr/`** — architectural decisions.
- **`CLAUDE.md`** — agent entry point.
