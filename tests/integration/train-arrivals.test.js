import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { clearTrainCache, trainArrivals, trainStations } from '../../functions/_lib/train.js';

const stationZip = zipSync({
  'stops.txt': strToU8('stop_id,stop_name,location_type,parent_station,stop_lat,stop_lon\nNS25,City Hall,1,,,1.2931,103.852\nNS25-1,City Hall Platform 1,0,NS25,1.2931,103.852\nNS9,Woodlands,1,,,1.4362,103.786\nNS9-1,Woodlands Platform 1,0,NS9,1.4362,103.786\nTE2,Woodlands North,1,,,1.4482,103.785\nTE2-1,Woodlands North Platform 1,0,TE2,1.4482,103.785\n'),
});

const scheduleZip = zipSync({
  'stops.txt': strToU8('stop_id,stop_name,location_type,parent_station,stop_lat,stop_lon\nNS25,City Hall,1,,,1.2931,103.852\nNS25-1,City Hall Platform 1,0,NS25,1.2931,103.852\n'),
  'routes.txt': strToU8('route_id,route_short_name\nNSL,NSL\n'),
  'trips.txt': strToU8('route_id,service_id,trip_id,direction_id,trip_headsign\nNSL,weekday,trip-scheduled,0,Jurong East\n'),
  'stop_times.txt': strToU8('trip_id,arrival_time,stop_id,stop_sequence\ntrip-scheduled,08:30:00,NS25-1,1\n'),
  'calendar.txt': strToU8('service_id,sunday,monday,tuesday,wednesday,thursday,friday,saturday,start_date,end_date\nweekday,1,0,0,0,0,0,0,20260101,20261231\n'),
  'calendar_dates.txt': strToU8('service_id,date,exception_type\n'),
});

test('loads station hints from stops without parsing timetable files', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(stationZip, { status: 200, headers: { 'Content-Type': 'application/zip' } });
  clearTrainCache();
  try {
    const stations = await trainStations({ LTA_ACCOUNT_KEY: 'test' }, 'City Hall');
    assert.equal(stations.length, 1);
    assert.equal(stations[0].id, 'NS25');
    const woodlands = await trainStations({ LTA_ACCOUNT_KEY: 'test' }, 'Woodlands');
    assert.deepEqual(woodlands.map((station) => station.id), ['NS9']);
    const woodlandsNorth = await trainStations({ LTA_ACCOUNT_KEY: 'test' }, 'Woodlands North');
    assert.deepEqual(woodlandsNorth.map((station) => station.id), ['TE2']);
  } finally {
    globalThis.fetch = originalFetch;
    clearTrainCache();
  }
});

test('uses scheduled train arrivals when realtime trip updates fail', async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let requestCount = 0;
  Date.now = () => Date.parse('2026-11-08T00:00:00Z');
  globalThis.fetch = async (url) => {
    requestCount += 1;
    if (new URL(url).pathname.endsWith('/GTFSScheduleTrain')) {
      return new Response(scheduleZip, { status: 200, headers: { 'Content-Type': 'application/zip' } });
    }
    return new Response('', { status: 503 });
  };
  clearTrainCache();
  try {
    const data = await trainArrivals({ LTA_ACCOUNT_KEY: 'test' }, 'NS25');
    assert.equal(requestCount, 2);
    assert.equal(data.status, 'scheduled');
    assert.equal(data.arrivals[0].predictionStatus, 'scheduled');
    assert.equal(data.arrivals[0].route, 'NSL');
    assert.equal(data.arrivals[0].directionId, '0');
    assert.equal(data.arrivals[0].destination, 'Jurong East');
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
    clearTrainCache();
  }
});

test('keeps the last planned timetable when a schedule refresh fails', async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const firstNow = Date.parse('2026-11-07T20:00:00Z');
  let now = firstNow;
  let requestCount = 0;
  Date.now = () => now;
  globalThis.fetch = async (url) => {
    requestCount += 1;
    if (requestCount === 1) return new Response(scheduleZip, { status: 200, headers: { 'Content-Type': 'application/zip' } });
    return new Response('', { status: 503 });
  };
  clearTrainCache();
  try {
    const first = await trainArrivals({ LTA_ACCOUNT_KEY: 'test' }, 'NS25');
    assert.equal(first.status, 'scheduled');
    now = firstNow + (4 * 60 * 60 * 1000) + 1;
    const refreshed = await trainArrivals({ LTA_ACCOUNT_KEY: 'test' }, 'NS25');
    assert.equal(refreshed.status, 'stale');
    assert.equal(refreshed.arrivals[0].predictionStatus, 'scheduled');
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
    clearTrainCache();
  }
});
