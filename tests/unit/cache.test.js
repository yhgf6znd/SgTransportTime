import test from 'node:test';
import assert from 'node:assert/strict';
import { ltaJson, pagedLta } from '../../functions/_lib/lta.js';
import { staticTransportCacheSeconds } from '../../functions/_lib/cache.js';

test('calculates the static transport TTL to the next 04:00 Singapore rollover', () => {
  const nearMidnight = Date.parse('2026-11-09T15:30:00.000Z');
  assert.equal(staticTransportCacheSeconds(nearMidnight), 16200);
  const beforeRefresh = Date.parse("2026-11-09T19:30:00.000Z");
  assert.equal(staticTransportCacheSeconds(beforeRefresh), 1800);
});

test('caches static LTA JSON payloads until the next 04:00 Singapore rollover when Workers Cache is available', async () => {
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
    const first = await ltaJson('BusStops?$skip=0', { LTA_ACCOUNT_KEY: 'test' }, 7000, staticTransportCacheSeconds());
    const second = await ltaJson('BusStops?$skip=0', { LTA_ACCOUNT_KEY: 'test' }, 7000, staticTransportCacheSeconds());
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
    assert.equal([...entries.values()][0].headers.get("Cache-Control").startsWith("public, max-age=0, s-maxage="), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});

test('continues upstream fetches when the Workers Cache API throws', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let calls = 0;
  globalThis.caches = { default: { match: async () => { throw new Error('cache unavailable'); }, put: async () => { throw new Error('cache unavailable'); } } };
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ value: ['fresh'] }), { status: 200 }); };
  try {
    const body = await ltaJson('BusServices?ServiceNo=36', { LTA_ACCOUNT_KEY: 'test' }, 7000, staticTransportCacheSeconds());
    assert.deepEqual(body.value, ['fresh']);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});

test("caches complete static catalogues and serves the last good copy on refresh failure", async () => {
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
    return new Response(JSON.stringify({ value: [{ ServiceNo: "56", StopSequence: "1", BusStopCode: "01012" }] }), { status: 200 });
  };
  try {
    const first = await pagedLta("BusRoutes", { LTA_ACCOUNT_KEY: "test" }, 500, staticTransportCacheSeconds());
    const second = await pagedLta("BusRoutes", { LTA_ACCOUNT_KEY: "test" }, 500, staticTransportCacheSeconds());
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
    for (const key of [...entries.keys()]) {
      if (key.includes("/lta-catalog/") || key.includes("/lta-json/")) entries.delete(key);
    }
    globalThis.fetch = async () => { throw new Error("temporary provider failure"); };
    const stale = await pagedLta("BusRoutes", { LTA_ACCOUNT_KEY: "test" }, 500, staticTransportCacheSeconds());
    assert.deepEqual(stale, first);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});
