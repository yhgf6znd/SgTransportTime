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
  try {
    const response = await cache.match(cacheRequest(namespace, key));
    return response ?? null;
  } catch {
    // Cache API support varies by local emulator, preview and deployment host.
    // A cache failure must never make a provider request fail.
    return null;
  }
}

export async function putWorkerCache(namespace, key, response, maxAge = STATIC_CACHE_SECONDS) {
  const cache = cacheStore();
  if (!cache) return;
  try {
    const cachedResponse = new Response(response.body, response);
    cachedResponse.headers.set('Cache-Control', `public, max-age=0, s-maxage=${maxAge}`);
    await cache.put(cacheRequest(namespace, key), cachedResponse);
  } catch {
    // Cache writes are an optimization; retain the successful upstream result.
  }
}
