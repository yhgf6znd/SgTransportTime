import { haversineKm, validCoordinates } from '../../src/lib/transit.js';
import { json, ProviderError, run } from '../_lib/http.js';
import { oneMapGet } from '../_lib/onemap.js';

const allowedRadii = new Set([250, 500, 1000, 2000]);
const nearbyEndpoints = {
  bus: {
    path: '/api/public/nearbysvc/getNearestBusStops',
    label: 'Bus stops',
  },
  train: {
    path: '/api/public/nearbysvc/getNearestMrtStops',
    label: 'MRT/LRT stations',
  },
};

function normalizeRecord(record, type, latitude, longitude, radius) {
  const id = String(record?.id ?? '').trim();
  const name = String(record?.name ?? '').trim();
  const road = String(record?.road ?? '').trim();
  const recordLatitude = Number(record?.lat);
  const recordLongitude = Number(record?.lon);
  if (!id || !name || !validCoordinates(recordLatitude, recordLongitude)) return null;

  const distanceMetres = Math.round(haversineKm(latitude, longitude, recordLatitude, recordLongitude) * 1000);
  if (!Number.isFinite(distanceMetres) || distanceMetres > radius) return null;

  return type === 'bus'
    ? { kind: 'bus', code: id, name, road, latitude: recordLatitude, longitude: recordLongitude, distanceMetres }
    : { kind: 'train', id, name, road, latitude: recordLatitude, longitude: recordLongitude, distanceMetres };
}

async function nearbyRecords(type, latitude, longitude, radius, env) {
  const endpoint = nearbyEndpoints[type];
  const body = await oneMapGet(endpoint.path, {
    latitude,
    longitude,
    radius_in_meters: radius,
  }, env);
  const records = Array.isArray(body) ? body : [];
  return records
    .map((record) => normalizeRecord(record, type, latitude, longitude, radius))
    .filter(Boolean)
    .sort((a, b) => a.distanceMetres - b.distanceMetres)
    .slice(0, 20);
}

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get('lat'));
  const longitude = Number(url.searchParams.get('lon'));
  const radius = Number(url.searchParams.get('radius') ?? 500);
  const type = url.searchParams.get('type');

  if (!validCoordinates(latitude, longitude) || !allowedRadii.has(radius)) {
    throw new ProviderError('INVALID_INPUT', 'Use valid coordinates and a radius of 250, 500, 1000 or 2000 metres.', 400);
  }

  if (type) {
    if (!nearbyEndpoints[type]) throw new ProviderError('INVALID_INPUT', 'Choose type=bus or type=train for nearby results.', 400);
    const results = await nearbyRecords(type, latitude, longitude, radius, env);
    return json({ type, results }, {
      source: `OneMap ${nearbyEndpoints[type].label} nearby API`,
      status: 'live',
      fetchedAt: new Date().toISOString(),
      cached: false,
    });
  }

  const entries = await Promise.allSettled(Object.keys(nearbyEndpoints).map((kind) => nearbyRecords(kind, latitude, longitude, radius, env)));
  const buses = entries[0].status === 'fulfilled' ? entries[0].value : [];
  const trains = entries[1].status === 'fulfilled' ? entries[1].value : [];
  if (entries.every((entry) => entry.status === 'rejected')) throw entries[0].reason;

  return json({ buses, trains }, {
    source: 'OneMap Nearby Bus Stops + MRT/LRT Stations',
    status: 'live',
    partial: entries.some((entry) => entry.status === 'rejected'),
    fetchedAt: new Date().toISOString(),
    cached: false,
  });
});
