import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as nearby } from '../../functions/api/nearby.js';

test('nearby returns bus stops and MRT/LRT stations by default', async () => {
  const originalFetch = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (url) => {
    const requestUrl = new URL(url);
    paths.push(requestUrl.pathname);
    if (requestUrl.pathname.endsWith('getNearestBusStops')) {
      return new Response(JSON.stringify([{ id: 12345, name: 'BUS STOP', lat: 1.405, lon: 103.901, road: 'ROAD' }]), { status: 200 });
    }
    return new Response(JSON.stringify([{ id: 'NE17', name: 'PUNGGOL MRT STATION', lat: 1.405, lon: 103.901, road: 'ROAD' }]), { status: 200 });
  };
  try {
    const response = await nearby({ request: new Request('https://example.test/api/nearby?lat=1.405&lon=103.901&radius=500'), env: { ONEMAP_TOKEN: 'test-token' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(paths.sort(), [
      '/api/public/nearbysvc/getNearestBusStops',
      '/api/public/nearbysvc/getNearestMrtStops',
    ].sort());
    assert.equal(body.data.buses[0].code, '12345');
    assert.equal(body.data.trains[0].id, 'NE17');
    assert.equal(body.meta.partial, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
