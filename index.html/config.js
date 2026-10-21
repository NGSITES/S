/* Configuração pública: nunca coloque senhas, tokens ou chaves secretas aqui. */
window.WEDDING_CONFIG = Object.freeze({
  // Horário de Campo Largo (UTC−03:00), independente do fuso do visitante.
  weddingDate: '2026-11-28T17:00:00-03:00',
  // Após a publicação, preencha com o endereço HTTPS real do seu site.
  publicUrl: '',
  // Convite original enviado pelos noivos, incluído no pacote.
  invitationImage: 'assets/convite.png',
  invitationFilename: 'convite-kauany-e-caio.png',
  // 'server': usa POST /api/rsvps; 'whatsapp': prepara mensagem para o número abaixo.
  // O modo servidor exige executar server.mjs, não apenas abrir o HTML.
  rsvpMode: 'whatsapp',
  rsvpEndpoint: '/api/rsvps',
  // Código do país + DDD + número, somente dígitos. Exemplo de formato: 55DDDNÚMERO.
  whatsappNumber: '5541998068041',
  // Valor já informado no código original. Não há cobrança nem confirmação de pagamento.
  receptionFee: 84.90,
  maxCompanions: 4,
  // Preencha a chave Pix diretamente neste arquivo, no seu computador.
  // Este arquivo ficará público ao hospedar o site. Nunca use senhas ou tokens.
  pixKey: '086.352.059-60',
  pixRecipient: 'Caio Eduardo Antunes'
});
