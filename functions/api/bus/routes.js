import { normalizeService } from '../../../src/lib/transit.js';
import { json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { loadBusRoute } from '../../_lib/bus.js';
import { staticTransportCacheSeconds } from '../../_lib/cache.js';

export const onRequestGet = run(async ({ request, env }) => {
  const service = normalizeService(queryLength(new URL(request.url).searchParams.get('service'), 1, 5));
  if (!service) throw new ProviderError('INVALID_INPUT', 'Enter a valid bus service number.', 400);
  const cacheSeconds = staticTransportCacheSeconds();
  const route = await loadBusRoute(service, env);
  return json({ service, directions: route.directions }, {
    source: 'LTA DataMall BusRoutes via D1',
    status: 'scheduled',
    updatedAt: route.updatedAt,
    fetchedAt: new Date().toISOString(),
    cached: true,
  }, 200, cacheSeconds);
});
