import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as busArrivals } from '../../functions/api/bus/arrivals.js';
import { onRequestGet as health } from '../../functions/api/health.js';

test('health never exposes configuration', async () => {
  const response = health(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.success, true); assert.equal(JSON.stringify(body).includes('ACCOUNT'), false);
});

test('bus arrivals validates before an upstream call', async () => {
  const originalFetch = globalThis.fetch; let called = false; globalThis.fetch = async () => { called = true; throw new Error('should not call'); };
  try { const response = await busArrivals({ request: new Request('https://example.test/api/bus/arrivals?stop=123'), env: { LTA_ACCOUNT_KEY: 'test' } }); const body = await response.json(); assert.equal(response.status, 400); assert.equal(body.error.code, 'INVALID_INPUT'); assert.equal(called, false); } finally { globalThis.fetch = originalFetch; }
});

test('bus arrivals transforms the three LTA prediction slots', async () => {
  const originalFetch = globalThis.fetch; globalThis.fetch = async () => new Response(JSON.stringify({ Services: [{ ServiceNo: '36A', Operator: 'GAS', NextBus: { EstimatedArrival: '2026-11-02T01:00:00+00:00', Load: 'SEA', Feature: 'WAB' }, NextBus2: {}, NextBus3: null }] }), { status: 200 });
  try { const response = await busArrivals({ request: new Request('https://example.test/api/bus/arrivals?stop=01012&service=36a'), env: { LTA_ACCOUNT_KEY: 'test' } }); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.data.services[0].serviceNo, '36A'); assert.equal(body.data.services[0].arrivals[0].wheelchairAccessible, true); } finally { globalThis.fetch = originalFetch; }
});
