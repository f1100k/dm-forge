// Política de Privacidade — texto em pt-BR. RASCUNHO: escrito a partir do que a
// Spec e o Tech Design já definem sobre tratamento de dados (LGPD), aguardando
// revisão jurídica. `draft: true` faz a tela dizer isso a quem lê.
//
// Ao publicar uma revisão: atualize PRIVACY_VERSION, o campo `version` abaixo, e
// descreva a mudança em `changes` — é o resumo que o modal de reaceite mostra.

import { PRIVACY_VERSION } from '../auth/constants.js'
import type { LegalDocument } from './documents.js'

export const PRIVACY_PT_BR: LegalDocument = {
  title: 'Política de Privacidade do DM Forge',
  version: PRIVACY_VERSION,
  draft: true,
  changes: [
    'Primeira versão publicada desta Política, em vigor desde 1º de janeiro de 2026.',
    'Telemetria é opt-in: fica desligada até você ligar, e a revogação tem efeito imediato.',
    'Exportação completa dos seus dados e exclusão da conta com eliminação definitiva em 30 dias, ambas disponíveis na própria tela de Privacidade.',
  ],
  sections: [
    {
      heading: '1. Quem trata os seus dados',
      paragraphs: [
        'O DM Forge é o controlador dos dados pessoais tratados na plataforma, nos termos da Lei nº 13.709/2018 (LGPD).',
        'Para exercer direitos ou tirar dúvidas sobre privacidade, fale com o nosso encarregado: privacidade@dmforge.io.',
      ],
    },
    {
      heading: '2. Quais dados tratamos',
      paragraphs: [
        'Dados de conta: nome de exibição, e-mail, idioma da interface, provedores de login vinculados e o histórico dos seus consentimentos (o que você aceitou ou revogou, com versão e data).',
        'Conteúdo que você cria: campanhas, NPCs, arcos, sessões e anotações.',
        'Dados técnicos mínimos de segurança: registros de tentativas de login e endereços IP associados, usados para detectar abuso.',
      ],
    },
    {
      heading: '3. Por que tratamos (bases legais)',
      paragraphs: [
        'Execução do contrato (Art. 7º, V): manter sua conta, guardar seu conteúdo e entregar as funcionalidades da plataforma.',
        'Consentimento (Art. 7º, I e Art. 8º): aceite dos documentos legais e, separadamente, telemetria de uso.',
        'Legítimo interesse (Art. 7º, IX): segurança da plataforma, prevenção a fraude e abuso, sempre no mínimo necessário.',
        'Cumprimento de obrigação legal (Art. 7º, II): guarda de registros exigidos por lei.',
      ],
    },
    {
      heading: '4. Telemetria',
      paragraphs: [
        'A telemetria é opcional e vem desligada. Se você a ligar, coletamos eventos de uso — telas abertas, ações realizadas, erros — sem o conteúdo das suas campanhas.',
        'Você pode revogar o consentimento a qualquer momento na tela de Privacidade; a revogação vale a partir daquele momento e fica registrada no seu histórico de consentimentos.',
      ],
    },
    {
      heading: '5. Com quem compartilhamos',
      paragraphs: [
        'Provedores de infraestrutura e de e-mail transacional, estritamente para operar o serviço, sob contrato e com obrigação de confidencialidade.',
        'Provedores de IA, apenas quando você usa recursos de IA com a sua própria chave, e apenas o conteúdo daquela solicitação. Não vendemos dados pessoais.',
      ],
    },
    {
      heading: '6. Os seus direitos',
      paragraphs: [
        'Você pode confirmar a existência de tratamento, acessar seus dados, corrigi-los, solicitar anonimização ou eliminação, revogar consentimentos e pedir portabilidade (Art. 18 da LGPD).',
        'A exportação completa e a exclusão da conta estão disponíveis diretamente na tela de Privacidade, sem precisar abrir chamado. Outros pedidos: privacidade@dmforge.io.',
      ],
    },
    {
      heading: '7. Retenção e eliminação',
      paragraphs: [
        'Mantemos os seus dados enquanto a conta existir. Ao solicitar a exclusão, a conta entra em exclusão pendente por 30 dias — prazo para reverter — e depois os dados são eliminados de forma definitiva.',
        'Registros que a lei nos obriga a guardar, como logs de acesso, são mantidos pelo prazo legal, isolados do restante.',
      ],
    },
    {
      heading: '8. Segurança',
      paragraphs: [
        'Adotamos medidas técnicas e administrativas para proteger os seus dados: criptografia em trânsito, senhas armazenadas apenas como hash, controle de acesso e registro de operações sensíveis.',
        'Nenhum sistema é imune a incidentes. Caso ocorra um incidente com risco relevante, comunicaremos você e a ANPD conforme a LGPD.',
      ],
    },
    {
      heading: '9. Transferência internacional',
      paragraphs: [
        'Parte da infraestrutura e dos provedores de IA pode estar fora do Brasil. Nesses casos, a transferência ocorre com as salvaguardas previstas na LGPD.',
      ],
    },
    {
      heading: '10. Mudanças nesta Política',
      paragraphs: [
        'Quando publicarmos uma nova versão, mostraremos o que mudou e pediremos um novo aceite antes de continuar. Você sempre pode sair da conta e decidir depois.',
      ],
    },
  ],
}
