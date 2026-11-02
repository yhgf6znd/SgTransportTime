import test from 'node:test';
import assert from 'node:assert/strict';
import { csvRows, decodeGtfsRealtime } from '../../functions/_lib/gtfs.js';

function varint(value) { const bytes = []; let n = BigInt(value); do { let byte = Number(n & 127n); n >>= 7n; if (n) byte |= 128; bytes.push(byte); } while (n); return bytes; }
function field(number, value) { const bytes = [...varint((number << 3) | 2), ...varint(value.length), ...value]; return bytes; }
function utf8(value) { return [...new TextEncoder().encode(value)]; }

test('parses quoted GTFS CSV and preserves station identifiers', () => {
  const rows = csvRows('stop_id,stop_name,parent_station\nEW13-1,"City, Hall",EW13\n');
  assert.deepEqual(rows[0], { stop_id: 'EW13-1', stop_name: 'City, Hall', parent_station: 'EW13' });
});

test('decodes the subset of GTFS realtime protobuf needed for arrivals', () => {
  const event = [...varint(2 << 3), ...varint(1730505600)];
  const stop = [...field(4, utf8('EW13-1')), ...field(2, event)];
  const trip = [...field(1, utf8('trip-1')), ...field(5, utf8('EW'))];
  const update = [...field(1, trip), ...field(2, stop)];
  const entity = [...field(1, utf8('entity-1')), ...field(3, update)];
  const feed = decodeGtfsRealtime(new Uint8Array(field(2, entity)));
  assert.equal(feed.entities[0].tripUpdate.trip.routeId, 'EW');
  assert.equal(feed.entities[0].tripUpdate.stopTimeUpdates[0].stopId, 'EW13-1');
  assert.equal(feed.entities[0].tripUpdate.stopTimeUpdates[0].arrival.time, 1730505600);
});
