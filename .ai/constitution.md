# Constitution — DM Forge

> Princípios e regras inegociáveis do projeto. Toda Spec, Tech Design, ADR e implementação deve respeitar este documento.
>
> Constitution muda raramente. Quando muda, é decisão deliberada — geralmente acompanhada de um ADR justificando.

## Princípios

1. **Clareza acima de cleverness.** Código legível ganha de código "esperto". Se um dev novo (ou um agente de IA) precisa pensar muito pra entender, simplifique.

2. **Pergunte antes de assumir.** Quando faltar contexto, pergunte. Não invente requisitos, não invente padrões, não invente nomes.

3. **Sem segredos no código.** Chaves, tokens e credenciais sempre em variáveis de ambiente. Nunca commitados, nem em "fixtures de teste".

## Padrões técnicos

_(adicione conforme decidir — exemplos abaixo só pra dar ideia)_

- _ex: TypeScript em strict mode_
- _ex: Linter e formatter rodam no CI_
- _ex: Testes obrigatórios para lógica de negócio_

## Proibido

_(adicione conforme aparecer dor — exemplos abaixo)_

- _ex: `any` no TypeScript_
- _ex: `console.log` em código de produção_

## Como mudar este documento

1. Mudanças significativas viram um ADR em `docs/adr/` justificando
2. PR de mudança da Constitution requer revisão de pelo menos um dev sênior
3. Constitution é fonte da verdade — se outro documento contradiz, este vence
