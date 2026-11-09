import { normalizeService } from '../../../src/lib/transit.js';
import { json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { busStops, pagedLta } from '../../_lib/lta.js';
import { STATIC_CACHE_SECONDS } from '../../_lib/cache.js';

function serviceRecord(raw, names) {
  const serviceNo = normalizeService(raw?.ServiceNo);
  if (!serviceNo) return null;
  const originCode = String(raw?.OriginCode ?? '').slice(0, 5) || null;
  const destinationCode = String(raw?.DestinationCode ?? '').slice(0, 5) || null;
  return {
    serviceNo,
    operator: String(raw?.Operator ?? '').slice(0, 20) || null,
    direction: String(raw?.Direction ?? '').slice(0, 4) || null,
    category: String(raw?.Category ?? '').slice(0, 40) || null,
    originCode,
    originName: originCode ? names.get(originCode)?.name ?? null : null,
    destinationCode,
    destinationName: destinationCode ? names.get(destinationCode)?.name ?? null : null,
    frequencies: {
      amPeak: String(raw?.AM_Peak_Freq ?? '').slice(0, 20) || null,
      amOffPeak: String(raw?.AM_Offpeak_Freq ?? '').slice(0, 20) || null,
      pmPeak: String(raw?.PM_Peak_Freq ?? '').slice(0, 20) || null,
      pmOffPeak: String(raw?.PM_Offpeak_Freq ?? '').slice(0, 20) || null,
    },
    loopDescription: String(raw?.LoopDesc ?? '').slice(0, 160) || null,
  };
}

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const query = normalizeService(queryLength(url.searchParams.get('search'), 1, 5));
  if (!query) throw new ProviderError('INVALID_INPUT', 'Enter a valid bus service number.', 400);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? 12) || 12));
  const payload = await pagedLta('BusServices', env, 500, STATIC_CACHE_SECONDS);
  let stops = [];
  try { stops = await busStops(env); } catch { /* Service metadata remains useful without stop names. */ }
  const names = new Map(stops.map((stop) => [stop.code, stop]));
  const services = payload
    .filter((item) => normalizeService(item?.ServiceNo) === query)
    .map((item) => serviceRecord(item, names))
    .filter(Boolean)
    .slice(0, limit);
  return json(services, { source: 'LTA DataMall BusServices', status: 'scheduled', fetchedAt: new Date().toISOString(), cached: true }, 200, STATIC_CACHE_SECONDS);
});
