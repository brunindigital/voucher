'use strict';

var crypto = require('crypto');
var CONFIG_KEY = 'support:config:v1';

function validConfig(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.phone !== 'string' || !/^[+\d\s().-]+$/.test(value.phone)) return null;
  var phone = value.phone.replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(phone)) return null;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80) return null;
  if (typeof value.message !== 'string' || !value.message.trim() || value.message.trim().length > 500) return null;
  return { phone: phone, name: value.name.trim(), message: value.message.trim() };
}

async function redis(command) {
  var endpoint = process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) throw new Error('Armazenamento do suporte nao configurado.');
  var response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Falha na conexao com o armazenamento.');
  var data = await response.json();
  if (data.error) throw new Error('Falha no comando do armazenamento.');
  return data.result;
}

function authenticated(req) {
  var header = req.headers.authorization || '';
  var supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  var expected = process.env.SUPPORT_ADMIN_PASSWORD;
  return supplied.length > 0 && crypto.timingSafeEqual(
    crypto.createHash('sha256').update(supplied).digest(),
    crypto.createHash('sha256').update(expected).digest()
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }
  try {
    if (req.method !== 'GET') {
      if (!process.env.SUPPORT_ADMIN_PASSWORD || process.env.SUPPORT_ADMIN_PASSWORD.length < 16) {
        console.error('[api/support] Defina SUPPORT_ADMIN_PASSWORD com pelo menos 16 caracteres.');
        return res.status(503).json({ error: 'Painel ainda nao configurado pelo administrador.' });
      }
      // Vercel provides this header; the local server uses the socket address.
      var address = req.headers['x-vercel-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'local';
      var key = 'support:auth:' + crypto.createHash('sha256').update(address).digest('hex');
      var attempts = await redis(['EVAL',
        'local n = redis.call("INCR", KEYS[1]); if n == 1 then redis.call("EXPIRE", KEYS[1], 900) end; return n',
        1, key]);
      if (attempts > 30) {
        res.setHeader('Retry-After', '900');
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.' });
      }
      if (!authenticated(req)) return res.status(401).json({ error: 'Senha incorreta.' });
      if (req.method === 'POST') return res.status(200).json({ ok: true });
      var config = validConfig(req.body);
      if (!config) return res.status(400).json({ error: 'Informe nome, numero internacional valido (8 a 15 digitos) e mensagem de ate 500 caracteres.' });
      config.updatedAt = new Date().toISOString();
      await redis(['SET', CONFIG_KEY, JSON.stringify(config)]);
      return res.status(200).json({ config: config });
    }
    var stored = await redis(['GET', CONFIG_KEY]);
    if (!stored) return res.status(200).json({ config: null });
    var parsed = JSON.parse(stored);
    var clean = validConfig(parsed);
    if (!clean) throw new Error('Configuracao salva invalida.');
    return res.status(200).json({ config: Object.assign(clean, { updatedAt: parsed.updatedAt }) });
  } catch (err) {
    console.error('[api/support]', err.message);
    return res.status(503).json({ error: 'Suporte temporariamente indisponivel. Tente novamente mais tarde.' });
  }
};
