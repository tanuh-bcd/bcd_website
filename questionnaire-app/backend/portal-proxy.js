// Public API bridge: both websites use the portal's versioned content, scoring
// and response database. No portal login or clinician routes are exposed here.
import http from 'node:http';
import https from 'node:https';
import { pathToFileURL } from 'node:url';

const readPaths = new Set([
  '/api/participant-information',
  '/api/v1/patient/questions',
  '/api/v1/auth/hospitals',
  '/api/v1/stats/',
  '/api/v1/stats/hospital-locations',
  '/api/v1/mammogram/portal-stats',
  '/api/v1/risk-categories/',
]);

export function createPortalProxy(origin) {
  const upstream = new URL(origin);
  if (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password
    || upstream.pathname !== '/' || upstream.search || upstream.hash) {
    throw new Error('PORTAL_API_ORIGIN must be an HTTP(S) origin without credentials or a path.');
  }
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://research.local');
    if (req.method === 'GET' && ['/health', '/api/health'].includes(url.pathname)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true, mode: 'shared-portal' }));
      return;
    }
    // Keep the existing deployment's dashboard health probe working.
    if (url.pathname === '/api/stats') url.pathname = '/api/v1/stats/';
    const allowed = (req.method === 'GET' && readPaths.has(url.pathname))
      || (req.method === 'POST' && (['/api/session/start', '/api/submit'].includes(url.pathname)
        || /^\/api\/session\/[a-f0-9-]{36}\/consent$/i.test(url.pathname)));
    if (!allowed) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Public API route not found.' }));
      return;
    }

    const target = new URL(url.pathname + url.search, upstream);
    const headers = { accept: 'application/json', 'accept-encoding': 'identity' };
    for (const name of ['content-type', 'content-length']) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    // The loopback-bound service is reached through the trusted Apache proxy.
    headers['x-forwarded-for'] = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(target, { method: req.method, headers }, response => {
      const responseHeaders = { 'cache-control': 'no-store' };
      if (response.headers['content-type']) responseHeaders['content-type'] = response.headers['content-type'];
      res.writeHead(response.statusCode, responseHeaders);
      response.pipe(res);
    });
    request.setTimeout(60_000, () => request.destroy(new Error('Portal API timed out')));
    request.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ detail: 'The questionnaire service is unavailable. Please try again.' }));
      } else res.destroy();
    });
    req.on('aborted', () => request.destroy());
    res.on('close', () => { if (!res.writableEnded) request.destroy(); });
    req.pipe(request);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.PORTAL_API_ORIGIN) throw new Error('Set PORTAL_API_ORIGIN to the shared portal backend origin.');
  const port = Number(process.env.PORT || 3001);
  createPortalProxy(process.env.PORTAL_API_ORIGIN).listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log(`Research public API bridge listening on port ${port}`);
  });
}
