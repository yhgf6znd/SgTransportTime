import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, normalizeBusArrival, normalizeService, normalizeStopCode, parseEtaMinutes, searchMatchRank, searchRecords, sortSearchRecords, validCoordinates } from '../../src/lib/transit.js';

test('keeps leading zero bus stop codes and allows service suffixes', () => {
  assert.equal(normalizeStopCode(' 01012 '), '01012');
  assert.equal(normalizeService('36a'), '36A');
  assert.equal(normalizeStopCode('1012'), null);
  assert.equal(normalizeService('36 A'), null);
});

test('ranks exact, starting-with, and wildcard search matches', () => {
  assert.equal(searchMatchRank(['NS9', 'Woodlands North'], 'ns9'), 0);
  assert.equal(searchMatchRank(['NS9', 'Woodlands North'], 'wood'), 1);
  assert.equal(searchMatchRank(['NS9', 'Woodlands North'], 'lands'), 2);
  assert.equal(searchMatchRank(['NS9', 'Woodlands North'], 'city'), -1);
});

test('normalizes missing bus fields without inventing values', () => {
  assert.deepEqual(normalizeBusArrival({ EstimatedArrival: '', Load: 'unknown' }), {
    estimatedArrival: null, estimatedLocation: null, load: null, wheelchairAccessible: null, vehicleType: null, originCode: null, destinationCode: null, monitored: null, visitNumber: null,
  });
});


test('normalizes documented bus telemetry without inventing missing values', () => {
  assert.deepEqual(normalizeBusArrival({ EstimatedArrival: '2026-11-02T01:00:00Z', Latitude: '1.3', Longitude: '103.8', Load: 'SDA', Feature: 'WAB', Type: 'DD', OriginCode: '01012', DestinationCode: '02020', Monitored: '1', VisitNumber: '2' }), {
    estimatedArrival: '2026-11-02T01:00:00Z', estimatedLocation: { latitude: 1.3, longitude: 103.8 }, load: 'SDA', wheelchairAccessible: true, vehicleType: 'DD', originCode: '01012', destinationCode: '02020', monitored: true, visitNumber: 2,
  });
});


test('rounds ETA upward and clamps already-arrived buses', () => {
  const now = Date.parse('2026-11-02T00:00:00Z');
  assert.equal(parseEtaMinutes('2026-11-02T00:04:01Z', now), 5);
  assert.equal(parseEtaMinutes('2026-11-01T23:59:00Z', now), 0);
  assert.equal(parseEtaMinutes('not-a-date', now), null);
});


test('searches stop records and calculates bounded coordinates', () => {
  assert.equal(searchRecords([{ code: '01012', name: 'Raffles Hotel', road: 'Beach Road' }], 'beach', ['code', 'name', 'road']).length, 1);
  assert.equal(validCoordinates(1.3, 103.8), true);
  assert.equal(validCoordinates(91, 103.8), false);
  assert.ok(haversineKm(1.3, 103.8, 1.3001, 103.8) > 0);
});
test("keeps saved wildcard results ahead of unsaved exact results", () => {
  const results = sortSearchRecords([
    { label: "Exact", rank: 0, saved: false },
    { label: "Saved wildcard", rank: 2, saved: true },
  ]);
  assert.equal(results[0].label, "Saved wildcard");
});
