import { json, ProviderError, queryLength, run, fetchWithTimeout, readJson } from '../../_lib/http.js';

let token = null;
let tokenExpiry = 0;

async function oneMapToken(env) {
  if (env.ONEMAP_TOKEN) return env.ONEMAP_TOKEN;
  if (!env.ONEMAP_EMAIL || !env.ONEMAP_PASSWORD) throw new ProviderError('CONFIGURATION', 'Place search is not configured for this deployment.', 503);
  if (token && Date.now() < tokenExpiry) return token;
  const response = await fetchWithTimeout('https://www.onemap.gov.sg/api/auth/post/getToken', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.ONEMAP_EMAIL, password: env.ONEMAP_PASSWORD }),
  }, 7000);
  const body = await readJson(response);
  if (!body?.access_token) throw new ProviderError('UPSTREAM_AUTH', 'OneMap authentication failed.', 502);
  token = body.access_token;
  tokenExpiry = Math.max(Date.now() + 60_000, Number(body.expiry_timestamp) * 1000 - 5 * 60 * 1000);
  return token;
}

export const onRequestGet = run(async ({ request, env }) => {
  const query = queryLength(new URL(request.url).searchParams.get('q'), 2, 100);
  const params = new URLSearchParams({ searchVal: query, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' });
  const response = await fetchWithTimeout(`https://www.onemap.gov.sg/api/common/elastic/search?${params}`, { headers: { Authorization: await oneMapToken(env), Accept: 'application/json' } }, 7000);
  const body = await readJson(response);
  const results = Array.isArray(body?.results) ? body.results.slice(0, 20).map((item) => ({
    label: String(item?.SEARCHVAL ?? item?.ADDRESS ?? '').slice(0, 200),
    address: String(item?.ADDRESS ?? '').slice(0, 240),
    latitude: Number(item?.LATITUDE), longitude: Number(item?.LONGITUDE),
  })).filter((item) => item.label && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) : [];
  return json({ results }, { source: 'OneMap Search', status: 'live', fetchedAt: new Date().toISOString(), cached: false });
});
