# Skill: Criação de Spec

## Quando usar esta skill

Use quando o usuário pedir para:
- Criar uma Spec nova
- Escrever uma especificação de feature
- Documentar uma feature antes de implementar
- "Vamos começar a feature X" ou "preciso especificar Y"

**Não use quando:**
- O usuário pedir para implementar código (use spec-implementer)
- For criação de Tech Design (use tech-design-writer)
- For ajuste trivial / bug pequeno (não precisa de Spec)

## Princípio fundamental

O processo completo de criação de Spec é definido no **Playbook "Como criar uma Spec"** que vive no Notion. Esse Playbook é a fonte da verdade — mantido pelo time, editado por qualquer pessoa com acesso ao Notion sem necessidade de MCP.

Esta Skill **não duplica o conteúdo do Playbook**. Ela orquestra a execução: busca o Playbook, segue o que está lá, e usa os recursos disponíveis (MCPs, sistema de arquivos) para executar.

## Contrato do Notion

Os parâmetros estruturais (nome do database, propriedades, valores de select) seguem o **contrato definido em `.ai/README.md`** (seção "Configuração do Notion"). Sempre consulte esse contrato antes de criar ou buscar qualquer documento. Se ele estiver desatualizado em relação à realidade do Notion, **avise o usuário** em vez de improvisar.

## Fluxo de execução

### 1. Ler a Constitution

Leia `.ai/constitution.md` no repositório. A Spec deve respeitar todos os princípios definidos lá.

### 2. Buscar o Playbook no Notion

Via MCP do Notion, busque no database `Docs` (teamspace `DM Forge HQ`) por:
- `Category = Playbook`
- `Doc name` contendo "Como criar uma Spec"

Leia o Playbook **completo** antes de começar.

Se não encontrar, ou encontrar múltiplos resultados ambíguos, **pergunte ao usuário** qual usar. Não improvise.

### 3. Verificar pré-requisitos

Conforme o Playbook orientar, verifique:

- **PRD existe?** Busque no `Docs` por `Category = Product`. Se não houver PRD, avise o usuário.
- **Spec já existe para essa feature?** Busque no `Docs` por `Category = Spec` e título contendo o nome da feature. Se existir, pergunte ao usuário se é para atualizar a existente em vez de criar nova.

### 4. Coletar contexto do usuário

Se o Playbook indicar informações necessárias (problema, usuário-alvo, cenários, etc.) que ainda não foram fornecidas, **pergunte ao usuário antes de prosseguir**. Não invente.

### 5. Executar o Playbook

Siga rigorosamente:
- O **passo a passo** do Playbook
- O **template** definido no Playbook (estrutura de seções, ordem, nomenclatura)
- As **boas práticas** descritas
- Evite os **antipadrões** listados

Se algo no Playbook não estiver claro ou parecer contraditório, **pergunte ao usuário em vez de improvisar**.

### 6. Criar a Spec no Notion

Use o MCP do Notion para criar uma página no database `Docs` com:

- **`Doc name`:** `Spec - [Nome da feature]` (seguindo a convenção do contrato)
- **`Category`:** `Spec`
- **`Status`:** `Not started` (a menos que o Playbook indique outro status inicial)
- **`Owner`:** o usuário (pergunte se não souber)

Preencha o corpo da página seguindo o template do Playbook.

### 7. Diagramas (quando o Playbook indicar)

Se o Playbook orientar uso de diagramas, use o **MCP do tldraw** para criar e cole o link na seção apropriada do corpo da Spec.

### 8. Linkagem entre documentos

Quando precisar referenciar outro documento (ex: PRD relacionado, Research):

- Busque o link da página alvo via MCP do Notion
- Cole o link no corpo da Spec, na seção apropriada do template (geralmente "Referências")

### 9. Validar contra o checklist e Constitution

Antes de finalizar, percorra:
- O **checklist final** do Playbook
- Os **princípios da Constitution** — confirme que nenhum requisito da Spec contraria a Constitution

Se algum item falhar, ajuste antes de entregar ao usuário.

### 10. Entregar e orientar próximos passos

Conforme orientação do Playbook (geralmente: confirmar criação com link da página, listar suposições feitas, sugerir mover status para `In review` quando pronta para revisão e indicar próximos passos do fluxo SDD).

## Recursos disponíveis

- **MCP do Notion** — buscar Playbook, PRD, Specs existentes; criar a Spec no `Docs`
- **MCP do tldraw** — diagramas que o Playbook indicar
- **Sistema de arquivos** — leitura de Constitution em `.ai/constitution.md` e ADRs em `docs/adr/`

## Em caso de erro

**Se não conseguir acessar o Playbook no Notion:**
- Avise o usuário explicitamente
- **Não invente o processo de memória nem improvise**
- Peça para verificar a conexão do MCP do Notion ou os nomes dos documentos

**Se o contrato em `.ai/README.md` divergir da realidade do Notion:**
- Pare e avise o usuário
- Peça para atualizar o contrato antes de prosseguir

**Se a Constitution e a Spec proposta entrarem em conflito:**
- Aponte o conflito específico ao usuário
- Pergunte se é para ajustar a Spec ou se é caso de atualizar a Constitution (com ADR)
- Não prossiga silenciosamente contrariando a Constitution

**Se o Playbook estiver incompleto, ambíguo ou contraditório:**
- Aponte ao usuário a parte específica que está confusa
- Pergunte como proceder
- Sugira atualizar o Playbook se for o caso

**Se o PRD não for encontrado:**
- Avise o usuário
- Pergunte se é para prosseguir mesmo assim ou se ele deve ser criado antes

## Princípio de não-duplicação

Esta Skill é intencionalmente enxuta. **Toda regra de processo, template e critério vive no Playbook do Notion.** Se você se pegar adicionando passos, templates ou critérios aqui que não estão no Playbook, pare e atualize o Playbook — não esta Skill.
