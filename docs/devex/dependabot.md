# Dependabot

Load this when triaging, reviewing, or merging Dependabot PRs — or when enabling/disabling Dependabot features in the repository.

## What it is

Dependabot monitors project dependencies and opens PRs automatically when updates are available. Two channels operate independently:

1. **Version updates** — configured in `.github/dependabot.yml`. Runs weekly (Monday 08:00 UTC) for both `npm` and `github-actions` ecosystems. Patches and minors are grouped into a single PR; majors open separately.
2. **Security updates** — enabled at the repository level (Settings → Code security → Dependabot alerts + Dependabot security updates). When GitHub detects a published CVE affecting a project dependency, a PR is opened immediately (not waiting for the weekly schedule).

Both channels produce PRs against `master` with labels `dependencies` and `automated`. Security PRs additionally receive the `security` label from GitHub. Major bumps receive the `major-bump` label via the `dependabot-labeler` workflow.

## PR structure

| Type | Grouping | Labels | Review urgency |
|---|---|---|---|
| Patch/minor (npm) | Grouped into one PR per run | `dependencies`, `automated` | Normal |
| Patch/minor (github-actions) | Grouped into one PR per run | `dependencies`, `automated` | Normal |
| Major (npm or actions) | One PR per dependency | `dependencies`, `automated`, `major-bump` | High — breaking changes possible |
| Security (any) | One PR per advisory | `dependencies`, `automated`, `security` | Urgent — CVE active |

## Review checklist

For **every** Dependabot PR, verify:

1. **CI passes** — `typecheck`, `lint`, and `test` jobs are green. If a job fails, the bump likely introduces a breaking change or type incompatibility; investigate before merging.
2. **Changelog scan** — open the linked release notes (Dependabot includes the URL). Look for breaking changes, deprecations, or behavior shifts that affect the project.
3. **Lock file only** — confirm the PR touches only `pnpm-lock.yaml` and relevant `package.json` entries. Unexpected file changes suggest a postinstall script or peer dependency resolution issue.

Additional checks for **major bumps** (`major-bump` label):

4. **Migration guide** — read the library's migration guide. Check whether the project uses any deprecated or removed API.
5. **Local validation** — pull the branch, run `pnpm install && pnpm typecheck && pnpm test`. Exercise the affected area manually if the dependency is runtime-critical (e.g., React, Hono, Prisma, Vite).
6. **Scope impact** — if the major touches a `catalog:` dependency in `pnpm-workspace.yaml`, confirm all workspaces still build.

Additional checks for **security PRs** (`security` label):

7. **Advisory severity** — check the GHSA link. Critical/High should be merged the same day if CI is green.
8. **Exploitability** — assess whether the vulnerable code path is reachable in this project. Even if not immediately exploitable, merge promptly to avoid accumulating known vulnerabilities.

## Auto-merge policy

**Do not enable GitHub's auto-merge for Dependabot PRs.** Every PR requires a human reviewer to check CI status and changelog. The review can be lightweight for patches (a quick CI-green confirmation), but must happen.

Rationale: grouped PRs can bundle a dependency that introduces subtle runtime bugs not caught by tests. The cost of a 2-minute check is lower than the cost of a broken deploy.

## When to revert

Revert a merged Dependabot PR when:

- A bug surfaces in production or staging that traces to the bump.
- A transitive dependency introduced by the bump triggers a security alert worse than the original.
- Type errors or test failures appear in subsequent PRs that weren't caught by the Dependabot PR's CI run (e.g., due to caching or partial coverage).

To revert: `git revert <merge-commit>`, push, and re-open the Dependabot PR (or close it and wait for a fix release). Add a brief comment on the PR explaining why it was reverted so the next attempt has context.

## Enabling Dependabot (setup reference)

Both features are toggled in the GitHub UI:

1. Navigate to **Settings → Code security and analysis**.
2. Enable **Dependabot alerts** — this activates vulnerability scanning against the GitHub Advisory Database.
3. Enable **Dependabot security updates** — this allows Dependabot to open PRs automatically when a fix is available for an active alert.

These settings require repository admin access. The toggles are independent of `.github/dependabot.yml` (which controls version updates only).

## Noise management

If Dependabot PRs become noisy:

- **Close stale PRs** — if a grouped PR has been open for more than 2 weeks without review, close it. The next weekly run will open a fresh one with cumulative updates.
- **Adjust the schedule** — edit `.github/dependabot.yml` to change from `weekly` to `monthly` if the team cannot keep up.
- **Ignore a dependency** — add an `ignore` block in `dependabot.yml` for dependencies that are intentionally pinned or that produce frequent no-op bumps.
- **Do not suppress security PRs** — these should always remain enabled regardless of noise tolerance.

## References

- Configuration: `.github/dependabot.yml`.
- Labeler workflow: `.github/workflows/dependabot-labeler.yml`.
- Branch protection (where CI checks gate merge): `docs/devex/branch-protection.md`.
- Spec SC-003: CVE → PR ≤ 24h (guaranteed by Dependabot's real-time advisory monitoring).
- Spec FR-008/FR-009/FR-010: functional requirements for version and security updates.
- Tech Design: *Tech Design - Reforço do fluxo de engenharia (DevEx)* (Notion), Track C.
- Spec: *Spec - Reforço do fluxo de engenharia (DevEx)* (Notion).
