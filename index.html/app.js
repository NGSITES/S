(() => {
  'use strict';
  const config = window.WEDDING_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const priceCents = Math.max(0, Math.round(Number(config.receptionFee || 0) * 100));
  const maxCompanions = Math.min(4, Math.max(0, Number(config.maxCompanions ?? 4)));
  const whatsapp = String(config.whatsappNumber || '').replace(/\D/g, '');
  const hasWhatsapp = /^[1-9]\d{9,14}$/.test(whatsapp);
  const serverMode = config.rsvpMode === 'server';
  const names = { both: 'Cerimônia e restaurante', ceremony: 'Apenas cerimônia', reception: 'Apenas restaurante', absent: 'Não poderei comparecer' };
  let savedResponse = null;
  let responseText = '';
  let requestFingerprint = '';
  let requestId = '';
  let sending = false;
  let companionIndex = 0;
  let toastTimer;

  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { $('toast').hidden = true; }, 5500);
  }
  function safeHttps(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function localOrHttpsImage(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
    if (/^https:/i.test(value)) return safeHttps(value);
    return /^(?:\.\/)?assets\/[a-zA-Z0-9_.\/-]+\.(png|jpe?g|svg|webp)$/i.test(value) && !value.includes('..') ? value : '';
  }
  function selection() { return document.querySelector('input[name="attendance"]:checked')?.value || ''; }
  function rows() { return [...$('companions').querySelectorAll('.companion-row')]; }
  function hasReception(attendance) { return attendance === 'both' || attendance === 'reception'; }
  function peopleCount() { return selection() === 'absent' ? 0 : 1 + rows().length; }
  function formatMoney(cents) { return currency.format(cents / 100); }

  function tick() {
    const target = new Date(config.weddingDate || '2026-11-28T17:00:00-03:00').getTime();
    if (!Number.isFinite(target)) { $('countdown-message').textContent = '28 de novembro de 2026 · 17h00'; $('countdown-message').hidden = false; return; }
    const delta = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const parts = [Math.floor(delta / 86400), Math.floor(delta / 3600) % 24, Math.floor(delta / 60) % 60, delta % 60];
    ['days', 'hours', 'minutes', 'seconds'].forEach((id, i) => { $(id).textContent = String(parts[i]).padStart(2, '0'); });
    if (!delta) {
      $('countdown-message').textContent = Date.now() < target + 86400000 ? 'Chegou o grande dia! ♡' : 'Um dia para guardar no coração. ♡';
      $('countdown-message').hidden = false;
    }
  }
  tick();
  window.setInterval(tick, 1000);

  const invitation = localOrHttpsImage(config.invitationImage) || 'assets/convite.png';
  $('invitation-image').src = invitation;
  $('modal-image').src = invitation;
  $('download-invitation').href = invitation;
  $('download-invitation').download = config.invitationFilename || 'convite-kauany-e-caio.png';
  const dialog = $('invitation-dialog');
  $('open-invitation').addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else window.open(invitation, '_blank', 'noopener,noreferrer');
  });
  $('close-invitation').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => $('open-invitation').focus({ preventScroll: true }));

  // Nunca inclui file://, localhost ou URL privada em mensagens de compartilhamento.
  let publicUrl = safeHttps(config.publicUrl);
  if (!publicUrl && location.protocol === 'https:' && !/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/i.test(location.hostname)) {
    publicUrl = new URL(location.pathname.replace(/\/confirmar\/?$/, '/'), location.origin).href;
  }
  const shareText = 'Kauany e Caio 💚\nDois corações, um destino.\n\n28 de novembro de 2026, às 17h00.\nIgreja São Pedro e São Paulo, Rua Maria Bertoja Rivabem, 694, Vila Ferrari, Campo Largo – PR.\n\nSua presença é nosso maior presente!' + (publicUrl ? '\n\nVeja o convite e confirme sua presença: ' + publicUrl : '');
  $('share-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(shareText);

  function updateAttendance() {
    const attendance = selection();
    const present = Boolean(attendance && attendance !== 'absent');
    $('companions-section').hidden = !present;
    if (!present) $('companions').replaceChildren();
    $('punctuality-note').hidden = !(attendance === 'both' || attendance === 'ceremony');
    $('reception-note').hidden = !hasReception(attendance);
    $('fee-person').textContent = formatMoney(priceCents);
    $('reception-cost').textContent = `Total previsto: ${formatMoney(peopleCount() * priceCents)} (${peopleCount()} ${peopleCount() === 1 ? 'pessoa' : 'pessoas'}) · o pagamento é feito após a confirmação.`;
    $('add-companion').disabled = rows().length >= maxCompanions;
    $('add-companion').textContent = rows().length >= maxCompanions ? 'Limite de 4 acompanhantes atingido' : '+ Adicionar acompanhante';
    rows().forEach((row, index) => { row.querySelector('label').textContent = `Nome do acompanhante ${index + 1}`; row.querySelector('button').setAttribute('aria-label', `Remover acompanhante ${index + 1}`); });
  }
  document.querySelectorAll('input[name="attendance"]').forEach((input) => input.addEventListener('change', updateAttendance));
  $('add-companion').addEventListener('click', () => {
    if (rows().length >= maxCompanions || !selection() || selection() === 'absent') return;
    const row = document.createElement('div'); row.className = 'companion-row';
    const field = document.createElement('div'); field.className = 'field';
    const label = document.createElement('label'); const input = document.createElement('input');
    input.id = `companion-${++companionIndex}`; input.type = 'text'; input.name = 'companion'; input.required = true; input.minLength = 2; input.maxLength = 100; input.autocomplete = 'off'; label.htmlFor = input.id;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button'; remove.textContent = '×';
    remove.addEventListener('click', () => { row.remove(); updateAttendance(); $('add-companion').focus({ preventScroll: true }); });
    field.append(label, input); row.append(field, remove); $('companions').append(row); updateAttendance(); input.focus();
  });
  updateAttendance();

  function error(message, field) {
    $('form-error').textContent = message; $('form-error').hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }
  function getPayload() {
    $('form-error').hidden = true;
    document.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    const name = $('guest-name').value.trim().replace(/\s+/g, ' ');
    const phone = $('guest-phone').value.replace(/\D/g, '');
    const attendance = selection();
    if (name.length < 2 || name.length > 100) { error('Informe seu nome completo, com pelo menos 2 caracteres.', $('guest-name')); return null; }
    if (!/^\d{10,15}$/.test(phone)) { error('Informe um WhatsApp válido com DDD (10 a 15 dígitos, incluindo o código do país se necessário).', $('guest-phone')); return null; }
    if (!names[attendance]) { error('Escolha em quais momentos você estará conosco.', document.querySelector('input[name="attendance"]')); return null; }
    const companions = attendance === 'absent' ? [] : rows().map((row) => row.querySelector('input').value.trim().replace(/\s+/g, ' '));
    const invalid = companions.findIndex((name) => name.length < 2 || name.length > 100);
    if (invalid >= 0) { error('Preencha o nome de cada acompanhante ou remova o campo vazio.', rows()[invalid].querySelector('input')); return null; }
    return { name, phone, attendance, guests: attendance === 'absent' ? 0 : 1 + companions.length, companions };
  }
  function makeMessage(data) {
    const message = [
      'Resposta ao convite de Kauany e Caio 💚', 'Casamento: 28/11/2026', '',
      `Nome: ${data.name}`, `WhatsApp: ${data.phone}`,
      `Participação: ${names[data.attendance]}`,
      `Total de pessoas: ${data.guests}`
    ];
    if (data.companions.length) message.push('Acompanhantes: ' + data.companions.join('; '));
    if (hasReception(data.attendance)) message.push(`Recepção: ${formatMoney(priceCents)} por pessoa`, `Total previsto: ${formatMoney(priceCents * data.guests)}`, 'Pagamento: ainda não confirmado.');
    if (data.id) message.push(`Protocolo no site: ${data.id}`);
    return message.join('\n');
  }
  function renderPayment(data) {
    $('payment-section').hidden = !hasReception(data.attendance);
    if (!hasReception(data.attendance)) return;
    $('payment-total').textContent = `Total previsto: ${formatMoney(priceCents * data.guests)} · ${data.guests} ${data.guests === 1 ? 'pessoa' : 'pessoas'}.`;
    const pix = String(config.pixKey ?? '');
    const hasPixKey = pix.trim().length > 0;
    const recipient = String(config.pixRecipient || '').trim();
    $('pix-recipient').textContent = recipient ? `Favorecido informado: ${recipient}` : '';
    $('pix-recipient').hidden = !recipient;
    $('pix-controls').hidden = false;
    $('pix-key').value = pix;
    $('copy-pix').disabled = !hasPixKey;
    $('pix-button-help').textContent = hasPixKey
      ? 'Toque em Copiar chave Pix e cole a chave no aplicativo do seu banco.'
      : 'Botão desativado até a chave Pix ser informada pelos noivos.';
    $('payment-unconfigured').hidden = hasPixKey;
  }

  function showResult(data) {
    savedResponse = data;
    responseText = makeMessage(data);
    $('rsvp-form').hidden = true; $('rsvp-result').hidden = false;
    $('result-title').textContent = data.id ? 'Resposta registrada' : 'Sua resposta está pronta';
    $('result-message').textContent = data.id
      ? (data.attendance === 'absent' ? 'Obrigado por nos avisar. Sua resposta foi salva na lista deste site.' : 'Que alegria ter você conosco! Sua resposta foi salva na lista deste site.')
      : 'Revise os dados e envie a mensagem pelo WhatsApp para que os noivos recebam sua resposta.';
    $('receipt-id').textContent = data.id ? `Protocolo: ${data.id}` : 'Preparar a mensagem não envia nem confirma sua presença automaticamente.';
    $('confirmation-summary').textContent = responseText;
    $('whatsapp-unconfigured').hidden = hasWhatsapp;
    $('send-whatsapp').hidden = !hasWhatsapp;
    $('whatsapp-help').hidden = !hasWhatsapp;
    if (hasWhatsapp) $('send-whatsapp').href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(responseText)}`;
    $('edit-response').hidden = Boolean(data.id);
    $('download-receipt').textContent = data.id ? 'Baixar comprovante da resposta' : 'Baixar resumo';
    renderPayment(data);
    $('rsvp-result').focus({ preventScroll: true });
    $('rsvp-result').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map((n) => n.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  $('rsvp-form').addEventListener('submit', async (event) => {
    event.preventDefault(); if (sending) return;
    const payload = getPayload(); if (!payload) return;
    if (!serverMode) { showResult(payload); return; }
    if (location.protocol === 'file:') { error('O modo lista precisa do servidor. Execute npm start e abra http://localhost:3000, ou use o modo whatsapp em config.js.'); return; }
    sending = true; $('submit-rsvp').disabled = true; $('submit-rsvp').textContent = 'Enviando…';
    const fingerprint = JSON.stringify(payload);
    if (requestFingerprint !== fingerprint) { requestId = uuid(); requestFingerprint = fingerprint; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const endpoint = new URL(config.rsvpEndpoint || '/api/rsvps', location.href);
      if (endpoint.origin !== location.origin) throw new Error('A confirmação deve usar o servidor deste site. Verifique rsvpEndpoint em config.js.');
      const result = await fetch(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, ...payload }), signal: controller.signal });
      let json; try { json = await result.json(); } catch { throw new Error('O servidor não respondeu corretamente. Nenhuma confirmação foi verificada.'); }
      if (!result.ok || json.ok !== true || typeof json.id !== 'string') throw new Error(json.error || 'Não foi possível registrar sua resposta. Tente novamente.');
      showResult({ ...payload, id: json.id, receivedAt: json.receivedAt });
    } catch (cause) {
      error(cause.name === 'AbortError' ? 'A resposta do servidor demorou. Não foi possível verificar o registro. Tente novamente sem alterar os dados para evitar duplicação.' : (cause.message || 'Falha de conexão. Não foi possível verificar o registro.'));
    } finally {
      window.clearTimeout(timeout); sending = false; $('submit-rsvp').disabled = false; $('submit-rsvp').textContent = 'Confirmar e salvar resposta';
    }
  });
  $('edit-response').addEventListener('click', () => { $('rsvp-result').hidden = true; $('rsvp-form').hidden = false; $('guest-name').focus(); });
  async function copy(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; } } catch { /* use fallback */ }
    const previousFocus = document.activeElement;
    const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.focus({ preventScroll: true }); area.select();
    let ok = false;
    try { ok = typeof document.execCommand === 'function' && document.execCommand('copy'); } catch { ok = false; } finally { area.remove(); previousFocus?.focus({ preventScroll: true }); }
    if (!ok) throw new Error('Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.');
  }
  $('copy-response').addEventListener('click', async () => { try { await copy(responseText); toast('Mensagem copiada. Agora envie para os noivos pelo WhatsApp.'); } catch (e) { toast(e.message); } });
  $('copy-pix').addEventListener('click', async () => {
    const exactKey = String(config.pixKey ?? '');
    if (!exactKey.trim()) { toast('A chave Pix ainda não foi configurada. Solicite os dados aos noivos.'); return; }
    try {
      await copy(exactKey);
      toast('Chave Pix copiada. Confira o valor e o favorecido no seu banco antes de pagar.');
    } catch (e) {
      toast(e.message || 'Não foi possível copiar automaticamente. Selecione e copie a chave manualmente.');
    }
  });
  $('download-receipt').addEventListener('click', () => {
    if (!savedResponse) return;
    const status = savedResponse.id ? `Registro salvo no servidor em ${new Date(savedResponse.receivedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.` : 'Resumo preparado. A resposta só será recebida pelos noivos quando você enviar a mensagem pelo WhatsApp.';
    const blob = new Blob([status + '\n\n' + responseText + '\n\nEste arquivo não comprova pagamento.\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'resposta-casamento-kauany-caio.txt'; document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
  if (serverMode) {
    $('submit-rsvp').textContent = 'Confirmar e salvar resposta';
    $('privacy-note').textContent = 'Seu nome, WhatsApp, escolha e acompanhantes serão enviados ao servidor deste site para a organização do casamento. Depois você também poderá enviar a resposta pelo WhatsApp dos noivos.';
    if (location.protocol === 'file:') { $('mode-notice').hidden = false; $('mode-notice').textContent = 'A lista centralizada exige o servidor. Abra pelo endereço do servidor ou altere rsvpMode para whatsapp para testar este arquivo sem hospedagem.'; }
  }
  $('submit-rsvp').disabled = false;
  if (/\/confirmar\/?$/.test(location.pathname)) $('confirmar').scrollIntoView();
})();
