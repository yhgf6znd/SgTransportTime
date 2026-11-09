import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as serviceDirectory } from '../../functions/api/bus/services.js';
import { onRequestGet as serviceArrival } from '../../functions/api/bus/service-arrival.js';
import { onRequestGet as serviceArrivals } from '../../functions/api/bus/service-arrivals.js';
import { onRequestGet as serviceLocations } from '../../functions/api/bus/service-locations.js';
import { dedupeBusLocations } from '../../functions/_lib/bus.js';
import { clearBusCache } from '../../functions/_lib/lta.js';

import { routeDatabase } from '../helpers/route-db.js';
function routeResponse() {
  return {
    value: [
      { ServiceNo: '67', Operator: 'SMRT', Direction: '1', StopSequence: '1', BusStopCode: '99999', Distance: '0' },
      { ServiceNo: '36A', Operator: 'SBST', Direction: '1', StopSequence: '1', BusStopCode: '01012', Distance: '0' },
      { ServiceNo: '36A', Operator: 'SBST', Direction: '2', StopSequence: '1', BusStopCode: '02020', Distance: '0' },
      { ServiceNo: '36A', Operator: 'SBST', Direction: '1', StopSequence: '2', BusStopCode: '02020', Distance: '1.2' },
    ],
  };
}

function arrivalResponse(url) {
  const stop = url.searchParams.get('BusStopCode');
  const location = stop === '01012' ? ['1.300', '103.800'] : ['1.301', '103.801'];
  return {
    Services: [{
      ServiceNo: url.searchParams.get('ServiceNo'),
      Operator: 'SBST',
      NextBus: { EstimatedArrival: '2026-11-08T12:00:00+08:00', Latitude: location[0], Longitude: location[1], VisitNumber: '1', Type: 'SD' },
      NextBus2: { EstimatedArrival: '2026-11-08T12:05:00+08:00', Latitude: location[0], Longitude: location[1], VisitNumber: '2', Type: 'SD' },
    }],
  };
}

function mockFetch() {
  const calls = [];
  return {
    calls,
    fetch: async (request) => {
      const url = new URL(String(request.url ?? request));
      calls.push(url);
      if (url.pathname.endsWith('/BusRoutes')) return new Response(JSON.stringify(routeResponse()));
      if (url.pathname.endsWith('/BusStops')) {
        return new Response(JSON.stringify({ value: [
          { BusStopCode: '01012', Description: 'Origin', RoadName: 'First Road', Latitude: '1.3', Longitude: '103.8' },
          { BusStopCode: '02020', Description: 'Destination', RoadName: 'Second Road', Latitude: '1.31', Longitude: '103.81' },
        ] }));
      }
      if (url.pathname.endsWith('/BusArrival')) return new Response(JSON.stringify(arrivalResponse(url)));
      throw new Error('Unexpected upstream URL');
    },
  };
}

test('service arrivals query each unique route stop and attach live predictions to both directions', async () => {
  const originalFetch = globalThis.fetch;
  const mock = mockFetch();
  clearBusCache();
  globalThis.fetch = mock.fetch;
  try {
    const env = { LTA_ACCOUNT_KEY: 'test', ROUTES_DB: routeDatabase(routeResponse().value) };
    const response = await serviceArrivals({ request: new Request('https://example.test/api/bus/service-arrivals?service=36a'), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.service, '36A');
    assert.equal('stopResults' in body.data, false);
    assert.equal(body.data.directions.length, 2);
    assert.equal(body.data.directions[0].stops[0].stopName, 'Origin');
    assert.equal(body.data.directions[1].stops[0].arrivals[0].estimatedLocation.latitude, 1.301);
    assert.equal(mock.calls.filter((url) => url.pathname.endsWith('/BusArrival')).length, 2);
    assert.equal(body.meta.cached, false);
  } finally {
    globalThis.fetch = originalFetch;
    clearBusCache();
  }
});

test('service locations remove duplicate coordinates from multiple ETA slots and route stops', async () => {
  const originalFetch = globalThis.fetch;
  const mock = mockFetch();
  clearBusCache();
  globalThis.fetch = mock.fetch;
  try {
    const env = { LTA_ACCOUNT_KEY: 'test', ROUTES_DB: routeDatabase(routeResponse().value) };
    const response = await serviceLocations({ request: new Request('https://example.test/api/bus/service-locations?service=36A'), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.locations.length, 2);
    assert.deepEqual(body.data.locations.map((item) => [item.latitude, item.longitude]), [[1.3, 103.8], [1.301, 103.801]]);
  } finally {
    globalThis.fetch = originalFetch;
    clearBusCache();
  }
});

test('single-service arrival validates service and stop before contacting LTA', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('should not call'); };
  try {
    const response = await serviceArrival({ request: new Request('https://example.test/api/bus/service-arrival?service=36&stop=1012'), env: { LTA_ACCOUNT_KEY: 'test' } });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_INPUT');
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('location deduplication keeps nullable provider fields without inventing a vehicle id', () => {
  const locations = dedupeBusLocations([
    { stopCode: '01012', services: [{ arrivals: [
      { estimatedLocation: { latitude: 1.3, longitude: 103.8 }, estimatedArrival: null, visitNumber: null },
      { estimatedLocation: { latitude: 1.3, longitude: 103.8 }, estimatedArrival: 'later' },
    ] }] },
  ]);
  assert.equal(locations.length, 1);
  assert.equal(locations[0].estimatedArrival, null);
});
test("service directory rejects malformed service before upstream", async () => { const originalFetch = globalThis.fetch; let called = false; globalThis.fetch = async () => { called = true; throw new Error("should not call"); }; try { const response = await serviceDirectory({ request: new Request("https://example.test/api/bus/services?search=36!"), env: { LTA_ACCOUNT_KEY: "test" } }); const body = await response.json(); assert.equal(response.status, 400); assert.equal(body.error.code, "INVALID_INPUT"); assert.equal(called, false); } finally { globalThis.fetch = originalFetch; } });
