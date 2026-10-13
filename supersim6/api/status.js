'use strict';
/*
 * GET /api/status?id=<txnId>
 * Chamado pelo polling do checkout. Decodifica route+txid do txnId e consulta a AllowPay.
 * Response : { paid: boolean, status: "<status AllowPay>" }
 */
var ap = require('./_lib/allowpay');

module.exports = async function handler(req, res) {
  var id = (req.query && req.query.id) || '';
  if (!id) {
    // fallback: alguns runtimes não populam req.query
    try {
      var u = new URL(req.url, 'http://x');
      id = u.searchParams.get('id') || '';
    } catch (e) {}
  }
  if (!id) return res.status(400).json({ paid: false, error: 'id ausente.' });

  var dec = ap.decodeTxnId(id);
  if (!dec) return res.status(400).json({ paid: false, error: 'id invalido.' });

  try {
    var out = await ap.paymentStatus(dec.route, dec.txid);
    var status = (out.data && out.data.status) || 'unknown';
    // "approved" = pago. Qualquer outro != waiting_payment = encerrado (mas só liberamos no approved).
    return res.status(200).json({ paid: status === 'approved', status: status });
  } catch (err) {
    console.error('[api/status] erro', err && err.message);
    return res.status(200).json({ paid: false, status: 'error' }); // não quebra o polling
  }
};
