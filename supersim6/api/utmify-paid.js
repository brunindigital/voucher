'use strict';
/*
 * POST /api/utmify-paid
 * Chamado pelo checkout no instante em que o pagamento confirma (_pixFirePurchase).
 * Envia ao UTMify o mesmo pedido com status "paid" (upsert pelo orderId = txid da AllowPay).
 *
 * O token do UTMify fica SÓ aqui no servidor. O navegador só manda os dados que já possui
 * (nome/cpf/email/telefone/UTMs + o txnId opaco). Nenhum dado novo é exposto.
 *
 * Body: { txnId, upKey, nome, cpf, email, phone, utms }
 */
var ap = require('./_lib/allowpay');
var utmify = require('./_lib/utmify');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  var b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  var product = ap.PRODUCTS[String(b.upKey || '').trim()];
  var dec = ap.decodeTxnId(b.txnId);
  if (!product || !dec) {
    return res.status(400).json({ ok: false, error: 'dados invalidos' });
  }

  // reconstrói os mesmos dados do pedido (preço vem do servidor)
  var name = String(b.nome || '').trim() || 'Cliente SuperSim';
  var email = String(b.email || '').trim();
  if (!email || email.indexOf('@') === -1) email = 'cliente@supersim-pay.com';
  var phone = ap.normalizeCellphone(b.phone);
  var cpf = ap.onlyDigits(b.cpf);
  if (!ap.isValidCPF(cpf)) cpf = ap.generateCPF();

  try {
    var order = utmify.buildOrder({
      orderId: dec.txid,                       // MESMO id do waiting_payment → upsert
      status: 'paid',
      createdAtMs: dec.createdAt || Date.now(),
      approvedAtMs: Date.now(),
      product: { id: String(b.upKey).trim(), name: product.name, priceCents: Math.round(product.price * 100) },
      customer: { name: name, email: email, phone: phone, document: cpf },
      utms: b.utms,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
    });
    var r = await utmify.sendOrder(order);
    if (r.httpStatus !== 200) {
      console.error('[utmify-paid] falhou', r.httpStatus, JSON.stringify(r.data));
      return res.status(502).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[utmify-paid] erro', err && err.message);
    return res.status(500).json({ ok: false });
  }
};
