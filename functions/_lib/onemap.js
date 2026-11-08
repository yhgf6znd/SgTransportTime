import { fetchWithTimeout, ProviderError, readJson } from './http.js';

const baseUrl = 'https://www.onemap.gov.sg';
let token = null;
let tokenExpiry = 0;

export async function oneMapToken(env) {
  if (env.ONEMAP_TOKEN) return env.ONEMAP_TOKEN;
  if (!env.ONEMAP_EMAIL || !env.ONEMAP_PASSWORD) {
    throw new ProviderError('CONFIGURATION', 'OneMap is not configured for this deployment.', 503);
  }
  if (token && Date.now() < tokenExpiry) return token;

  const response = await fetchWithTimeout(`${baseUrl}/api/auth/post/getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.ONEMAP_EMAIL, password: env.ONEMAP_PASSWORD }),
  }, 7000);
  const body = await readJson(response, {
    authCode: 'UPSTREAM_AUTH',
    authMessage: 'OneMap authentication failed.',
  });
  if (!body?.access_token) throw new ProviderError('UPSTREAM_AUTH', 'OneMap authentication failed.', 502);

  token = body.access_token;
  const expiry = Number(body.expiry_timestamp);
  tokenExpiry = Number.isFinite(expiry)
    ? Math.max(Date.now() + 60_000, expiry * 1000 - 5 * 60 * 1000)
    : Date.now() + 60 * 60 * 1000;
  return token;
}

export async function oneMapGet(path, params, env) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetchWithTimeout(url, {
    headers: { Authorization: await oneMapToken(env), Accept: 'application/json' },
  }, 7000);
  return readJson(response, {
    authCode: 'UPSTREAM_AUTH',
    authMessage: 'OneMap rejected the configured credentials.',
  });
}
