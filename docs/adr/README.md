# Architecture Decision Records (ADRs)

This folder records architectural decisions that constrain the project. ADRs are short, immutable, and append-only.

## When to write an ADR

Write an ADR when a decision:

- Will likely outlast the feature that triggered it.
- Restricts what future code/Specs/Tech Designs can propose.
- Reverses or supersedes a previous ADR.
- Adds, removes, or changes a stack dependency (per `engineering.md`).
- Touches the Constitution (any change to `.ai/constitution.md` requires an ADR explaining the why).

Don't write an ADR for:

- Implementation details fully described in a single Tech Design.
- Coding style or formatting (lives in `engineering.md` / Biome config).
- Reversible choices (a feature flag that can flip in a sprint).

If unsure: a Tech Design captures *how this feature works*; an ADR captures *why this rule exists project-wide*.

## File naming

```
docs/adr/NNNN-kebab-case-title.md
```

`NNNN` is a zero-padded sequence (`0001`, `0002`, ...). Numbers are never reused, even after supersession.

## Status flow

```
proposed → accepted ─┬─► (lives forever)
                     └─► superseded by NNNN
```

- **proposed** — drafted, under review (PR open)
- **accepted** — merged. Constraints are now in force.
- **superseded** — a newer ADR overrides. The superseded ADR stays in the repo with a link forward.

ADRs are **never deleted** and **never edited after acceptance** except to mark them superseded. To change a decision, write a new ADR that supersedes the old one.

## Template

Copy this when starting a new ADR:

````markdown
# NNNN. Title

**Status:** proposed | accepted | superseded by [link]
**Date:** YYYY-MM-DD
**Deciders:** [names]
**Supersedes:** [link to ADR being replaced, if any]

## Context

What's the situation? Why are we deciding now? What forces (technical, organizational, regulatory) push this decision?

## Decision

What did we decide? State it as a rule, not a discussion.

## Consequences

- **Positive:** what becomes easier or possible.
- **Negative:** what we give up or take on.
- **Neutral:** new constraints or invariants we now live with.

## Alternatives considered

Brief list of options evaluated and why they were rejected. Each alternative gets one paragraph max.

## References

- Constitution principle(s) affected: [list]
- Tech Design / Spec that triggered: [link]
- External material: [links]
````

## Process

1. **Draft.** Open a PR with `docs/adr/NNNN-title.md` in `Status: proposed`.
2. **Discuss.** Comments on the PR. Decisions absorbed into the body (not left in comments).
3. **Decide.** Approver(s) merge. Update `Status: accepted` in the same PR or a follow-up.
4. **Reference forward.** When a Tech Design depends on the decision, link it in section "12. Referências".
5. **Supersede.** When a new ADR replaces an old one, update the old ADR's `Status` to `superseded by [link]` and add a `Supersedes: [old]` to the new one.

## Relationship with Constitution

The Constitution is the source of truth. ADRs **never override** the Constitution. To change a Constitution principle, the ADR must:

1. Explicitly name the principle being changed.
2. Be merged together with the Constitution edit in the same PR (or as a back-to-back pair).

If an ADR conflicts with the current Constitution and doesn't propose a Constitution edit, it's invalid.

## Index

(Add ADRs here as they get accepted — newest first.)

- [0008 — Frontend internationalization with react-i18next](0008-i18n-frontend.md)
- [0007 — Transactional email provider: Resend](0007-transactional-email-provider.md)
- [0006 — Diagrams as code with Mermaid (replacing the tldraw MCP)](0006-diagrams-as-code-mermaid.md) — _proposed_
- [0005 — Environment configuration and runtime validation](0005-env-and-config.md)
- [0004 — BYOK encryption with AES-256-GCM](0004-byok-encryption.md)
- [0003 — Better Auth with email/password as the auth strategy](0003-auth-strategy.md)
- [0002 — PostgreSQL + Prisma with versioned migrations](0002-database-and-migrations.md)
- [0001 — Monorepo with pnpm workspaces and Turborepo](0001-monorepo-structure.md)
