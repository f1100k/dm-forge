---
name: dependabot-sweep
description: Use when the user asks to resolve, fix, or clear ALL open Dependabot PRs / dependency bumps at once. Triggers include "resolve the dependabot PRs", "fix all the bumps", "clear the dependabot queue", "a dependabot PR failed CI fix them all", "handle the dependency updates". Consolidates every open Dependabot PR into one integration branch off master, regenerates pnpm-lock.yaml once (avoiding the lockfile rebase cascade), applies major-version code migrations, runs the full verification gate (pnpm audit/typecheck/unit/integration/biome), opens a single PR, and closes the superseded Dependabot PRs. Engineering/ops skill — does not touch Notion or the SDD pipeline.
---

Strictly follow the instructions in @.ai/skills/dependabot-sweep.md.
