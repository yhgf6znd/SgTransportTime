import { normalizeService } from '../../../src/lib/transit.js';
import { json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { ltaJson } from '../../_lib/lta.js';

export const onRequestGet = run(async ({ request, env }) => {
  const service = normalizeService(queryLength(new URL(request.url).searchParams.get('service'), 1, 5));
  if (!service) throw new ProviderError('INVALID_INPUT', 'Enter a valid bus service number.', 400);
  const rows = await ltaJson(`BusRoutes?ServiceNo=${encodeURIComponent(service)}`, env);
  return json({ service, routes: Array.isArray(rows?.value) ? rows.value : [] }, { source: 'LTA DataMall BusRoutes', status: 'scheduled', fetchedAt: new Date().toISOString() });
});
