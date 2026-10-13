'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var handler = require('../supersim6/api/support');

test('support API: persistence, authentication, validation and explicit failures', async function () {
  var originalFetch = global.fetch;
  var originalEnv = {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    password: process.env.SUPPORT_ADMIN_PASSWORD
  };
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.SUPPORT_ADMIN_PASSWORD = 'test-password-at-least-16';
  var stored = null;
  var attempts = 0;
  global.fetch = async function (url, options) {
    assert.equal(url, process.env.UPSTASH_REDIS_REST_URL);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    var command = JSON.parse(options.body);
    var result;
    if (command[0] === 'GET') result = stored;
    else if (command[0] === 'SET') { stored = command[2]; result = 'OK'; }
    else if (command[0] === 'EVAL') result = ++attempts;
    else assert.fail('Unexpected Redis command');
    return { ok: true, json: async function () { return { result: result }; } };
  };
  async function call(method, body, password) {
    var response = { code: 200, headers: {}, setHeader: function (key, value) { this.headers[key] = value; },
      status: function (code) { this.code = code; return this; }, json: function (data) { this.data = data; return this; } };
    await handler({ method: method, body: body, headers: { authorization: password ? 'Bearer ' + password : '' } }, response);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    return response;
  }
  try {
    assert.equal((await call('GET')).data.config, null);
    assert.equal((await call('PUT', {}, 'wrong')).code, 401);
    var pass = process.env.SUPPORT_ADMIN_PASSWORD;
    assert.equal((await call('POST', undefined, pass)).data.ok, true);
    assert.equal((await call('PUT', { phone: 'abc5511999999999', name: 'Suporte', message: 'Oi' }, pass)).code, 400);
    assert.equal((await call('PUT', { phone: '123', name: 'Suporte', message: 'Oi' }, pass)).code, 400);
    assert.equal((await call('PUT', { phone: '+55 11 99999-9999', name: '', message: 'Oi' }, pass)).code, 400);
    assert.equal((await call('PUT', { phone: '+55 11 99999-9999', name: 'Suporte', message: 'a'.repeat(501) }, pass)).code, 400);
    var saved = await call('PUT', { phone: '+55 (11) 99999-9999', name: ' Suporte ', message: ' Olá! ' }, pass);
    assert.equal(saved.code, 200);
    assert.equal(saved.data.config.phone, '5511999999999');
    assert.equal(saved.data.config.name, 'Suporte');
    assert.equal(saved.data.config.message, 'Olá!');
    assert.ok(saved.data.config.updatedAt);
    assert.deepEqual((await call('GET')).data.config, saved.data.config);
    await call('PUT', { phone: '+55 21 98888-8888', name: 'Equipe', message: 'Ajuda' }, pass);
    assert.equal((await call('GET')).data.config.phone, '5521988888888');
    assert.equal((await call('DELETE')).code, 405);
    attempts = 30;
    assert.equal((await call('POST', undefined, pass)).code, 429);
    process.env.SUPPORT_ADMIN_PASSWORD = '';
    assert.equal((await call('PUT', {}, pass)).code, 503);
    stored = '{invalid';
    assert.equal((await call('GET')).code, 503);
    global.fetch = async function () { throw new Error('offline'); };
    assert.equal((await call('GET')).code, 503);
  } finally {
    global.fetch = originalFetch;
    Object.entries({ UPSTASH_REDIS_REST_URL: originalEnv.url, UPSTASH_REDIS_REST_TOKEN: originalEnv.token, SUPPORT_ADMIN_PASSWORD: originalEnv.password }).forEach(function (entry) {
      if (entry[1] === undefined) delete process.env[entry[0]];
      else process.env[entry[0]] = entry[1];
    });
  }
});
