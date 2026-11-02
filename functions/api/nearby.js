import { haversineKm, validCoordinates } from '../../src/lib/transit.js';
import { json, ProviderError, run } from '../_lib/http.js';
import { busStops } from '../_lib/lta.js';
import { trainStations } from '../_lib/train.js';

const allowedRadii = new Set([250, 500, 1000, 2000]);

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get('lat'));
  const longitude = Number(url.searchParams.get('lon'));
  const radius = Number(url.searchParams.get('radius') ?? 500);
  if (!validCoordinates(latitude, longitude) || !allowedRadii.has(radius)) throw new ProviderError('INVALID_INPUT', 'Use valid coordinates and a radius of 250, 500, 1000 or 2000 metres.', 400);
  const stops = await busStops(env);
  let stations = [];
  try { stations = await trainStations(env); } catch { stations = []; }
  const nearby = (records, kind) => records.map((record) => ({ ...record, kind, distanceMetres: Math.round(haversineKm(latitude, longitude, record.latitude, record.longitude) * 1000) }))
    .filter((record) => Number.isFinite(record.distanceMetres) && record.distanceMetres <= radius)
    .sort((a, b) => a.distanceMetres - b.distanceMetres).slice(0, 20);
  return json({ buses: nearby(stops.filter((item) => item.latitude !== null && item.longitude !== null), 'bus'), trains: nearby(stations.filter((item) => item.latitude !== null && item.longitude !== null), 'train') }, {
    source: 'LTA DataMall BusStops + LTA GTFS Schedule (Train)', status: 'scheduled', fetchedAt: new Date().toISOString(), cached: false,
  });
});
