import { normalizeStopCode, searchRecords } from '../../../src/lib/transit.js';
import { json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { busStops } from '../../_lib/lta.js';

let cache = null;
let cacheAt = 0;

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const rawSearch = url.searchParams.get('search') ?? '';
  const search = rawSearch ? queryLength(rawSearch, 1, 80) : '';
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));
  if (search && /^\d{5}$/.test(search) && !normalizeStopCode(search)) throw new ProviderError('INVALID_INPUT', 'Invalid bus stop code.', 400);
  if (!cache || Date.now() - cacheAt > 24 * 60 * 60 * 1000) { cache = await busStops(env); cacheAt = Date.now(); }
  return json(searchRecords(cache, search, ['code', 'name', 'road'], limit), { source: 'LTA DataMall BusStops', status: 'scheduled', fetchedAt: new Date().toISOString(), cached: Boolean(cache) });
});
