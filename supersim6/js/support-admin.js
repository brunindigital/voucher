'use strict';

(function () {
  var password = '';
  var demo = false;
  var login = document.getElementById('login-form');
  var form = document.getElementById('settings-form');
  var status = document.getElementById('admin-status');
  var name = document.getElementById('support-name');
  var phone = document.getElementById('support-phone');
  var message = document.getElementById('support-message');
  var loginButton = document.getElementById('login-button');
  var saveButton = document.getElementById('save-button');

  function notify(text, error) {
    status.className = 'status ' + (error ? 'error' : 'success');
    status.textContent = text;
  }
  function logout() {
    password = '';
    demo = false;
    document.getElementById('demo-notice').hidden = true;
    saveButton.textContent = 'Salvar alterações →';
    login.reset();
    login.hidden = false;
    form.hidden = true;
    notify('', false);
    document.getElementById('admin-password').focus();
  }
  async function request(method, body) {
    var response = await fetch('/api/support', {
      method: method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + password },
      body: body ? JSON.stringify(body) : undefined
    });
    var data = await response.json();
    if (!response.ok) {
      if (response.status === 401) logout();
      throw new Error(data.error || 'Não foi possível concluir a operação.');
    }
    return data;
  }
  function preview() {
    var digits = phone.value.replace(/\D/g, '');
    var valid = /^[+\d\s().-]+$/.test(phone.value) && /^[1-9]\d{7,14}$/.test(digits);
    document.getElementById('preview-phone').textContent = valid ? '+' + digits : 'Informe um número internacional válido';
    var link = document.getElementById('preview-link');
    link.hidden = !valid;
    if (valid) link.href = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message.value);
    else link.removeAttribute('href');
    return valid;
  }
  function savedAt(value) {
    document.getElementById('saved-at').textContent = value ? 'Última alteração: ' + new Date(value).toLocaleString('pt-BR') : 'Nenhum contato publicado ainda.';
  }
  document.getElementById('demo-button').addEventListener('click', function () {
    demo = true;
    password = '';
    login.reset();
    form.reset();
    name.value = 'Central de suporte';
    message.value = 'Olá! Preciso de ajuda.';
    document.getElementById('demo-notice').hidden = false;
    document.getElementById('saved-at').textContent = 'Demonstração: alterações não são publicadas.';
    saveButton.textContent = 'Validar prévia (não publica) →';
    preview();
    login.hidden = true;
    form.hidden = false;
    notify('', false);
    name.focus();
  });
  login.addEventListener('submit', async function (event) {
    event.preventDefault();
    password = document.getElementById('admin-password').value;
    loginButton.disabled = true;
    notify('Verificando acesso...', false);
    try {
      await request('POST');
      var data = await request('GET');
      var config = data.config || { name: 'Central de suporte', phone: '', message: 'Olá! Preciso de ajuda.' };
      name.value = config.name;
      phone.value = config.phone ? '+' + config.phone : '';
      message.value = config.message;
      savedAt(config.updatedAt);
      preview();
      login.reset();
      login.hidden = true;
      form.hidden = false;
      notify('', false);
      name.focus();
    } catch (err) {
      password = '';
      notify(err.message, true);
    } finally {
      loginButton.disabled = false;
    }
  });
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!preview()) return notify('Informe um número válido com código do país e DDD.', true);
    if (demo) {
      return notify('Prévia validada. Nenhuma alteração foi salva ou publicada. Entre com a senha para atualizar o contato real.', false);
    }
    saveButton.disabled = true;
    notify('Salvando alterações...', false);
    try {
      var data = await request('PUT', { name: name.value, phone: phone.value, message: message.value });
      phone.value = '+' + data.config.phone;
      savedAt(data.config.updatedAt);
      preview();
      notify('Contato atualizado! O novo número já está disponível para todos os visitantes.', false);
    } catch (err) {
      notify(err.message, true);
    } finally {
      saveButton.disabled = false;
    }
  });
  phone.addEventListener('input', preview);
  message.addEventListener('input', preview);
  document.getElementById('logout-button').addEventListener('click', logout);
})();
