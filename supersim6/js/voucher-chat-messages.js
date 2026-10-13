// Edite os textos e rótulos aqui; mantenha as chaves usadas pela lógica.
// {campo} recebe o valor do cadastro. **texto** destaca palavras nos balões.
window.VOUCHER_CHAT_MESSAGES = {
  intro: [
    'Olá! Sou o assistente automatizado desta campanha de **voucher de combustível**.',
    'Vamos conferir seus dados e fazer algumas perguntas sobre sua rotina. A análise será feita pelo suporte; este chat **não aprova nem libera benefícios**.'
  ],
  profile: '**Atividade:** {loanPurpose}<br>**Ocupação:** {occupation}<br>**Gasto semanal:** {fuelConsumption}<br>**Abastecimentos por semana:** {fuelFrequency}<br>**Dias de trabalho:** {workDays}',
  confirm: 'Essas informações estão corretas? Podemos continuar?',
  missing: ['Faltam informações sobre sua atividade e seus abastecimentos. Preencha o formulário antes de continuar.'],
  labels: {
    confirm: 'Sim, pode continuar',
    edit: 'Corrigir meus dados',
    form: 'Preencher meus dados',
    continue: 'Continuar',
    home: 'Voltar ao site',
    email: 'Abrir e-mail para o suporte',
    yes: 'Sim',
    no: 'Não',
    unsure: 'Ainda não sei',
    consent: 'Sim, preparar minha solicitação',
    decline: 'Não, encerrar sem enviar'
  },
  branches: {
    aplicativo: {
      agent: ['Vi que você informou **{loanPurpose}**. Você está realizando corridas atualmente na Uber ou na 99?'],
      reply: 'Obrigado! Essa informação será incluída no seu pedido para avaliação pelo suporte.'
    },
    entregas: {
      agent: ['Você informou **{loanPurpose}**. Além das entregas, você também realiza corridas na Uber ou na 99?'],
      reply: 'Anotado. A participação na Uber ou na 99 precisa ser conferida pelo suporte.'
    },
    outro: {
      agent: ['Você informou **{loanPurpose}**. Também atua como motorista na Uber ou na 99?'],
      reply: 'Obrigado por esclarecer. O suporte deverá verificar se sua atividade atende às regras da campanha.'
    }
  },
  occupation: ['Sua ocupação informada é **{occupation}**. Como você costuma trabalhar com o veículo?'],
  routineOptions: {
    integral: 'Em tempo integral',
    parcial: 'Nas horas vagas',
    variavel: 'Minha rotina varia'
  },
  fuel: ['Sobre o gasto semanal de **{fuelConsumption}**: qual combustível você utiliza principalmente?'],
  fuelOptions: {
    gasolina: 'Gasolina',
    etanol: 'Etanol',
    diesel: 'Diesel',
    gnv: 'GNV',
    outro: 'Outro / varia'
  },
  rules: ['Antes de continuar: a campanha é destinada a motoristas da Uber e da 99. Validade, disponibilidade e regras de utilização devem ser confirmadas pelo suporte. **Não há garantia de recebimento.**'],
  summary: [
    'Confira o resumo do pedido:<br>{profile}',
    '**Atua na Uber/99 atualmente:** {appActive}<br>**Rotina:** {routine}<br>**Combustível:** {fuelType}',
    'Vamos incluir um contato para o suporte tratar sua solicitação?'
  ],
  email: {
    agent: ['Informe seu **e-mail de contato**.'],
    placeholder: 'Seu e-mail',
    error: 'Informe um e-mail válido.'
  },
  phone: {
    agent: ['Agora informe seu **telefone com DDD**.'],
    placeholder: '(11) 99999-9999',
    error: 'Informe um telefone com DDD, com 10 ou 11 dígitos.'
  },
  consent: ['Você autoriza incluir esses dados no e-mail ao suporte para tratar sua solicitação? Você precisará revisar e enviar a mensagem pelo seu aplicativo de e-mail.'],
  cancelled: ['Você encerrou sem enviar. **Nenhum dado foi enviado ao suporte.**'],
  pending: [
    '**Solicitação preparada — pendente de envio e análise.**',
    'Seus dados estão salvos apenas neste navegador. **Nenhum pedido foi enviado automaticamente.** Abra o e-mail abaixo, revise e envie ao suporte.',
    'O suporte deverá avaliar sua solicitação e orientar sobre eventual liberação. Não há aprovação automática nem cobrança neste chat.'
  ],
  emailSubject: 'Solicitação de análise de voucher',
  emailBody: 'Solicitação de análise de voucher combustível\nAtividade: {loanPurpose}\nOcupação: {occupation}\nGasto semanal: {fuelConsumption}\nAbastecimentos por semana: {fuelFrequency}\nDias de trabalho: {workDays}\nAtua na Uber/99: {appActive}\nRotina: {routine}\nCombustível: {fuelType}\nE-mail: {email}\nTelefone: {phone}',
  unavailable: 'Não foi possível carregar as mensagens do chat. Recarregue a página.'
};
