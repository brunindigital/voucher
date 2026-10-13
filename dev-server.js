'use strict';
/*
 * Servidor de DEV local — NÃO vai pro deploy (fica fora de supersim6/).
 * Serve os arquivos estáticos de supersim6/ e executa as funções /api/* com um
 * shim mínimo de req/res compatível com a Vercel. Permite testar a AllowPay de verdade
 * sem precisar de `vercel dev`/login.
 *
 * Uso:  node dev-server.js   →  http://localhost:4321
 */
var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var ROOT = path.join(__dirname, 'supersim6');
var PORT = process.env.PORT || 4321;

var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

// carrega as funções serverless
var handlers = {
  '/api/support': require('./supersim6/api/support.js'),
  '/api/pix': require('./supersim6/api/pix.js'),
  '/api/status': require('./supersim6/api/status.js'),
  '/api/utmify-paid': require('./supersim6/api/utmify-paid.js'),
  '/api/webhook-allowpay': require('./supersim6/api/webhook-allowpay.js'),
};

function makeRes(res) {
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (obj) {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function serveStatic(req, res, pathname) {
  var rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  var fp = path.join(ROOT, rel);
  // clean URL: /analise-ia → analise-ia.html ; /up1 → up1/index.html
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) {
      fp = path.join(fp, 'index.html');
    } else if (fs.existsSync(fp + '.html')) {
      fp = fp + '.html';
    } else if (fs.existsSync(path.join(ROOT, rel, 'index.html'))) {
      fp = path.join(ROOT, rel, 'index.html');
    }
  }
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.statusCode = 404; res.end('404'); return;
  }
  var ext = path.extname(fp).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(fp).pipe(res);
}

var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  var pathname = parsed.pathname;
  makeRes(res);

  var handler = handlers[pathname];
  if (handler) {
    req.query = parsed.query;
    // webhook precisa do stream bruto (bodyParser off) — passa direto
    if (pathname === '/api/webhook-allowpay') {
      Promise.resolve(handler(req, res)).catch(function (e) {
        console.error(e); if (!res.headersSent) res.status(500).json({ ok: false });
      });
      return;
    }
    // demais: pré-parse do body JSON (como a Vercel faz)
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8');
      if (raw) { try { req.body = JSON.parse(raw); } catch (e) { req.body = raw; } }
      Promise.resolve(handler(req, res)).catch(function (e) {
        console.error(e); if (!res.headersSent) res.status(500).json({ success: false, error: 'erro' });
      });
    });
    return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, function () {
  console.log('DEV server em http://localhost:' + PORT + '  (root: supersim6/)');
});
