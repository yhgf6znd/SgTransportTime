import { json, queryLength, run } from '../../_lib/http.js';
import { trainStations } from '../../_lib/train.js';

export const onRequestGet = run(async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get('search') ?? '';
  const search = raw ? queryLength(raw, 1, 80) : '';
  return json(await trainStations(env, search), { source: 'LTA GTFS Schedule (Train)', status: 'scheduled', fetchedAt: new Date().toISOString(), cached: true });
});
