import { json, queryLength, run } from '../../_lib/http.js';
import { oneMapGet } from '../../_lib/onemap.js';

export const onRequestGet = run(async ({ request, env }) => {
  const query = queryLength(new URL(request.url).searchParams.get('q'), 2, 100);
  const body = await oneMapGet('/api/common/elastic/search', {
    searchVal: query,
    returnGeom: 'Y',
    getAddrDetails: 'Y',
    pageNum: '1',
  }, env);
  const results = Array.isArray(body?.results) ? body.results.slice(0, 20).map((item) => ({
    label: String(item?.SEARCHVAL ?? item?.ADDRESS ?? '').slice(0, 200),
    address: String(item?.ADDRESS ?? '').slice(0, 240),
    latitude: Number(item?.LATITUDE), longitude: Number(item?.LONGITUDE),
  })).filter((item) => item.label && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) : [];
  return json({ results }, { source: 'OneMap Search', status: 'live', fetchedAt: new Date().toISOString(), cached: false });
});
