import { normalizeService, normalizeStopCode } from '../../../src/lib/transit.js';
import { json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { busStops } from '../../_lib/lta.js';
import { fetchBusArrivalsAtStop } from '../../_lib/bus.js';

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const service = normalizeService(queryLength(url.searchParams.get('service'), 1, 5));
  const stop = normalizeStopCode(url.searchParams.get('stop'));
  if (!service || !stop) throw new ProviderError('INVALID_INPUT', 'Bus service must be 1–5 letters or digits and stop must be five digits.', 400);
  let names = new Map();
  try { names = new Map((await busStops(env)).map((item) => [item.code, item])); } catch { /* Live arrivals remain useful without catalogue metadata. */ }
  const data = await fetchBusArrivalsAtStop(stop, service, env, names);
  return json(data, {
    source: 'LTA DataMall BusArrival v3',
    status: 'live',
    fetchedAt: new Date().toISOString(),
    cached: false,
  });
});
