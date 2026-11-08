import { normalizeService } from '../../../src/lib/transit.js';
import { json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { fetchServiceArrivals } from '../../_lib/bus.js';

export const onRequestGet = run(async ({ request, env }) => {
  const service = normalizeService(queryLength(new URL(request.url).searchParams.get('service'), 1, 5));
  if (!service) throw new ProviderError('INVALID_INPUT', 'Enter a valid bus service number.', 400);
  const result = await fetchServiceArrivals(service, env);
  const data = { service: result.service, directions: result.directions };
  return json(data, {
    source: 'LTA DataMall BusRoutes + BusArrival v3',
    status: 'live',
    fetchedAt: new Date().toISOString(),
    cached: false,
  });
});
