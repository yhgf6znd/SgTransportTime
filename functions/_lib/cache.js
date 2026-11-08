export const STATIC_CACHE_SECONDS = 4 * 60 * 60;

function cacheStore() {
  return globalThis.caches?.default ?? null;
}

export function cacheRequest(namespace, key) {
  return new Request(`https://cache.sgtransporttime.invalid/${namespace}/${encodeURIComponent(key)}`);
}

export async function matchWorkerCache(namespace, key) {
  const cache = cacheStore();
  if (!cache) return null;
  const response = await cache.match(cacheRequest(namespace, key));
  return response ?? null;
}

export async function putWorkerCache(namespace, key, response, maxAge = STATIC_CACHE_SECONDS) {
  const cache = cacheStore();
  if (!cache) return;
  const cachedResponse = new Response(response.body, response);
  cachedResponse.headers.set('Cache-Control', `public, max-age=0, s-maxage=${maxAge}`);
  await cache.put(cacheRequest(namespace, key), cachedResponse);
}
