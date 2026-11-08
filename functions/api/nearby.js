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

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get('lat'));
  const longitude = Number(url.searchParams.get('lon'));
  const radius = Number(url.searchParams.get('radius') ?? 500);
  const type = url.searchParams.get('type');
  const endpoint = nearbyEndpoints[type];

  if (!endpoint) throw new ProviderError('INVALID_INPUT', 'Choose type=bus or type=train for nearby results.', 400);
  if (!validCoordinates(latitude, longitude) || !allowedRadii.has(radius)) {
    throw new ProviderError('INVALID_INPUT', 'Use valid coordinates and a radius of 250, 500, 1000 or 2000 metres.', 400);
  }

  const body = await oneMapGet(endpoint.path, {
    latitude,
    longitude,
    radius_in_meters: radius,
  }, env);
  const records = Array.isArray(body) ? body : [];
  const results = records
    .map((record) => normalizeRecord(record, type, latitude, longitude, radius))
    .filter(Boolean)
    .sort((a, b) => a.distanceMetres - b.distanceMetres)
    .slice(0, 20);

  return json({ type, results }, {
    source: `OneMap ${endpoint.label} nearby API`,
    status: 'live',
    fetchedAt: new Date().toISOString(),
    cached: false,
  });
});
