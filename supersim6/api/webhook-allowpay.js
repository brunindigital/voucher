'use strict';
/*
 * POST /api/webhook-allowpay
 * Recebe a confirmação da AllowPay (payment.approved etc.).
 * Valida a assinatura HMAC-SHA256 do CORPO BRUTO com ALLOWPAY_WEBHOOK_SECRET.
 * Responde 2xx pra confirmar o recebimento.
 *
 * OBS: o checkout já confirma o pagamento via polling do /api/status, então o
 * webhook aqui é reconciliação/futuro (ex.: disparar Purchase server-side, dar baixa
 * num banco). Mantido simples e seguro por padrão.
 */
var crypto = require('crypto');
var ap = require('./_lib/allowpay');

// precisamos do corpo BRUTO pra validar a assinatura → desliga o parser da Vercel
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  var ba = Buffer.from(a, 'utf8');
  var bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  var raw;
  try { raw = await readRawBody(req); } catch (e) { return res.status(400).json({ ok: false }); }
  var rawStr = raw.toString('utf8');

  // valida assinatura (se houver segredo configurado)
  if (ap.WEBHOOK_SECRET) {
    var sig = req.headers['x-allowpay-signature'] || '';
    var expected = 'sha256=' + crypto.createHmac('sha256', ap.WEBHOOK_SECRET).update(raw, 'utf8').digest('hex');
    if (!sig || !safeEqual(sig, expected)) {
      console.error('[webhook] assinatura invalida');
      return res.status(401).json({ ok: false, error: 'assinatura invalida' });
    }
  }

  var evt = {};
  try { evt = JSON.parse(rawStr); } catch (e) { return res.status(400).json({ ok: false }); }

  // idempotência: aqui você ignoraria event_id já processado (precisa de storage p/ isso).
  console.log('[webhook] evento', evt.event, 'txid', evt.txid, 'status', evt.status, 'event_id', evt.event_id);

  // Ex.: if (evt.event === 'payment.approved') { /* dar baixa / disparar CAPI Purchase */ }

  return res.status(200).json({ ok: true });
};
