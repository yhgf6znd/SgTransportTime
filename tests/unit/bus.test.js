import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeBusLocations, mapWithConcurrency, routeRecord } from '../../functions/_lib/bus.js';

test('route normalization keeps zero-padded stop codes and schedule fields', () => {
  const record = routeRecord({
    ServiceNo: '36A',
    Operator: 'SBST',
    Direction: '1',
    StopSequence: '2',
    BusStopCode: '01012',
    Distance: '1.5',
    WD_FirstBus: '0530',
  }, new Map([['01012', { name: 'Origin', road: 'Example Road', latitude: 1.3, longitude: 103.8 }]]));
  assert.equal(record.busStopCode, '01012');
  assert.equal(record.stopName, 'Origin');
  assert.equal(record.firstLast.weekday.first, '0530');
  assert.equal(routeRecord({ BusStopCode: '1012', StopSequence: '1' }, new Map()), null);
});

test('concurrency mapper preserves input order while respecting its worker count', async () => {
  let active = 0;
  let maximum = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, value === 1 ? 5 : 1));
    active -= 1;
    return value * 2;
  });
  assert.deepEqual(results, [2, 4, 6, 8]);
  assert.equal(maximum, 2);
});

test('location deduplication uses provider coordinates and ignores missing locations', () => {
  const locations = dedupeBusLocations([
    { stopCode: '01012', services: [{ arrivals: [
      { estimatedLocation: { latitude: 1.3, longitude: 103.8 }, vehicleType: 'SD' },
      { estimatedLocation: { latitude: 1.3, longitude: 103.8 }, vehicleType: 'DD' },
      { estimatedLocation: null },
    ] }] },
  ]);
  assert.equal(locations.length, 1);
  assert.equal(locations[0].vehicleType, 'SD');
});
