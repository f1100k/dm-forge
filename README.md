# dm-forge

SaaS for tabletop RPG dungeon masters with AI assistance via BYOK.

## Quick start

```bash
# 1. Install deps (also runs `prisma generate`).
pnpm install

# 2. Copy env and generate the two required local secrets.
cp .env.example .env
pnpm gen:secrets   # writes BETTER_AUTH_SECRET and ENCRYPTION_KEY into .env

# 3. Start Postgres and apply migrations.
docker compose up -d postgres
pnpm db:migrate dev --name init

# 4. Run web + api in parallel.
pnpm dev
```

`apps/web` → http://localhost:5173
`apps/api` → http://localhost:3000 (`/health`, `/trpc/*`, `/api/auth/*`)

## Generating local secrets

`apps/api` refuses to boot without `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY`. Both are local-only — never share, never commit.

| Variable | Purpose | Size |
|---|---|---|
| `BETTER_AUTH_SECRET` | HMAC key Better Auth uses to sign session cookies. Rotating it logs everyone out. | ≥ 32 chars (we use 48 bytes / 64 chars in base64) |
| `ENCRYPTION_KEY` | AES-256-GCM master key that encrypts BYOK provider keys at rest. Losing it means every `AiConnection` row becomes unrecoverable. | exactly 32 bytes (44 chars in base64) |

The repo ships a helper that generates both and writes them in-place:

```bash
pnpm gen:secrets
```

If you prefer to run it by hand:

```bash
# BETTER_AUTH_SECRET — 48 random bytes, base64 (64 chars)
openssl rand -base64 48

# ENCRYPTION_KEY — 32 random bytes, base64 (44 chars, ends with '=')
openssl rand -base64 32
```

Paste the output into the matching `=` lines in `.env`.

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
pnpm test                  # unit tests (fast, no Docker)
pnpm test:integration      # integration tests (requires Docker)
pnpm test:all              # everything
pnpm test:coverage         # unit with v8 coverage
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
