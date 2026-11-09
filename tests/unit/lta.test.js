import test from 'node:test';
import assert from 'node:assert/strict';
import { ltaFeedBytes, ltaJson, ltaServiceRows, pagedLta } from '../../functions/_lib/lta.js';

test('reports LTA authentication failures as configuration errors instead of invalid JSON', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 401 });
  try {
    await assert.rejects(() => ltaJson('GTFSScheduleTrain', { LTA_ACCOUNT_KEY: 'test' }), (error) => {
      assert.equal(error.code, 'CONFIGURATION');
      assert.equal(error.status, 503);
      return true;
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('accepts a direct ZIP response from the LTA train feed endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const feed = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  globalThis.fetch = async () => new Response(feed, { status: 200, headers: { 'Content-Type': 'application/zip' } });
  try {
    assert.deepEqual(await ltaFeedBytes('GTFSScheduleTrain', { LTA_ACCOUNT_KEY: 'test' }), feed);
  } finally { globalThis.fetch = originalFetch; }
});

test('allows the current official LTA GTFS temporary download host', async () => {
  const originalFetch = globalThis.fetch;
  const feed = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  let requestCount = 0;
  globalThis.fetch = async (url) => {
    requestCount += 1;
    if (requestCount === 1) return new Response(JSON.stringify({ value: [{ Link: 'https://dmproddatasets.s3.ap-southeast1.amazonaws.com/train-gtfsschedule/gtfs_schedule.zip?X-Amz-Security-Token=test' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    assert.equal(new URL(url).hostname, 'dmproddatasets.s3.ap-southeast1.amazonaws.com');
    return new Response(feed, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  };
  try {
    assert.deepEqual(await ltaFeedBytes('GTFSScheduleTrain', { LTA_ACCOUNT_KEY: 'test' }), feed);
  } finally { globalThis.fetch = originalFetch; }
});

test('accepts an XML/Atom LTA train feed link', async () => {
  const originalFetch = globalThis.fetch;
  const feed = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  let requestCount = 0;
  globalThis.fetch = async (url) => {
    requestCount += 1;
    if (requestCount === 1) return new Response('<?xml version="1.0"?><feed><entry><link>https://dmprod-datasets.s3.ap-southeast-1.amazonaws.com/train-gtfs-schedule/gtfs_schedule.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Signature=test</link></entry></feed>', { status: 200, headers: { 'Content-Type': 'application/atom+xml' } });
    assert.equal(new URL(url).hostname, 'dmprod-datasets.s3.ap-southeast-1.amazonaws.com');
    assert.equal(new URL(url).searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
    return new Response(feed, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  };
  try {
    assert.deepEqual(await ltaFeedBytes('GTFSScheduleTrain', { LTA_ACCOUNT_KEY: 'test' }), feed);
    assert.equal(requestCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("paginates beyond the old route-catalogue cutoff", async () => {
  const originalFetch = globalThis.fetch;
  const skips = [];
  globalThis.fetch = async (url) => {
    const skip = Number(new URL(url).searchParams.get(String.fromCharCode(36) + "skip"));
    skips.push(skip);
    const value = skip < 10_500 ? Array.from({ length: 500 }, (_, index) => ({ index })) : [{ ServiceNo: "999", StopSequence: "1", BusStopCode: "01012" }];
    return new Response(JSON.stringify({ value }), { status: 200 });
  };
  try {
    const rows = await pagedLta("BusRoutes", { LTA_ACCOUNT_KEY: "test" }, 500);
    assert.equal(rows.at(-1).ServiceNo, "999");
    assert.equal(skips.at(-1), 10_500);
  } finally { globalThis.fetch = originalFetch; }
});

test("falls back to a service-scoped static response when catalogue pagination fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = new URL(url);
    if (value.searchParams.has(String.fromCharCode(36) + "skip")) return new Response("", { status: 503 });
    return new Response(JSON.stringify({ value: [{ ServiceNo: "56", StopSequence: "1", BusStopCode: "01012" }] }), { status: 200 });
  };
  try {
    const rows = await ltaServiceRows("BusRoutes", "56", { LTA_ACCOUNT_KEY: "test" });
    assert.equal(rows[0].ServiceNo, "56");
  } finally { globalThis.fetch = originalFetch; }
});
