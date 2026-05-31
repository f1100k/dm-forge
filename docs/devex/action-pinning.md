# GitHub Actions pinning

Load this when adding a new workflow, reviewing a `uses:` reference, or bumping a
pinned action. Every GitHub Action in this repo is pinned to an immutable commit
SHA — never a mutable tag.

## Why SHA, not `@v1`

A tag like `@v1` or `@v6.2` is a mutable pointer. The action's author (or anyone
who compromises their account) can repoint that tag at new code without changing
the reference in our workflow. Pinning to a 40-character commit SHA removes that
trust: the bytes the runner executes are fixed until *we* deliberately move the
pin. This closes the supply-chain vector called out in the DevEx Tech Design §8
and is the only acceptable form for a `uses:` reference here.

## The convention

```yaml
uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
```

- **Left of `@`:** the action (sub-path actions such as `actions/cache/restore`
  pin to the parent repo's SHA).
- **`@<sha>`:** the full 40-char commit SHA the tag resolved to. Short SHAs are
  not allowed — they are ambiguous and Dependabot will not update them.
- **`# vX` comment:** the human-readable version the SHA corresponds to. Keep it
  in sync with the SHA. Dependabot reads and rewrites this comment when it bumps
  the pin, so the comment must stay a plain `# vMAJOR[.MINOR[.PATCH]]`.

## Resolving a tag to its SHA

```bash
git ls-remote https://github.com/<owner>/<repo> <tag> '<tag>^{}'
```

Use the dereferenced (`^{}`) line when present — that is the commit SHA an
annotated tag points at. Take the plain tag line otherwise.

## How bumps happen

Pinning does **not** freeze us on an old version. Dependabot watches the
`github-actions` ecosystem (`.github/dependabot.yml`) and opens PRs that advance
both the SHA and the `# vX` comment, grouped patch/minor and one-per-major, on
the same weekly cadence as npm. Review them like any other Dependabot PR — see
`docs/devex/dependabot.md`.

A **manual** bump is a conscious act, never a drive-by edit:

1. Resolve the new tag to its SHA with the command above.
2. Replace the SHA **and** the `# vX` comment together.
3. Read the release notes for the span you are crossing (a tag can hide breaking
   changes behind a major).
4. Let the `actions-pinning` check and the rest of the security suite run on the
   PR before merging.

## CI enforcement

The `actions-pinning` job in `.github/workflows/security.yml` greps every
workflow for a mutable tag reference (`uses: … @vN`) and fails the build if it
finds one. A green check means all references are SHA-pinned. To make it a hard
merge gate, list it under required status checks in
`docs/devex/branch-protection.md`.

## New workflows — reviewer rule

When reviewing a PR that adds or edits a workflow, require every new `uses:` to
be SHA-pinned with the `# vX` comment. The `actions-pinning` check enforces this
mechanically, but call it out in review so the convention stays visible.

## References

- Tech Design: *Tech Design - Reforço do fluxo de engenharia (DevEx)* (Notion), §8 (supply-chain risk), Execution Plan item P4.
- Spec: *Spec - Reforço do fluxo de engenharia (DevEx)* (Notion), SC-002, SC-005.
- Dependabot triage: `docs/devex/dependabot.md`.
- Merge gate / required checks: `docs/devex/branch-protection.md`.
