# 0006. Diagrams as code with Mermaid (replacing the tldraw MCP)

**Status:** proposed
**Date:** 2026-05-31
**Deciders:** Felipe Pestelato
**Supersedes:** —

## Context

Tech Designs (and, rarely, Specs) include diagrams — flowcharts, sequence, state machines, architecture. Until now the canonical tool was the **tldraw MCP** (`https://tldraw-mcp-app.tldraw.workers.dev/mcp`), configured in `.ai/mcp.json` and referenced by the `tech-design-writer`/`spec-writer` skills, which pasted a canvas link into the Notion artifact.

In practice the tldraw MCP proved unreliable for an agent-driven workflow:

- Its `exec` channel runs **inside a live, connected canvas widget**. Without that widget open in the client, every call — including a trivial `return 1+1` — times out after 30s. This blocked diagram creation in headless/agent contexts on more than one occasion (e.g. the Auth & Conta account-lifecycle diagram, with prior timeouts already recorded on 2026-05-16).
- The diagram "source" is opaque canvas state behind a link — **not diffable, not reviewable in a PR**, and not reproducible by an agent.

Mermaid is a text-based diagram syntax that **Notion renders natively** inside a `mermaid` code block. It needs no MCP, no server, and no live widget; it is plain text the agent can author deterministically and that humans can review in the artifact and diff in git when mirrored.

## Decision

**Diagrams in project artifacts are authored as code, using Mermaid `mermaid` code blocks, embedded directly in the Notion artifact.**

- The canonical diagram tool is **Mermaid**. The **tldraw MCP server is removed** from `.ai/mcp.json` (and from the agents' enabled-server lists).
- `tech-design-writer` embeds `mermaid` code blocks in section 3 (Proposed Architecture); no external link is pasted.
- `spec-writer` may, rarely, embed a `mermaid` block inline when a flow is non-obvious and the user asks.
- This decision covers **architecture/technical diagrams** only. UI/product design remains governed by `design-handoff` (canonical channel `claude.ai/design`); Mermaid is not a UI-design tool.

## Consequences

- **Positive:** No live-widget dependency — diagrams are generable headless and never time out. Diagram source is plain text: reviewable in the Notion artifact, diffable, reproducible. One fewer MCP server to run and authenticate.
- **Negative:** Less freeform expressiveness than a canvas (arbitrary boxes/arrows placed by hand). Mermaid covers flowchart/sequence/state/class/ER/graph; anything outside those grammars is harder. Rendering fidelity depends on Notion's Mermaid support.
- **Neutral:** Diagrams now live inline in the artifact rather than behind a link. If freeform sketching is ever needed, a contributor can use any external tool ad hoc and attach an image — but that is not the documented/canonical path.

## Alternatives considered

- **Keep tldraw MCP.** Rejected: the live-widget `exec` dependency makes it unreliable for agent/headless use (repeated 30s timeouts), and its output isn't diffable or PR-reviewable.
- **PlantUML.** Rejected for this project: Notion does not render PlantUML natively, so it would require an external render step (Java + Graphviz or a render server) plus attaching an exported image. Mermaid renders inline with zero toolchain.
- **Keep tldraw as an optional sketch tool alongside Mermaid.** Rejected to avoid two parallel diagram paths; an external tool can still be used ad hoc without being documented/canonical.

## References

- Constitution principle(s) affected: none (tooling decision, not a principle).
- Tech Design / Spec that triggered: Tech Design - Autenticação e Conta (account-lifecycle state diagram, §3.4 — now a Mermaid block).
- External material: Mermaid (https://mermaid.js.org); Notion native Mermaid code-block rendering.
