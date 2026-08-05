// Termos de Uso — texto em pt-BR. RASCUNHO: escrito a partir do que a Spec já
// afirma sobre o produto, aguardando revisão jurídica. `draft: true` faz a tela
// dizer isso a quem lê.
//
// Ao publicar uma revisão: atualize TERMS_VERSION, o campo `version` abaixo, e
// descreva a mudança em `changes` — é o resumo que o modal de reaceite mostra.

import { TERMS_VERSION } from '../auth/constants.js'
import type { LegalDocument } from './documents.js'

export const TERMS_PT_BR: LegalDocument = {
  title: 'Termos de Uso do DM Forge',
  version: TERMS_VERSION,
  draft: true,
  changes: [
    'Primeira versão publicada destes Termos, em vigor desde 1º de janeiro de 2026.',
    'Uso de provedores de IA com a sua própria chave (BYOK): a chave é sua, o custo é seu, e nós não a usamos para nada além das suas próprias solicitações.',
    'Encerramento de conta com 30 dias de arrependimento antes da eliminação definitiva.',
  ],
  sections: [
    {
      heading: '1. O que é o DM Forge',
      paragraphs: [
        'O DM Forge é uma ferramenta para Mestres de RPG de mesa: um codex estruturado para organizar campanhas, NPCs, arcos e sessões, com um assistente de IA que trabalha sobre o conteúdo que você mesmo criou.',
        'Estes Termos regem o seu uso da plataforma. Ao criar uma conta, você concorda com eles. Se não concordar, não use o serviço.',
      ],
    },
    {
      heading: '2. Conta e elegibilidade',
      paragraphs: [
        'Para criar uma conta você declara ter 13 anos ou mais. Se a legislação do seu país exigir idade maior para consentir com o tratamento de dados pessoais, aplica-se essa idade.',
        'Você é responsável por manter a confidencialidade das suas credenciais e por tudo o que acontece na sua conta. Avise-nos assim que suspeitar de acesso não autorizado.',
      ],
    },
    {
      heading: '3. Uso aceitável',
      paragraphs: [
        'Use o DM Forge para criar e organizar material narrativo. Não o use para publicar conteúdo ilegal, violar direitos de terceiros, tentar obter acesso não autorizado a contas ou infraestrutura, ou sobrecarregar deliberadamente o serviço.',
        'Podemos suspender contas que violem estas regras, com aviso sempre que for possível dar um.',
      ],
    },
    {
      heading: '4. O seu conteúdo continua seu',
      paragraphs: [
        'Campanhas, NPCs, anotações e qualquer outro material que você criar continuam sendo seus. Você nos concede apenas a licença técnica necessária para armazenar, exibir e processar esse conteúdo a fim de operar o serviço para você.',
        'Você pode exportar tudo a qualquer momento, em formato aberto, pela tela de Privacidade.',
      ],
    },
    {
      heading: '5. Inteligência artificial com a sua chave (BYOK)',
      paragraphs: [
        'Os recursos de IA funcionam com a sua própria chave de provedor. Ao usá-los, você envia conteúdo da sua campanha ao provedor que escolheu, e a relação com esse provedor — custos, limites e políticas — é entre você e ele.',
        'Não usamos o seu conteúdo para treinar modelos, nem o compartilhamos com provedores de IA fora das solicitações que você mesmo dispara.',
      ],
    },
    {
      heading: '6. Disponibilidade e mudanças no serviço',
      paragraphs: [
        'Trabalhamos para manter o serviço disponível, mas ele é oferecido "como está", sem garantia de operação ininterrupta. Manutenções, incidentes e limites técnicos podem interromper o acesso.',
        'Podemos alterar, adicionar ou descontinuar funcionalidades. Mudanças relevantes que afetem o seu uso serão comunicadas com antecedência razoável.',
      ],
    },
    {
      heading: '7. Encerramento da conta',
      paragraphs: [
        'Você pode excluir sua conta a qualquer momento. A conta entra em estado de exclusão pendente por 30 dias, período em que você pode reverter a decisão pelo suporte. Depois desse prazo, os dados são eliminados de forma definitiva.',
        'Podemos encerrar contas que violem estes Termos ou a legislação aplicável.',
      ],
    },
    {
      heading: '8. Limitação de responsabilidade',
      paragraphs: [
        'Na máxima extensão permitida pela lei, não respondemos por danos indiretos, lucros cessantes ou perda de dados decorrentes do uso do serviço. Nada aqui limita direitos que a legislação consumerista brasileira garanta a você de forma inafastável.',
      ],
    },
    {
      heading: '9. Mudanças nestes Termos',
      paragraphs: [
        'Quando publicarmos uma nova versão, mostraremos a você o que mudou e pediremos um novo aceite antes de continuar usando a plataforma. Enquanto não aceitar, o uso fica bloqueado — e você pode sair da conta e decidir depois.',
      ],
    },
    {
      heading: '10. Lei aplicável e contato',
      paragraphs: [
        'Estes Termos são regidos pelas leis da República Federativa do Brasil, com foro no domicílio do usuário para relações de consumo.',
        'Dúvidas sobre estes Termos: suporte@dmforge.io.',
      ],
    },
  ],
}
