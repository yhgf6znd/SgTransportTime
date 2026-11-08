import test from 'node:test';
import assert from 'node:assert/strict';
import { ltaJson } from '../../functions/_lib/lta.js';
import { STATIC_CACHE_SECONDS } from '../../functions/_lib/cache.js';

test('caches static LTA JSON payloads for four hours when Workers Cache is available', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const entries = new Map();
  let calls = 0;
  globalThis.caches = {
    default: {
      match: async (request) => entries.get(request.url) ?? null,
      put: async (request, response) => entries.set(request.url, response.clone()),
    },
  };
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ value: [{ BusStopCode: '01012' }] }), { status: 200 });
  };
  try {
    const first = await ltaJson('BusStops?$skip=0', { LTA_ACCOUNT_KEY: 'test' }, 7000, STATIC_CACHE_SECONDS);
    const second = await ltaJson('BusStops?$skip=0', { LTA_ACCOUNT_KEY: 'test' }, 7000, STATIC_CACHE_SECONDS);
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
    assert.equal([...entries.values()][0].headers.get('Cache-Control'), 'public, max-age=0, s-maxage=14400');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});
