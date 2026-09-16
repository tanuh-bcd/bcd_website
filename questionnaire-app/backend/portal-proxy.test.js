import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createPortalProxy } from './portal-proxy.js';

async function start(server, t) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('public bridge preserves version, payload, upload and upstream errors without exposing protected routes', async t => {
  const received = [];
  const upstream = await start(http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() });
    res.writeHead(req.url === '/api/submit' ? 422 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ detail: 'upstream response' }));
  }), t);
  const proxy = await start(createPortalProxy(upstream), t);
  const questions = await fetch(`${proxy}/api/v1/patient/questions?lang=hi&version=2`, {
    headers: { authorization: 'Bearer private-token', cookie: 'session=private-cookie' },
  });
  assert.equal(questions.status, 200);
  assert.equal(received[0].url, '/api/v1/patient/questions?lang=hi&version=2');
  assert.equal(received[0].headers.authorization, undefined);
  assert.equal(received[0].headers.cookie, undefined);
  assert.equal(questions.headers.get('cache-control'), 'no-store');

  const payload = JSON.stringify({ sessionId: 'smoke', formDataEn: { V2_Q03: 35 } });
  const submitted = await fetch(`${proxy}/api/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
  assert.equal(submitted.status, 422);
  assert.equal(received[1].body, payload);
  assert.deepEqual(await submitted.json(), { detail: 'upstream response' });

  const form = new FormData();
  form.append('file', new Blob(['test consent'], { type: 'image/jpeg' }), 'consent.jpg');
  const upload = await fetch(`${proxy}/api/session/00000000-0000-4000-8000-000000000000/consent`, { method: 'POST', body: form });
  assert.equal(upload.status, 200);
  assert.match(received[2].headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.match(received[2].body, /test consent/);

  await fetch(`${proxy}/api/stats`);
  assert.equal(received[3].url, '/api/v1/stats/');
  for (const path of ['/api/v1/admin/users', '/api/v1/patient/consent', '/api/v1/auth/login']) {
    assert.equal((await fetch(`${proxy}${path}`, { method: 'POST' })).status, 404);
  }
  assert.equal(received.length, 4);
});

test('unavailable upstream returns a retryable error, never legacy content', async t => {
  const upstreamServer = http.createServer();
  const upstream = await start(upstreamServer, t);
  await new Promise(resolve => upstreamServer.close(resolve));
  const proxy = await start(createPortalProxy(upstream), t);
  const response = await fetch(`${proxy}/api/participant-information?version=2`);
  assert.equal(response.status, 502);
  assert.match((await response.json()).detail, /unavailable/);
});
