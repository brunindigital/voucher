'use strict';
/*
 * UTMify — Orders API (server-side). O token fica SÓ no servidor.
 * Doc de comportamento (confirmado em teste):
 *  - POST https://api.utmify.com.br/api-credentials/orders  (header x-api-token)
 *  - upsert por orderId: mesma orderId em "waiting_payment" e depois "paid" ATUALIZA a ordem.
 *  - o payload precisa vir COMPLETO em toda chamada (customer, products, trackingParameters, commission).
 *  - datas em UTC no formato "YYYY-MM-DD HH:MM:SS".
 */
var ap = require('./allowpay');

var UTMIFY_URL = process.env.UTMIFY_URL || 'https://api.utmify.com.br/api-credentials/orders';
var UTMIFY_TOKEN = process.env.UTMIFY_API_TOKEN || '';
var IS_TEST = String(process.env.UTMIFY_TEST || '') === '1';

// Date -> "YYYY-MM-DD HH:MM:SS" em UTC
function toUtc(ms) {
  return new Date(ms || Date.now()).toISOString().replace('T', ' ').slice(0, 19);
}

// normaliza o objeto de UTMs (getUtms do front) p/ o formato do UTMify (todas as chaves presentes, string|null)
function trackingFrom(utms) {
  utms = utms || {};
  function v(x) { return (x === undefined || x === '' ? null : x); }
  return {
    src: v(utms.src),
    sck: v(utms.sck),
    utm_source: v(utms.utm_source),
    utm_campaign: v(utms.utm_campaign),
    utm_medium: v(utms.utm_medium),
    utm_content: v(utms.utm_content),
    utm_term: v(utms.utm_term),
  };
}

/*
 * Monta o payload completo do pedido.
 * opts: { orderId, status, createdAtMs, approvedAtMs, product:{id,name,priceCents}, customer:{name,email,phone,document}, utms, ip }
 */
function buildOrder(opts) {
  var priceCents = opts.product.priceCents;
  var customer = {
    name: opts.customer.name || 'Cliente SuperSim',
    email: opts.customer.email,
    phone: opts.customer.phone || null,
    document: opts.customer.document || null,
    country: 'BR',
  };
  // UTMify recusa customer.ip === null → só inclui se houver IP de verdade.
  if (opts.ip) customer.ip = opts.ip;
  return {
    orderId: opts.orderId,
    platform: 'SuperSim',
    paymentMethod: 'pix',
    status: opts.status, // "waiting_payment" | "paid"
    createdAt: toUtc(opts.createdAtMs),
    approvedDate: opts.status === 'paid' ? toUtc(opts.approvedAtMs) : null,
    refundedAt: null,
    customer: customer,
    products: [{
      id: opts.product.id,
      name: opts.product.name,
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: priceCents,
    }],
    trackingParameters: trackingFrom(opts.utms),
    commission: {
      totalPriceInCents: priceCents,
      gatewayFeeInCents: 0,
      userCommissionInCents: priceCents,
      currency: 'BRL',
    },
    isTest: IS_TEST,
  };
}

async function sendOrder(payload) {
  var resp = await fetch(UTMIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': UTMIFY_TOKEN },
    body: JSON.stringify(payload),
  });
  var data = await resp.json().catch(function () { return {}; });
  return { httpStatus: resp.status, data: data };
}

module.exports = {
  buildOrder: buildOrder,
  sendOrder: sendOrder,
  toUtc: toUtc,
  trackingFrom: trackingFrom,
};
