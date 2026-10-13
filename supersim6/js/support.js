'use strict';

(function () {
  var link = document.getElementById('whatsapp-link');
  var status = document.getElementById('support-status');
  var config = null;
  var storageError = '';
  var subject = document.getElementById('support-subject');
  var name = document.getElementById('customer-name');
  var cpf = document.getElementById('customer-cpf');
  var email = document.getElementById('customer-email');
  var preview = document.getElementById('message-preview');

  function updateMessage() {
    var lines = [config ? config.message : 'Olá! Preciso de ajuda.'];
    lines.push('', 'Assunto: ' + (subject.value || 'Atendimento geral'));
    var details = [];
    if (name.value.trim()) details.push('Nome: ' + name.value.trim());
    if (cpf.value.trim()) details.push('CPF: ' + cpf.value.trim());
    if (email.value.trim()) details.push('E-mail: ' + email.value.trim());
    if (details.length) lines.push('', 'Dados do cliente:', ...details);
    preview.value = lines.join('\n');
    var ready = Boolean(config);
    link.classList.toggle('disabled', !ready);
    link.setAttribute('aria-disabled', String(!ready));
    if (ready) link.href = 'https://wa.me/' + config.phone + '?text=' + encodeURIComponent(preview.value);
    else link.removeAttribute('href');
  }

  try {
    name.value = localStorage.getItem('nome') || localStorage.getItem('name') || '';
    cpf.value = localStorage.getItem('cpf') || localStorage.getItem('document') || '';
    email.value = localStorage.getItem('email') || '';
  } catch (err) {
    console.error('[support] Não foi possível ler os dados cadastrados.', err);
    storageError = 'Não foi possível preencher os dados da conta. Informe-os nos campos abaixo, se desejar.';
  }
  [subject, name, cpf, email].forEach(function (field) {
    field.addEventListener('input', updateMessage);
  });
  link.addEventListener('click', function (event) {
    updateMessage();
    if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });
  updateMessage();

  async function load() {
    config = null;
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    link.classList.add('disabled');
    status.className = storageError ? 'status error' : 'status';
    status.textContent = storageError;
    document.getElementById('contact-phone').textContent = 'Carregando contato...';
    try {
      var response = await fetch('/api/support', { cache: 'no-store' });
      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('O serviço de suporte retornou uma resposta inválida (HTTP ' + response.status + ').');
      }
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o contato.');
      if (!data.config) {
        document.getElementById('contact-phone').textContent = 'Contato ainda não cadastrado';
        status.textContent = 'O atendimento ainda não foi configurado. Volte mais tarde.';
        return;
      }
      document.getElementById('contact-name').textContent = data.config.name;
      document.getElementById('contact-phone').textContent = '+' + data.config.phone;
      config = data.config;
      updateMessage();
    } catch (err) {
      console.error('[support] Não foi possível carregar o contato.', err);
      document.getElementById('contact-phone').textContent = 'Contato indisponível';
      status.className = 'status error';
      status.textContent = 'Não foi possível carregar o contato de suporte. Recarregue a página para tentar novamente.';
    } finally {
      updateMessage();
    }
  }
  load();
})();
