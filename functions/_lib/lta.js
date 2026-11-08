import { fetchWithTimeout, ProviderError, readJson } from './http.js';
import { matchWorkerCache, putWorkerCache, STATIC_CACHE_SECONDS } from './cache.js';

export const LTA_BASE = 'https://datamall2.mytransport.sg/ltaodataservice/';
const BUS_STOP_CACHE_MS = STATIC_CACHE_SECONDS * 1000;
let busStopCache = null;
let busStopCacheAt = 0;

function requireKey(env) {
  if (!env?.LTA_ACCOUNT_KEY) throw new ProviderError('CONFIGURATION', 'Live LTA data is not configured for this deployment.', 503);
  return env.LTA_ACCOUNT_KEY;
}

export async function ltaJson(path, env, timeoutMs = 7000, cacheTtlSeconds = 0) {
  const key = requireKey(env);
  if (cacheTtlSeconds > 0) {
    const cached = await matchWorkerCache('lta-json', path);
    if (cached) {
      try { return await cached.json(); } catch { /* Re-fetch a corrupt cache entry. */ }
    }
  }
  const url = new URL(path, LTA_BASE);
  const response = await fetchWithTimeout(url, { headers: { AccountKey: key, Accept: 'application/json' } }, timeoutMs);
  const body = await readJson(response, {
    authCode: 'CONFIGURATION',
    authMessage: 'LTA rejected the configured AccountKey for this dataset.',
    authStatus: 503,
  });
  if (cacheTtlSeconds > 0) {
    await putWorkerCache('lta-json', path, new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }), cacheTtlSeconds);
  }
  return body;
}

export async function ltaBinary(path, env, timeoutMs = 10000) {
  const key = requireKey(env);
  const url = new URL(path, LTA_BASE);
  const response = await fetchWithTimeout(url, { headers: { AccountKey: key, Accept: 'application/octet-stream, application/json' } }, timeoutMs);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new ProviderError('CONFIGURATION', 'LTA rejected the configured AccountKey for this dataset.', 503);
    if (response.status === 429) throw new ProviderError('UPSTREAM_RATE_LIMIT', 'The LTA data limit was reached. Try again shortly.', 429);
    throw new ProviderError('UPSTREAM_ERROR', 'LTA did not provide the requested feed.', 502);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function ltaFeedBytes(dataset, env, timeoutMs = 12000, cacheTtlSeconds = 0) {
  const key = requireKey(env);
  if (cacheTtlSeconds > 0) {
    const cached = await matchWorkerCache('lta-feed', dataset);
    if (cached) return new Uint8Array(await cached.arrayBuffer());
  }
  const url = new URL(dataset, LTA_BASE);
  const feedResponse = await fetchWithTimeout(url, {
    headers: { AccountKey: key, Accept: 'application/zip, application/octet-stream, application/json' },
  }, timeoutMs);
  if (!feedResponse.ok) {
    if (feedResponse.status === 401 || feedResponse.status === 403) throw new ProviderError('CONFIGURATION', 'LTA rejected the configured AccountKey for this dataset.', 503);
    if (feedResponse.status === 429) throw new ProviderError('UPSTREAM_RATE_LIMIT', 'The LTA data limit was reached. Try again shortly.', 429);
    throw new ProviderError('UPSTREAM_ERROR', 'LTA did not provide the requested train feed.', 502);
  }

  const contentType = feedResponse.headers.get('content-type')?.toLowerCase() ?? '';
  const body = new Uint8Array(await feedResponse.arrayBuffer());
  let feedBytes = body;
  if (!(contentType.includes('application/zip') || contentType.includes('application/octet-stream') || (body[0] === 0x50 && body[1] === 0x4b))) {
    let metadata;
    try { metadata = JSON.parse(new TextDecoder().decode(body)); }
    catch { throw new ProviderError('UPSTREAM_INVALID', 'LTA returned neither a train feed nor a feed download link.', 502); }
    const item = Array.isArray(metadata?.value) ? metadata.value[0] : metadata?.value ?? metadata;
    const link = item?.Link ?? item?.link ?? metadata?.Link ?? metadata?.link;
    if (typeof link !== 'string' || !/^https:\/\//i.test(link)) throw new ProviderError('UPSTREAM_INVALID', 'LTA did not provide a safe feed link.', 502);
    const downloadUrl = new URL(link);
    const allowedHosts = new Set(['datamall2.mytransport.sg', 'datamall.lta.gov.sg', 'dmprod-datasets.s3.ap-southeast-1.amazonaws.com', 'api.data.gov.sg', 'api-open.data.gov.sg']);
    if (!allowedHosts.has(downloadUrl.hostname)) throw new ProviderError('UPSTREAM_INVALID', 'LTA returned an unapproved feed host.', 502);
    const response = await fetchWithTimeout(downloadUrl, { headers: { Accept: 'application/octet-stream' } }, timeoutMs);
    if (!response.ok) throw new ProviderError('UPSTREAM_ERROR', 'The LTA feed download failed.', 502);
    feedBytes = new Uint8Array(await response.arrayBuffer());
  }
  if (cacheTtlSeconds > 0) await putWorkerCache('lta-feed', dataset, new Response(feedBytes, { headers: { 'Content-Type': 'application/octet-stream' } }), cacheTtlSeconds);
  return feedBytes;
}

export async function pagedLta(dataset, env, pageSize = 500, cacheTtlSeconds = 0) {
  const rows = [];
  for (let skip = 0; skip <= 10000; skip += pageSize) {
    const page = await ltaJson(`${dataset}?$skip=${skip}`, env, 7000, cacheTtlSeconds);
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
  const now = Date.now();
  if (busStopCache && now - busStopCacheAt <= BUS_STOP_CACHE_MS) return busStopCache;
  const rows = await pagedLta('BusStops', env, 500, STATIC_CACHE_SECONDS);
  busStopCache = rows.map(busStopRecord).filter(Boolean);
  busStopCacheAt = now;
  return busStopCache;
}

export function clearBusCache() {
  busStopCache = null;
  busStopCacheAt = 0;
}
