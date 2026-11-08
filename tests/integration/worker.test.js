import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../../worker/index.js';

function assets() {
  return { fetch: async () => new Response('<!doctype html><title>SG Transit</title>', { headers: { 'Content-Type': 'text/html' } }) };
}

test('Worker routes health requests to the API handler', async () => {
  const response = await handleRequest(new Request('https://example.test/api/health'), { ASSETS: assets() });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.status, 'ok');
  assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; manifest-src 'self'; worker-src 'self'");
});

test('Worker serves non-API requests through the static asset binding', async () => {
  const response = await handleRequest(new Request('https://example.test/'), { ASSETS: assets() });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /SG Transit/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('Worker returns a safe error for unknown API routes', async () => {
  const response = await handleRequest(new Request('https://example.test/api/missing'), { ASSETS: assets() });
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});
test("Worker routes service-based bus API requests", async () => { const response = await handleRequest(new Request("https://example.test/api/bus/service-arrival?service=36&stop=123"), { ASSETS: assets() }); const body = await response.json(); assert.equal(response.status, 400); assert.equal(body.error.code, "INVALID_INPUT"); });
