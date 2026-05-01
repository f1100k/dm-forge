# /.ai — Configuração compartilhada dos agentes

Esta pasta é a **fonte da verdade** da configuração técnica usada pelos agentes de IA do projeto (Claude Code, Cursor, e qualquer outro que vier no futuro).

## Estrutura

```
.ai/
├── README.md                     ← este arquivo
├── constitution.md               ← princípios técnicos do projeto
├── mcp.json                      ← config dos servidores MCP (compartilhada via symlink)
└── skills/
    ├── spec-writer.md            ← orquestrador (delega para Playbook no Notion)
    ├── tech-design-writer.md     ← orquestrador (delega para Playbook no Notion)
    └── [skill-puramente-tecnica].md  ← conteúdo completo (sem Playbook humano)

CLAUDE.md                         ← instruções globais do Claude Code (aponta para .ai/)
.claude/skills/                   ← adaptadores finos do Claude Code (apontam para .ai/skills/)
.cursor/rules/                    ← adaptadores finos do Cursor + rule da Constitution
.mcp.json                         ← symlink → .ai/mcp.json
.cursor/mcp.json                  ← symlink → ../.ai/mcp.json
```

---

## Onde mora cada documento

A divisão entre Notion e repositório segue um critério mais refinado que apenas "humanos editam":

> **Se o documento é parte do processo que envolve gente além dos devs (PM, design, stakeholders), vai pro Notion.
> Se é configuração técnica ou regra de código que só devs e agentes consultam, vai pro repo.**

Aplicação:

| Documento | Onde mora | Por quê |
|---|---|---|
| PRD | Notion | PM lidera, stakeholders comentam |
| Specs | Notion | PM, design, eng colaboram |
| Tech Designs | Notion | Predominantemente devs, mas pode envolver discussão |
| Playbooks de processo (Como criar Spec, etc.) | Notion | Regras de processo do time |
| Research | Notion | PM, UX produzem |
| **Constitution** | **`.ai/constitution.md`** | **Regra técnica, só devs e agentes consultam** |
| ADRs | `docs/adr/` | Decisões técnicas, atreladas ao código |
| MCP config, Skills | `.ai/` | Configuração técnica dos agentes |
| README, código | repo | Óbvio |

---

## Constitution

A `constitution.md` define os princípios e regras inegociáveis do projeto. Toda Spec, Tech Design, ADR e implementação deve respeitar.

**Garantia de leitura:** os agentes leem a Constitution em **toda interação** via:

- `CLAUDE.md` na raiz (Claude Code)
- `.cursor/rules/constitution.mdc` com `alwaysApply: true` (Cursor)

Esses adaptadores apontam pro `.ai/constitution.md` — a fonte da verdade. Quando a Constitution mudar, ambos os agentes pegam a nova versão automaticamente.

---

## Configuração do Notion (contrato)

**Esta seção é o contrato que as skills consultam.** Se a estrutura do Notion mudar, atualize aqui.

### Workspace e teamspace

- **Teamspace:** `DM Forge HQ`

### Databases

#### Docs
Database principal de documentação textual.

**Propriedades:**
- `Doc name` (title)
- `Category` (select): `Product`, `Research`, `Spec`, `Playbook`
- `Status` (status): `Not started`, `In progress`, `In review`, `Done`
- `Owner` (person)

**Documentos canônicos referenciados pelas skills:**
- Playbook "Como criar uma Spec" → `Category = Playbook`
- Playbook "Como criar um Tech Design" → `Category = Playbook`
- PRD do projeto → `Category = Product`

**Convenção de nomenclatura:**
- Specs: `Spec - [Nome da feature]`
- Tech Designs: `Tech Design - [Nome da feature]`
- Playbooks: `[Nome do processo]` (ex: "Como criar uma Spec")

> **Observação:** o select `Category` atualmente não tem `Tech Design` como valor próprio. Tech Designs entram como `Category = Spec`, diferenciados pelo prefixo no `Doc name`. Quando criar a categoria `Tech Design` no Notion, atualizar este contrato.

#### Kanban
Tarefas e execução. Skills criam cards aqui derivados do "Plano de Execução" de Tech Designs.

#### Meetings
Atas. Skills geralmente apenas leem, não criam.

### Linkage entre documentos

Atualmente: **colar o link da página do Notion no corpo da página alvo**, na seção apropriada do template.

Formato de link aceito (ambos funcionam):
- `https://app.notion.com/p/[id]?...`
- Link curto via "Copy link"

> **Melhoria futura:** adicionar propriedade do tipo Relation no database `Docs` para relação estruturada e bidirecional. Atualizar este contrato quando implementar.

---

## Princípio dos adaptadores

Os adaptadores em `.claude/skills/` e `.cursor/rules/` são **finos**:

1. Frontmatter no formato que cada ferramenta exige
2. Uma única linha apontando para `.ai/skills/[skill].md` ou `.ai/constitution.md`

**Description idêntica** entre os dois adaptadores. **Nada de conteúdo extra** — se aparecer, mover pra `.ai/`.

## Tipos de Skills

### Tipo 1: Orquestradora (delega para Playbook no Notion)

Quando existe um Playbook humano no Notion, a Skill **não duplica** esse conteúdo. Ela busca o Playbook, lê, e segue rigorosamente.

Exemplos: `spec-writer`, `tech-design-writer`.

### Tipo 2: Conteúdo completo (workflow técnico)

Quando não há Playbook humano correspondente, o conteúdo vive na própria Skill.

Exemplos futuros: `spec-implementer`, `adr-writer`.

## Skills disponíveis

| Skill | Tipo | Quando usar |
|---|---|---|
| `spec-writer` | Orquestradora | Criar Spec de feature |
| `tech-design-writer` | Orquestradora | Criar Tech Design (requer Spec aprovada) |

## Recursos disponíveis para os agentes

- **MCP do Notion** — ler/criar páginas no `Docs`, movimentar `Kanban`, buscar Playbooks
- **MCP do tldraw** — diagramas (fluxos, arquitetura, sequência, estados)
- **Sistema de arquivos** — código, ADRs em `docs/adr/`, Constitution em `.ai/constitution.md`

## Princípios

- **Constitution acima de tudo** — qualquer documento ou código que contradiz a Constitution está errado
- **Notion = documentação humana** com colaboração além dos devs
- **Repo = configuração técnica e código** que só devs e agentes consultam
- Skills devem **buscar contexto antes de agir**: Constitution, contrato deste README, Playbook, PRD, ADRs existentes
- Skills devem **perguntar quando faltar informação crítica**, nunca inventar
- Skills orquestradoras **nunca duplicam conteúdo de Playbook** — sempre delegam
