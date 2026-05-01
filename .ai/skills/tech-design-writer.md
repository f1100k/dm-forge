# Skill: Criação de Tech Design

## Quando usar esta skill

Use quando o usuário pedir para:
- Criar um Tech Design para uma feature
- Desenhar a arquitetura de uma feature
- Documentar a abordagem técnica antes de implementar
- "Como vamos implementar X", "design técnico de Y"

**Não use quando:**
- A Spec relacionada ainda não está aprovada
- For uma feature trivial sem necessidade de Tech Design
- O usuário pedir só para implementar código (use spec-implementer)

## Princípio fundamental

O processo completo de criação de Tech Design é definido no **Playbook "Como criar um Tech Design"** que vive no Notion. Esse Playbook é a fonte da verdade — mantido pelo time, editado por qualquer pessoa com acesso ao Notion sem necessidade de MCP.

Esta Skill **não duplica o conteúdo do Playbook**. Ela orquestra a execução.

## Contrato do Notion

Os parâmetros estruturais (nome do database, propriedades, valores de select) seguem o **contrato definido em `.ai/README.md`** (seção "Configuração do Notion"). Sempre consulte esse contrato antes de criar ou buscar qualquer documento.

> **Atenção:** atualmente o select `Category` não possui valor `Tech Design` separado. Tech Designs usam `Category = Spec`, sendo diferenciados pelo prefixo no `Doc name` (`Tech Design - X`). Verifique o contrato em `.ai/README.md` caso isso tenha sido atualizado.

## Fluxo de execução

### 1. Ler a Constitution

Leia `.ai/constitution.md` no repositório. O Tech Design deve respeitar todos os princípios técnicos definidos lá. Decisões de arquitetura, stack, padrões de código e qualidade não podem contrariar a Constitution.

### 2. Buscar o Playbook no Notion

Via MCP do Notion, busque no database `Docs` (teamspace `DM Forge HQ`) por:
- `Category = Playbook`
- `Doc name` contendo "Como criar um Tech Design"

Leia o Playbook **completo** antes de começar.

Se não encontrar, ou encontrar múltiplos resultados ambíguos, **pergunte ao usuário**. Não improvise.

### 3. Verificar pré-requisitos

**Crítico — Spec aprovada:**
Busque a Spec relacionada no `Docs`:
- `Category = Spec`
- `Doc name` começando com `Spec - [Nome da feature]`
- `Status = Done` (ou o status que o Playbook indicar como "aprovada")

**Se a Spec não estiver com status `Done`, pare imediatamente** e oriente o usuário a finalizar a Spec antes de prosseguir com o Tech Design.

**Outros pré-requisitos do Playbook:**
- **ADRs existentes** — listar arquivos em `docs/adr/` no repo. Decisões prévias restringem o que pode ser proposto.
- **Tech Design não duplicado** — buscar no `Docs` por título começando com `Tech Design - [Nome da feature]`

### 4. Coletar contexto técnico

Conforme o Playbook indicar:
- Spec da feature (já buscada via MCP do Notion)
- Constitution (já lida do arquivo local)
- Stack atual (leitura de README, package.json, ou pergunta ao usuário)
- Código relevante que será tocado
- ADRs aplicáveis em `docs/adr/`

### 5. Executar o Playbook

Siga rigorosamente:
- O **passo a passo** do Playbook
- O **template** definido no Playbook
- As **boas práticas** descritas
- Evite os **antipadrões** listados
- **Princípios da Constitution** prevalecem sobre qualquer outra orientação

Se algo não estiver claro, **pergunte em vez de improvisar**.

### 6. Criar o Tech Design no Notion

Use o MCP do Notion para criar uma página no database `Docs` com:

- **`Doc name`:** `Tech Design - [Nome da feature]` (mesmo nome da Spec, trocando o prefixo)
- **`Category`:** `Spec` (até que a categoria `Tech Design` seja criada — ver contrato no README)
- **`Status`:** `Not started` (a menos que o Playbook indique outro)
- **`Owner`:** dev responsável (pergunte se não souber)

