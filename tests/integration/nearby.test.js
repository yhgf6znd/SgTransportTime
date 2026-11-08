import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as nearby } from '../../functions/api/nearby.js';

function request(type) {
  return new Request(`https://example.test/api/nearby?type=${type}&lat=1.405&lon=103.901&radius=500`);
}

test('nearby requires an explicit transport type', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('should not call'); };
  try {
    const response = await nearby({ request: new Request('https://example.test/api/nearby?lat=1.405&lon=103.901'), env: { ONEMAP_TOKEN: 'test' } });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_INPUT');
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('nearby returns only OneMap bus stops', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl;
  globalThis.fetch = async (url, options) => {
    calledUrl = new URL(url);
    assert.equal(options.headers.Authorization, 'test-token');
    return new Response(JSON.stringify([
      { id: 65259, name: 'PUNGGOL STN/INT', lat: 1.40535194, lon: 103.9018719, road: 'PUNGGOL CENTRAL' },
    ]), { status: 200 });
  };
  try {
    const response = await nearby({ request: request('bus'), env: { ONEMAP_TOKEN: 'test-token' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calledUrl.pathname, '/api/public/nearbysvc/getNearestBusStops');
    assert.equal(calledUrl.searchParams.get('radius_in_meters'), '500');
    assert.equal(body.data.type, 'bus');
    assert.deepEqual(body.data.results[0], {
      kind: 'bus', code: '65259', name: 'PUNGGOL STN/INT', road: 'PUNGGOL CENTRAL',
      latitude: 1.40535194, longitude: 103.9018719, distanceMetres: 105,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('nearby returns only OneMap MRT/LRT stations', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl;
  globalThis.fetch = async (url) => {
    calledUrl = new URL(url);
    return new Response(JSON.stringify([
      { id: 'NE17', name: 'PUNGGOL MRT STATION', lat: 1.40428756587, lon: 103.901946796, road: 'PUNGGOL CENTRAL' },
    ]), { status: 200 });
  };
  try {
    const response = await nearby({ request: request('train'), env: { ONEMAP_TOKEN: 'test-token' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calledUrl.pathname, '/api/public/nearbysvc/getNearestMrtStops');
    assert.equal(body.data.type, 'train');
    assert.equal(body.data.results[0].id, 'NE17');
    assert.equal(body.data.results[0].kind, 'train');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
