import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as busArrivals } from '../../functions/api/bus/arrivals.js';
import { clearBusCache } from '../../functions/_lib/lta.js';
import { onRequestGet as health } from '../../functions/api/health.js';
import { onRequestGet as trainArrivals } from '../../functions/api/train/arrivals.js';
import { onRequestGet as trainStations } from '../../functions/api/train/stations.js';

test('health never exposes configuration', async () => {
  const response = health(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.success, true); assert.equal(JSON.stringify(body).includes('ACCOUNT'), false);
});

test('bus arrivals validates before an upstream call', async () => {
  const originalFetch = globalThis.fetch; let called = false; globalThis.fetch = async () => { called = true; throw new Error('should not call'); };
  try { const response = await busArrivals({ request: new Request('https://example.test/api/bus/arrivals?stop=123'), env: { LTA_ACCOUNT_KEY: 'test' } }); const body = await response.json(); assert.equal(response.status, 400); assert.equal(body.error.code, 'INVALID_INPUT'); assert.equal(called, false); } finally { globalThis.fetch = originalFetch; }
});

test('train endpoints enforce canonical station-code queries', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('should not call'); };
  try {
    const arrivalsResponse = await trainArrivals({ request: new Request('https://example.test/api/train/arrivals?station=Woodlands'), env: { LTA_ACCOUNT_KEY: 'test' } });
    const arrivalsBody = await arrivalsResponse.json();
    assert.equal(arrivalsResponse.status, 400);
    assert.equal(arrivalsBody.error.code, 'INVALID_INPUT');
    const interchangeResponse = await trainArrivals({ request: new Request('https://example.test/api/train/arrivals?station=NS9,TE2'), env: { LTA_ACCOUNT_KEY: 'test' } });
    const interchangeBody = await interchangeResponse.json();
    assert.equal(interchangeResponse.status, 400);
    assert.equal(interchangeBody.error.code, 'INVALID_INPUT');
    const stationsResponse = await trainStations({ request: new Request('https://example.test/api/train/stations?search=NS9'), env: { LTA_ACCOUNT_KEY: 'test' } });
    const stationsBody = await stationsResponse.json();
    assert.equal(stationsResponse.status, 400);
    assert.equal(stationsBody.error.code, 'INVALID_INPUT');
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bus arrivals transforms the three LTA prediction slots', async () => {
  clearBusCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    const url = String(request.url ?? request);
    if (url.includes('BusStops')) return new Response(JSON.stringify({ value: [] }), { status: 200 });
    return new Response(JSON.stringify({ Services: [{ ServiceNo: '36A', Operator: 'GAS', NextBus: { EstimatedArrival: '2026-11-02T01:00:00+00:00', Load: 'SEA', Feature: 'WAB' }, NextBus2: {}, NextBus3: null }] }), { status: 200 });
  };
  try {
    const response = await busArrivals({ request: new Request('https://example.test/api/bus/arrivals?stop=01012&service=36a'), env: { LTA_ACCOUNT_KEY: 'test' } });
    const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.data.services[0].serviceNo, '36A'); assert.equal(body.data.services[0].arrivals[0].wheelchairAccessible, true);
  } finally { globalThis.fetch = originalFetch; clearBusCache(); }
});
