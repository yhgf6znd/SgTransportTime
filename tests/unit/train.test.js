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
      { trip_id: 'trip-0830', service_id: 'weekday', route_id: 'NSL' },
      { trip_id: 'trip-0900', service_id: 'weekday', route_id: 'NSL' },
    ],
    stopTimes: [
      { trip_id: 'trip-0830', stop_id: 'NS25-1', arrival_time: '08:30:00', stop_sequence: '1' },
      { trip_id: 'trip-0900', stop_id: 'NS25-1', arrival_time: '09:00:00', stop_sequence: '1' },
    ],
    calendar: [{ service_id: 'weekday', sunday: '1', monday: '0', tuesday: '0', wednesday: '0', thursday: '0', friday: '0', saturday: '0', start_date: '20260101', end_date: '20261231' }],
  });
  const arrivals = scheduledTrainArrivals(schedule, schedule.stations[0], Date.parse('2026-11-08T00:00:00Z'));
  assert.equal(schedule.stations[0].name, 'City Hall');
  assert.deepEqual(arrivals.map((item) => [item.route, item.predictionStatus, item.trip]), [
    ['NSL', 'scheduled', 'trip-0830'],
    ['NSL', 'scheduled', 'trip-0900'],
  ]);
});
