import { json, queryLength, run } from '../../_lib/http.js';
import { STATIC_CACHE_SECONDS } from '../../_lib/cache.js';
import { trainScheduleStatus, trainStations } from '../../_lib/train.js';

export const onRequestGet = run(async ({ request, env }) => {
  const raw = queryLength(new URL(request.url).searchParams.get('code'), 1, 240);
  const stations = await trainStations(env, raw);
  return json(stations, { source: 'LTA GTFS Schedule (Train)', status: trainScheduleStatus(), fetchedAt: new Date().toISOString(), cached: true }, 200, STATIC_CACHE_SECONDS);
});
