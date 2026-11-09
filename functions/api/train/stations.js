import { json, queryLength, run } from '../../_lib/http.js';
import { staticTransportCacheSeconds } from '../../_lib/cache.js';
import { trainScheduleStatus, trainStations } from '../../_lib/train.js';

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const raw = queryLength(url.searchParams.get('search') ?? url.searchParams.get('code'), 1, 80);
  const stations = await trainStations(env, raw);
  return json(stations, { source: 'LTA GTFS Schedule (Train)', status: trainScheduleStatus(), fetchedAt: new Date().toISOString(), cached: true }, 200, staticTransportCacheSeconds());
});
