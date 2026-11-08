import { json, queryLength, run } from '../../_lib/http.js';
import { parseTrainStationCodes, trainArrivals } from '../../_lib/train.js';

export const onRequestGet = run(async ({ request, env }) => {
  const station = queryLength(new URL(request.url).searchParams.get('station'), 1, 240);
  const stationCodes = parseTrainStationCodes(station);
  const data = await trainArrivals(env, stationCodes);
  const source = data.status === 'live'
    ? 'LTA GTFS Realtime Train Trip Updates'
    : data.status === 'mixed'
      ? 'LTA GTFS Realtime Train Trip Updates + GTFS Schedule (planned baseline)'
      : 'LTA GTFS Schedule (planned baseline)';
  return json(data, { source, status: data.status, fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cached: false });
});
