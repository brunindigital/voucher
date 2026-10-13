'use strict';
/*
 * POST /api/pix
 * Chamado por js/checkout-shared.js. Cria a cobrança PIX na AllowPay.
 * Request  : { upKey, nome, cpf, email, phone, ... }
 * Response : { success, qrcode, txnId, amount }   (amount em REAIS)
 */
var ap = require('./_lib/allowpay');
var utmify = require('./_lib/utmify');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // corpo: a Vercel já parseia JSON em req.body; fallback se vier string
  var b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  var upKey = String(b.upKey || '').trim();
  var product = ap.PRODUCTS[upKey];
  if (!product) {
    return res.status(400).json({ success: false, error: 'Produto invalido.' });
  }

  // PREÇO vem do servidor, nunca do cliente
  var amountReais = product.price;
  var amountCents = Math.round(amountReais * 100);

  // Dados do cliente (sanitizados). CPF/telefone com fallback válido p/ não ser rejeitado.
  var name = String(b.nome || '').trim() || 'Cliente SuperSim';
  var email = String(b.email || '').trim();
  if (!email || email.indexOf('@') === -1) email = 'cliente+' + Date.now() + '@supersim-pay.com';

  var cellphone = ap.normalizeCellphone(b.phone);

  var cpf = ap.onlyDigits(b.cpf);
  if (!ap.isValidCPF(cpf)) cpf = ap.generateCPF();

  // webhook: só em HTTPS público (a AllowPay recusa URL interna). Em local, cai no polling.
  var proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  var host = req.headers['x-forwarded-host'] || req.headers.host || '';
  var webhookUrl = '';
  if (proto === 'https' && host && host.indexOf('localhost') === -1 && host.indexOf('127.0.0.1') === -1) {
    webhookUrl = 'https://' + host + '/api/webhook-allowpay';
  }

  try {
    var out = await ap.createPix({
      amountCents: amountCents,
      description: product.name,
      customer: { name: name, email: email, cellphone: cellphone, taxId: cpf },
      webhookUrl: webhookUrl,
      webhookSecret: webhookUrl ? ap.WEBHOOK_SECRET : '',
    });

    var d = out.data || {};
    if (out.httpStatus !== 200 || !d.txid || !d.pix_code || !d.route) {
      // repassa o motivo pra logs, mas responde genérico pro cliente
      console.error('[api/pix] AllowPay falhou', out.httpStatus, JSON.stringify(d));
      return res.status(502).json({ success: false, error: d.error || 'Falha ao gerar o PIX.' });
    }

    var createdAtMs = Date.now();

    // UTMify: registra o pedido como "waiting_payment".
    // Precisa de await: em serverless a função é congelada assim que a resposta é enviada,
    // então promessa não-aguardada morre antes de completar. Falha aqui nunca impede o PIX.
    // orderId = txid da AllowPay (o /api/utmify-paid usa o MESMO id pra dar upsert em "paid").
    try {
      var order = utmify.buildOrder({
        orderId: d.txid,
        status: 'waiting_payment',
        createdAtMs: createdAtMs,
        product: { id: upKey, name: product.name, priceCents: amountCents },
        customer: { name: name, email: email, phone: cellphone, document: cpf },
        utms: b.utms,
        ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
      });
      var ur = await utmify.sendOrder(order);
      if (ur.httpStatus !== 200) console.error('[api/pix] UTMify waiting falhou', ur.httpStatus, JSON.stringify(ur.data));
    } catch (e) { console.error('[api/pix] UTMify erro', e && e.message); }

    return res.status(200).json({
      success: true,
      qrcode: d.pix_code,                                       // copia-e-cola (o front gera o QR local)
      txnId: ap.encodeTxnId(d.route, d.txid, createdAtMs),      // carrega route+txid+createdAt
      amount: amountReais,                                       // REAIS (front formata com 2 casas)
    });
  } catch (err) {
    console.error('[api/pix] erro', err && err.message);
    return res.status(500).json({ success: false, error: 'Erro interno ao gerar o PIX.' });
  }
};
