import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrainSchedule, scheduledTrainArrivals } from '../../functions/_lib/train.js';

test('builds planned station arrivals from GTFS calendar and stop_times data', () => {
  const schedule = buildTrainSchedule({
    stops: [
      { stop_id: 'NS25', stop_name: 'City Hall', location_type: '1' },
      { stop_id: 'NS25-1', stop_name: 'City Hall Platform 1', parent_station: 'NS25' },
    ],
    routes: [{ route_id: 'NSL', route_short_name: 'NSL' }],
    trips: [
      { trip_id: 'trip-0830', service_id: 'weekday', route_id: 'NSL', direction_id: '0', trip_headsign: 'Jurong East' },
      { trip_id: 'trip-0900', service_id: 'weekday', route_id: 'NSL', direction_id: '1', trip_headsign: 'Marina South Pier' },
    ],
    stopTimes: [
      { trip_id: 'trip-0830', stop_id: 'NS25-1', arrival_time: '08:30:00', stop_sequence: '1' },
      { trip_id: 'trip-0900', stop_id: 'NS25-1', arrival_time: '09:00:00', stop_sequence: '1' },
    ],
    calendar: [{ service_id: 'weekday', sunday: '1', monday: '0', tuesday: '0', wednesday: '0', thursday: '0', friday: '0', saturday: '0', start_date: '20260101', end_date: '20261231' }],
  });
  const arrivals = scheduledTrainArrivals(schedule, schedule.stations[0], Date.parse('2026-11-08T00:00:00Z'));
  assert.equal(schedule.stations[0].name, 'City Hall');
  assert.deepEqual(arrivals.map((item) => [item.route, item.directionId, item.destination, item.predictionStatus, item.trip]), [
    ['NSL', '0', 'Jurong East', 'scheduled', 'trip-0830'],
    ['NSL', '1', 'Marina South Pier', 'scheduled', 'trip-0900'],
  ]);
});

test('keeps planned fallback available beyond a short quiet period', () => {
  const schedule = buildTrainSchedule({
    stops: [{ stop_id: 'NS25', stop_name: 'City Hall', location_type: '1' }, { stop_id: 'NS25-1', stop_name: 'City Hall Platform 1', parent_station: 'NS25' }],
    routes: [{ route_id: 'NSL', route_short_name: 'NSL' }],
    trips: [{ trip_id: 'trip-later', service_id: 'daily', route_id: 'NSL' }],
    stopTimes: [{ trip_id: 'trip-later', stop_id: 'NS25-1', arrival_time: '23:30:00', stop_sequence: '1' }],
    calendar: [{ service_id: 'daily', sunday: '1', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '1', start_date: '20260101', end_date: '20261231' }],
  });
  const arrivals = scheduledTrainArrivals(schedule, schedule.stations[0], Date.parse('2026-11-08T10:00:00Z'));
  assert.equal(arrivals.length, 1);
  assert.equal(arrivals[0].predictionStatus, 'scheduled');
  assert.equal(arrivals[0].trip, 'trip-later');
});
