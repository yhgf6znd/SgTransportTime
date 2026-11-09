import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as busServices } from '../../functions/api/bus/services.js';
import { onRequestGet as busRoutes } from '../../functions/api/bus/routes.js';
import { clearBusCache } from '../../functions/_lib/lta.js';
import { staticTransportCacheSeconds } from '../../functions/_lib/cache.js';
import { routeDatabase } from '../helpers/route-db.js';

function assertEndOfDayCache(response) {
  const cacheControl = response.headers.get('Cache-Control');
  assert.match(cacheControl, /^public, max-age=0, s-maxage=\d+$/);
  const seconds = Number(cacheControl.split('=').at(-1));
  assert.ok(seconds > 0);
  assert.ok(seconds <= staticTransportCacheSeconds() + 1);
}

function mockFetch(responses) {
  return async (request) => {
    const url = String(request.url ?? request);
    const response = responses.find((item) => url.includes(item.match));
    if (!response) throw new Error(`Unexpected upstream URL: ${url}`);
    return new Response(JSON.stringify(response.body), { status: 200 });
  };
}

test('bus services normalizes scheduled service metadata and stop names', async () => {
  const originalFetch = globalThis.fetch;
  clearBusCache();
  globalThis.fetch = mockFetch([
    { match: 'BusServices', body: { value: [{ ServiceNo: '67', Operator: 'SMRT', Direction: '1', Category: 'TRUNK', OriginCode: '99999', DestinationCode: '88888', AM_Peak_Freq: '1', AM_Offpeak_Freq: '1', LoopDesc: '' }, { ServiceNo: '36', Operator: 'SBST', Direction: '1', Category: 'TRUNK', OriginCode: '01012', DestinationCode: '02020', AM_Peak_Freq: '10-12', AM_Offpeak_Freq: '12-15', LoopDesc: '' }] } },
    { match: 'BusStops', body: { value: [{ BusStopCode: '01012', Description: 'Origin', RoadName: 'Example Road', Latitude: '1.3', Longitude: '103.8' }] } },
  ]);
  try {
    const response = await busServices({ request: new Request('https://example.test/api/bus/services?search=36'), env: { LTA_ACCOUNT_KEY: 'test' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assertEndOfDayCache(response);
    assert.deepEqual(body.data.map((item) => item.serviceNo), ['36']); assert.deepEqual(body.data[0], { serviceNo: '36', operator: 'SBST', direction: '1', category: 'TRUNK', originCode: '01012', originName: 'Origin', destinationCode: '02020', destinationName: null, frequencies: { amPeak: '10-12', amOffPeak: '12-15', pmPeak: null, pmOffPeak: null }, loopDescription: null });
  } finally { globalThis.fetch = originalFetch; clearBusCache(); }
});

test('bus routes groups ordered stops and exposes scheduled first/last times', async () => {
  const originalFetch = globalThis.fetch;
  clearBusCache();
  globalThis.fetch = mockFetch([
    { match: 'BusRoutes', body: { value: [{ ServiceNo: '67', Operator: 'SMRT', Direction: '1', StopSequence: '1', BusStopCode: '99999', Distance: '0' }, { ServiceNo: '36', Operator: 'SBST', Direction: '1', StopSequence: '1', BusStopCode: '01012', Distance: '0', WD_FirstBus: '0530', WD_LastBus: '2330', SAT_FirstBus: '0545', SAT_LastBus: '2330', SUN_FirstBus: '0600', SUN_LastBus: '2300' }, { ServiceNo: '36', Operator: 'SBST', Direction: '1', StopSequence: '2', BusStopCode: '02020', Distance: '1.2', WD_FirstBus: '0535', WD_LastBus: '2335' }] } },
    { match: 'BusStops', body: { value: [{ BusStopCode: '01012', Description: 'Origin', RoadName: 'Example Road', Latitude: '1.3', Longitude: '103.8' }, { BusStopCode: '02020', Description: 'Destination', RoadName: 'Other Road', Latitude: '1.31', Longitude: '103.81' }] } },
  ]);
  try {
    const routeRows = [
      { ServiceNo: '67', Operator: 'SMRT', Direction: '1', StopSequence: '1', BusStopCode: '99999', Distance: '0' },
      { ServiceNo: '36', Operator: 'SBST', Direction: '1', StopSequence: '1', BusStopCode: '01012', Distance: '0', WD_FirstBus: '0530', WD_LastBus: '2330', SAT_FirstBus: '0545', SAT_LastBus: '2330', SUN_FirstBus: '0600', SUN_LastBus: '2300' },
      { ServiceNo: '36', Operator: 'SBST', Direction: '1', StopSequence: '2', BusStopCode: '02020', Distance: '1.2', WD_FirstBus: '0535', WD_LastBus: '2335' },
    ];
    const env = { LTA_ACCOUNT_KEY: 'test', ROUTES_DB: routeDatabase(routeRows) };
    const response = await busRoutes({ request: new Request('https://example.test/api/bus/routes?service=36'), env });
    const body = await response.json();
    assert.equal(response.status, 200); assertEndOfDayCache(response); assert.equal(body.data.directions.length, 1); assert.equal(body.data.directions[0].stops[0].stopName, 'Origin'); assert.equal(body.data.directions[0].stops[1].stopSequence, 2); assert.equal(body.data.directions[0].stops[0].firstLast.weekday.first, '0530');
  } finally { globalThis.fetch = originalFetch; clearBusCache(); }
});
