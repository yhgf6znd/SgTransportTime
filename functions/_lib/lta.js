import { fetchWithTimeout, ProviderError, readJson } from './http.js';

export const LTA_BASE = 'https://datamall2.mytransport.sg/ltaodataservice/';

function requireKey(env) {
  if (!env?.LTA_ACCOUNT_KEY) throw new ProviderError('CONFIGURATION', 'Live LTA data is not configured for this deployment.', 503);
  return env.LTA_ACCOUNT_KEY;
}

export async function ltaJson(path, env, timeoutMs = 7000) {
  const key = requireKey(env);
  const url = new URL(path, LTA_BASE);
  const response = await fetchWithTimeout(url, { headers: { AccountKey: key, Accept: 'application/json' } }, timeoutMs);
  return readJson(response);
}

export async function ltaBinary(path, env, timeoutMs = 10000) {
  const key = requireKey(env);
  const url = new URL(path, LTA_BASE);
  const response = await fetchWithTimeout(url, { headers: { AccountKey: key, Accept: 'application/octet-stream, application/json' } }, timeoutMs);
  if (!response.ok) {
    if (response.status === 429) throw new ProviderError('UPSTREAM_RATE_LIMIT', 'The LTA data limit was reached. Try again shortly.', 429);
    throw new ProviderError('UPSTREAM_ERROR', 'LTA did not provide the requested feed.', 502);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function ltaFeedBytes(dataset, env) {
  const metadata = await ltaJson(dataset, env);
  const item = Array.isArray(metadata?.value) ? metadata.value[0] : metadata?.value ?? metadata;
  const link = item?.Link ?? item?.link ?? metadata?.Link ?? metadata?.link;
  if (typeof link !== 'string' || !/^https:\/\//i.test(link)) throw new ProviderError('UPSTREAM_INVALID', 'LTA did not provide a safe feed link.', 502);
  const downloadUrl = new URL(link);
  const allowedHosts = new Set(['datamall2.mytransport.sg', 'datamall.lta.gov.sg', 'api.data.gov.sg', 'api-open.data.gov.sg']);
  if (!allowedHosts.has(downloadUrl.hostname)) throw new ProviderError('UPSTREAM_INVALID', 'LTA returned an unapproved feed host.', 502);
  const response = await fetchWithTimeout(downloadUrl, { headers: { Accept: 'application/octet-stream' } }, 12000);
  if (!response.ok) throw new ProviderError('UPSTREAM_ERROR', 'The LTA feed download failed.', 502);
  return new Uint8Array(await response.arrayBuffer());
}

export async function pagedLta(dataset, env, pageSize = 500) {
  const rows = [];
  for (let skip = 0; skip <= 10000; skip += pageSize) {
    const page = await ltaJson(`${dataset}?$skip=${skip}`, env);
    const batch = Array.isArray(page?.value) ? page.value : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export function busStopRecord(raw) {
  const code = String(raw?.BusStopCode ?? '').trim();
  const latitude = Number(raw?.Latitude);
  const longitude = Number(raw?.Longitude);
  if (!/^\d{5}$/.test(code)) return null;
  return {
    code,
    name: String(raw?.Description ?? '').slice(0, 160),
    road: String(raw?.RoadName ?? '').slice(0, 160),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

export async function busStops(env) {
  const rows = await pagedLta('BusStops', env);
  return rows.map(busStopRecord).filter(Boolean);
}
