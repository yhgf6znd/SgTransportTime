import { strFromU8, unzipSync } from 'fflate';
import { decodeGtfsRealtime, csvRows } from './gtfs.js';
import { ltaFeedBytes, ltaJson } from './lta.js';
import { ProviderError } from './http.js';

let stationCache = null;
let stationCacheAt = 0;
let stopCache = null;

function findZipText(bytes, suffix) {
  const files = unzipSync(bytes);
  const name = Object.keys(files).find((entry) => entry.toLowerCase().endsWith(suffix));
  if (!name) throw new ProviderError('UPSTREAM_INVALID', `The train schedule is missing ${suffix}.`, 502);
  return strFromU8(files[name]);
}

function stationRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const id = String(row.stop_id ?? '').trim();
    const name = String(row.stop_name ?? '').trim();
    if (!id || !name) continue;
    const parent = String(row.parent_station ?? '').trim();
    const key = parent || id;
    const current = grouped.get(key) ?? { id: key, name, stopIds: [], latitude: null, longitude: null };
    if (!current.stopIds.includes(id)) current.stopIds.push(id);
    if (row.location_type === '1' || !parent) current.name = name;
    const latitude = Number(row.stop_lat);
    const longitude = Number(row.stop_lon);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && current.latitude === null) {
      current.latitude = latitude; current.longitude = longitude;
    }
    grouped.set(key, current);
  }
  return [...grouped.values()].filter((station) => station.id && station.name).sort((a, b) => a.name.localeCompare(b.name));
}

export async function trainStations(env, query = '') {
  const now = Date.now();
  if (!stationCache || now - stationCacheAt > 6 * 60 * 60 * 1000) {
    const bytes = await ltaFeedBytes('GTFSScheduleTrain', env);
    stationCache = stationRows(csvRows(findZipText(bytes, 'stops.txt')));
    stationCacheAt = now;
  }
  const needle = String(query).trim().toLowerCase();
  return stationCache.filter((station) => !needle || station.id.toLowerCase().includes(needle)
    || station.name.toLowerCase().includes(needle)
    || station.stopIds.some((id) => id.toLowerCase().includes(needle))).slice(0, 50);
}

export async function trainArrivals(env, stationId) {
  const stations = await trainStations(env);
  const station = stations.find((item) => item.id === stationId);
  if (!station) throw new ProviderError('INVALID_INPUT', 'Choose a station from the current station directory.', 400);
  const bytes = await ltaFeedBytes('GTFSRealtimeTrainTripUpdates', env);
  let feed;
  try { feed = decodeGtfsRealtime(bytes); }
  catch { throw new ProviderError('UPSTREAM_INVALID', 'The train realtime feed could not be decoded.', 502); }
  const allowed = new Set([station.id, ...station.stopIds]);
  const now = Math.floor(Date.now() / 1000);
  const arrivals = [];
  for (const entity of feed.entities) {
    const update = entity.tripUpdate;
    if (!update) continue;
    for (const stop of update.stopTimeUpdates) {
      if (!allowed.has(stop.stopId)) continue;
      const event = stop.arrival ?? stop.departure;
      const time = Number(event?.time ?? 0);
      if (!time || time < now - 120) continue;
      arrivals.push({
        estimatedArrival: new Date(time * 1000).toISOString(),
        route: String(update.trip?.routeId ?? '').slice(0, 30) || null,
        trip: String(update.trip?.tripId ?? '').slice(0, 80) || entity.id || null,
        delaySeconds: Number(event?.delay ?? 0),
        predictionStatus: 'live',
      });
    }
  }
  arrivals.sort((a, b) => Date.parse(a.estimatedArrival) - Date.parse(b.estimatedArrival));
  return { station, arrivals: arrivals.slice(0, 20) };
}

export async function trainAlerts(env) {
  const payload = await ltaJson('TrainServiceAlerts', env);
  const rows = Array.isArray(payload?.value) ? payload.value : Array.isArray(payload) ? payload : [];
  return rows.slice(0, 50).map((row) => ({
    title: String(row?.Message ?? row?.Title ?? row?.Description ?? 'Train service advisory').slice(0, 240),
    line: String(row?.Line ?? row?.AffectedLine ?? '').slice(0, 80) || null,
    stations: String(row?.Stations ?? row?.AffectedStation ?? '').slice(0, 240) || null,
    updatedAt: String(row?.UpdateTime ?? row?.UpdatedAt ?? '').slice(0, 50) || null,
  }));
}

export function clearTrainCache() { stationCache = null; stationCacheAt = 0; stopCache = null; }
