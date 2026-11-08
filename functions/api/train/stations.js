import { json, queryLength, run } from '../../_lib/http.js';
import { STATIC_CACHE_SECONDS } from '../../_lib/cache.js';
import { trainScheduleStatus, trainStations } from '../../_lib/train.js';

export const onRequestGet = run(async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get('search') ?? '';
  const search = raw ? queryLength(raw, 1, 80) : '';
  const stations = await trainStations(env, search);
  return json(stations, { source: 'LTA GTFS Schedule (Train)', status: trainScheduleStatus(), fetchedAt: new Date().toISOString(), cached: true }, 200, STATIC_CACHE_SECONDS);
});