Preencha o corpo seguindo o template do Playbook.

### 7. Linkagem com a Spec

Cole o link da Spec relacionada no corpo do Tech Design, na seção apropriada do template (geralmente no topo ou em "Referências").

Use o link da página da Spec obtido via MCP do Notion.

### 8. Diagramas via tldraw

Tech Design tipicamente se beneficia de diagramas. Conforme o Playbook orientar (arquitetura, sequência, estados, modelo de dados), use o **MCP do tldraw** e cole os links nas seções apropriadas do corpo do Tech Design.

Diagrame apenas quando agregar valor — siga o critério do Playbook.

### 9. Identificar decisões que viram ADR

Conforme orientação do Playbook, identifique decisões arquiteturais relevantes que devem virar **ADRs separados em `docs/adr/`** no repositório.

Liste essas decisões claramente para o usuário, mas **não crie os ADRs automaticamente** — isso é responsabilidade de outra Skill ou do próprio dev.

**Atenção especial:** se uma decisão proposta for grande o suficiente pra contradizer a Constitution, ela precisa virar não só um ADR, mas também uma proposta de atualização da Constitution. Aponte isso explicitamente ao usuário.

### 10. Validar contra o checklist e Constitution

Antes de finalizar, percorra:
- O **checklist final** do Playbook
- Os **princípios da Constitution** — confirme que a abordagem técnica não contraria nenhum princípio
- **ADRs existentes** — confirme que a abordagem não contraria silenciosamente decisões anteriores

Se algum item falhar, ajuste antes de entregar.

### 11. Entregar e orientar próximos passos

Conforme orientação do Playbook (geralmente: link da página criada, resumo da abordagem, diagramas criados, decisões que devem virar ADR, trade-offs principais e próximos passos — revisão técnica, criação de ADRs, quebra do plano de execução em cards no `Kanban`).

## Recursos disponíveis

- **MCP do Notion** — buscar Playbook, Spec, Tech Designs existentes; criar o Tech Design no `Docs`
- **MCP do tldraw** — diagramas de arquitetura, sequência, estados, modelo de dados
- **Sistema de arquivos** — leitura de Constitution em `.ai/constitution.md`, ADRs em `docs/adr/` e código relevante

## Em caso de erro

**Se não conseguir acessar o Playbook no Notion:**
- Avise o usuário explicitamente
- **Não invente o processo de memória nem improvise**

**Se a Spec relacionada não estiver com status `Done`:**
- Pare e oriente o usuário a finalizar a Spec primeiro
- Não prossiga com Tech Design sobre Spec em rascunho ou em revisão

**Se o contrato em `.ai/README.md` divergir da realidade do Notion:**
- Pare e avise o usuário
- Peça para atualizar o contrato antes de prosseguir

**Se a Constitution e a abordagem proposta entrarem em conflito:**
- Aponte o conflito específico ao usuário
- Pergunte se é para ajustar a abordagem ou se é caso de atualizar a Constitution (com ADR)
- Não prossiga silenciosamente contrariando a Constitution

**Se ADRs existentes contrariarem a abordagem proposta:**
- Aponte o conflito ao usuário
- Pergunte se é para propor um novo ADR substituindo o anterior, ou ajustar a abordagem

**Se o Playbook estiver incompleto, ambíguo ou contraditório:**
- Aponte a parte específica que está confusa
- Pergunte como proceder
- Sugira atualizar o Playbook se for o caso

## Princípio de não-duplicação

Esta Skill é intencionalmente enxuta. **Toda regra de processo, template e critério vive no Playbook do Notion.** Se você se pegar adicionando passos, templates ou critérios aqui que não estão no Playbook, pare e atualize o Playbook — não esta Skill.
