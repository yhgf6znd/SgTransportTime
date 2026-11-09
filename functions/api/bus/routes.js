import { normalizeService } from '../../../src/lib/transit.js';
import { json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { busStops, ltaServiceRows } from '../../_lib/lta.js';
import { STATIC_CACHE_SECONDS } from '../../_lib/cache.js';

function routeRecord(raw, names) {
  const code = String(raw?.BusStopCode ?? '').trim();
  const sequence = Number(raw?.StopSequence);
  if (!/^\d{5}$/.test(code) || !Number.isFinite(sequence)) return null;
  const stop = names.get(code);
  return {
    serviceNo: normalizeService(raw?.ServiceNo) ?? null,
    operator: String(raw?.Operator ?? '').slice(0, 20) || null,
    direction: String(raw?.Direction ?? '').slice(0, 4) || null,
    stopSequence: sequence,
    busStopCode: code,
    stopName: stop?.name ?? null,
    road: stop?.road ?? null,
    latitude: stop?.latitude ?? null,
    longitude: stop?.longitude ?? null,
    distanceKm: Number.isFinite(Number(raw?.Distance)) ? Number(raw.Distance) : null,
    firstLast: {
      weekday: { first: String(raw?.WD_FirstBus ?? '').slice(0, 4) || null, last: String(raw?.WD_LastBus ?? '').slice(0, 4) || null },
      saturday: { first: String(raw?.SAT_FirstBus ?? '').slice(0, 4) || null, last: String(raw?.SAT_LastBus ?? '').slice(0, 4) || null },
      sunday: { first: String(raw?.SUN_FirstBus ?? '').slice(0, 4) || null, last: String(raw?.SUN_LastBus ?? '').slice(0, 4) || null },
    },
  };
}

export const onRequestGet = run(async ({ request, env }) => {
  const service = normalizeService(queryLength(new URL(request.url).searchParams.get('service'), 1, 5));
  if (!service) throw new ProviderError('INVALID_INPUT', 'Enter a valid bus service number.', 400);
  const payload = await ltaServiceRows('BusRoutes', service, env, 500, STATIC_CACHE_SECONDS);
  let stops = [];
  try { stops = await busStops(env); } catch { /* Route data remains useful without names/coordinates. */ }
  const names = new Map(stops.map((stop) => [stop.code, stop]));
  const rows = payload.filter((row) => normalizeService(row?.ServiceNo) === service).map((row) => routeRecord(row, names)).filter(Boolean);
  const directions = [...new Set(rows.map((row) => row.direction))].map((direction) => ({
    direction,
    operator: rows.find((row) => row.direction === direction)?.operator ?? null,
    stops: rows.filter((row) => row.direction === direction).sort((a, b) => a.stopSequence - b.stopSequence),
  }));
  return json({ service, directions }, { source: 'LTA DataMall BusRoutes', status: 'scheduled', fetchedAt: new Date().toISOString(), cached: true }, 200, STATIC_CACHE_SECONDS);
});
