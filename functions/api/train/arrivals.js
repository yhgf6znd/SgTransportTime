import { json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { trainArrivals } from '../../_lib/train.js';

export const onRequestGet = run(async ({ request, env }) => {
  const station = queryLength(new URL(request.url).searchParams.get('station'), 1, 60);
  if (!/^[A-Za-z0-9_.:-]+$/.test(station)) throw new ProviderError('INVALID_INPUT', 'Invalid train station identifier.', 400);
  const data = await trainArrivals(env, station);
  return json(data, { source: 'LTA GTFS Realtime Train Trip Updates', status: data.arrivals.length ? 'live' : 'unavailable', fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cached: false });
});
