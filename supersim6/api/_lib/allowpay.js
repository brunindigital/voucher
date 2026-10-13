'use strict';
/*
 * AllowPay — helpers compartilhados (roda SÓ no servidor, nunca no navegador).
 * A api_key vive aqui/no ambiente do servidor e nunca é enviada ao cliente.
 */

var BASE = process.env.ALLOWPAY_BASE_URL || 'https://allow-gi0i.onrender.com';

// A chave vem EXCLUSIVAMENTE da variável de ambiente ALLOWPAY_API_KEY.
// Defina-a no painel da Vercel (Settings → Environment Variables). Sem ela, a API de
// pagamento responde erro de autenticação.
var API_KEY = process.env.ALLOWPAY_API_KEY || '';

// Segredo do webhook (assina o POST que a AllowPay manda de volta). Opcional, mas recomendado.
var WEBHOOK_SECRET = process.env.ALLOWPAY_WEBHOOK_SECRET || '';

/* ───────── Tabela de produtos (autoridade do PREÇO fica no servidor) ─────────
   Espelha PIX_PRODUCTS de js/checkout-shared.js. Preço em REAIS.
   O cliente manda só o upKey; o valor NUNCA vem do cliente (evita adulteração). */
var PRODUCTS = {
  seguro: { price: 19.48, name: 'Seguro Prestamista - SuperSim' },
  up1:  { price: 24.82, name: 'IOF - Imposto sobre Operacoes Financeiras' },
  up2:  { price: 23.91, name: 'Taxa de Verificacao de IOF' },
  up3:  { price: 18.68, name: 'Seguro Prestamista - Tarifa de Cadastro' },
  up4:  { price: 17.20, name: 'TENF - Taxa de Emissao da Nota Fiscal' },
  up5:  { price: 17.00, name: 'Ativar Conta' },
  up6:  { price: 17.02, name: 'Taxa de Registro do Contrato' },
  up7:  { price: 14.06, name: 'Taxa - Limite Adicional de R$20.000' },
  up8:  { price: 14.06, name: 'Taxa de Processamento' },
  up9:  { price: 11.99, name: 'Aplicativo SuperSim' },
  up10: { price: 16.92, name: 'TAC - Taxa de Abertura de Credito' },
  up11: { price: 19.53, name: 'Taxa de Consultoria Financeira' },
  up12: { price: 31.92, name: 'Taxa de Processamento Administrativo' },
  // Downsell (50% OFF)
  seguro_ds: { price: 9.74, name: 'Seguro Prestamista - SuperSim' },
  up1_ds:  { price: 12.41, name: 'IOF - Imposto sobre Operacoes Financeiras' },
  up2_ds:  { price: 11.96, name: 'Taxa de Verificacao de IOF' },
  up3_ds:  { price: 9.34,  name: 'Seguro Prestamista - Tarifa de Cadastro' },
  up4_ds:  { price: 8.60,  name: 'TENF - Taxa de Emissao da Nota Fiscal' },
  up5_ds:  { price: 8.50,  name: 'Ativar Conta' },
  up6_ds:  { price: 8.50,  name: 'Taxa de Registro do Contrato' },
  up7_ds:  { price: 7.03,  name: 'Taxa - Limite Adicional de R$20.000' },
  up8_ds:  { price: 7.03,  name: 'Taxa de Processamento' },
  up9_ds:  { price: 6.00,  name: 'Aplicativo SuperSim' },
  up10_ds: { price: 8.46,  name: 'TAC - Taxa de Abertura de Credito' },
  up11_ds: { price: 9.77,  name: 'Taxa de Consultoria Financeira' },
  up12_ds: { price: 15.96, name: 'Taxa de Processamento Administrativo' },
};

/* ───────── CPF: validação + geração de fallback válido ───────── */
function onlyDigits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

function isValidCPF(cpf) {
  cpf = onlyDigits(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // rejeita 00000000000, 11111111111, ...
  var i, sum = 0, d1, d2;
  for (i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  d1 = 11 - (sum % 11); if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  d2 = 11 - (sum % 11); if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

function generateCPF() {
  var n = [], i, d1 = 0, d2 = 0;
  for (i = 0; i < 9; i++) n.push(Math.floor(Math.random() * 10));
  for (i = 0; i < 9; i++) d1 += n[i] * (10 - i);
  d1 = 11 - (d1 % 11); if (d1 >= 10) d1 = 0; n.push(d1);
  for (i = 0; i < 10; i++) d2 += n[i] * (11 - i);
  d2 = 11 - (d2 % 11); if (d2 >= 10) d2 = 0; n.push(d2);
  return n.join('');
}

/* Telefone BR: só dígitos com DDD. Fallback se vier vazio/curto. */
function normalizeCellphone(phone) {
  var d = onlyDigits(phone);
  if (d.indexOf('55') === 0 && d.length > 11) d = d.slice(2); // tira DDI 55 se veio junto
  if (d.length < 10 || d.length > 11) return '11999999999';
  return d;
}

/* ───────── txnId opaco: carrega route + txid (+ createdAt) (stateless, sem banco) ─────────
   O front trata txnId como caixa-preta e devolve no /api/status e no /api/utmify-paid.
   O createdAt (ms) viaja junto p/ o UTMify ter a data real da criação no update "paid". */
function encodeTxnId(route, txid, createdAtMs) {
  var payload = { r: route, t: txid };
  if (createdAtMs) payload.c = createdAtMs;
  var raw = JSON.stringify(payload);
  return Buffer.from(raw, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeTxnId(txnId) {
  try {
    var b64 = String(txnId).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var obj = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    if (obj && obj.r && obj.t) return { route: obj.r, txid: obj.t, createdAt: obj.c || null };
  } catch (e) {}
  return null;
}

/* ───────── Chamadas à AllowPay ───────── */
async function createPix(opts) {
  // opts: { amountCents, description, customer:{name,email,cellphone,taxId}, webhookUrl, webhookSecret }
  var body = {
    api_key: API_KEY,
    amount: opts.amountCents,
    description: opts.description || undefined,
    customer: {
      name: opts.customer.name,
      email: opts.customer.email,
      cellphone: opts.customer.cellphone,
      taxId: opts.customer.taxId,
    },
  };
  if (opts.webhookUrl) {
    body.webhook_url = opts.webhookUrl;
    if (opts.webhookSecret) body.webhook_secret = opts.webhookSecret;
  }
  // IMPORTANTE: nunca enviar "route" — deixa a AllowPay escolher (preferida + fallback).
  var resp = await fetch(BASE + '/api/v2/allowpay-seller/create-pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  var data = await resp.json().catch(function () { return {}; });
  return { httpStatus: resp.status, data: data };
}

async function paymentStatus(route, txid) {
  var url = BASE + '/api/v2/allowpay-seller/payment-status/' +
    encodeURIComponent(txid) + '?route=' + encodeURIComponent(route);
  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: API_KEY }),
  });
  var data = await resp.json().catch(function () { return {}; });
  return { httpStatus: resp.status, data: data };
}

module.exports = {
  API_KEY: API_KEY,
  WEBHOOK_SECRET: WEBHOOK_SECRET,
  PRODUCTS: PRODUCTS,
  onlyDigits: onlyDigits,
  isValidCPF: isValidCPF,
  generateCPF: generateCPF,
  normalizeCellphone: normalizeCellphone,
  encodeTxnId: encodeTxnId,
  decodeTxnId: decodeTxnId,
  createPix: createPix,
  paymentStatus: paymentStatus,
};
