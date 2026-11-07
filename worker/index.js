import { errorResponse, ProviderError } from '../functions/_lib/http.js';
import { onRequestGet as busArrivals } from '../functions/api/bus/arrivals.js';
import { onRequestGet as busRoutes } from '../functions/api/bus/routes.js';
import { onRequestGet as busStops } from '../functions/api/bus/stops.js';
import { onRequestGet as health } from '../functions/api/health.js';
import { onRequestGet as nearby } from '../functions/api/nearby.js';
import { onRequestGet as placeSearch } from '../functions/api/places/search.js';
import { onRequestGet as trainAlerts } from '../functions/api/train/alerts.js';
import { onRequestGet as trainArrivals } from '../functions/api/train/arrivals.js';
import { onRequestGet as trainStations } from '../functions/api/train/stations.js';

const routes = new Map([
  ['/api/health', health],
  ['/api/bus/arrivals', busArrivals],
  ['/api/bus/routes', busRoutes],
  ['/api/bus/stops', busStops],
  ['/api/nearby', nearby],
  ['/api/places/search', placeSearch],
  ['/api/train/alerts', trainAlerts],
  ['/api/train/arrivals', trainArrivals],
  ['/api/train/stations', trainStations],
]);

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self)',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; manifest-src 'self'; worker-src 'self'",
};

function secure(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function contextFor(request, env, executionContext) {
  return {
    request,
    env,
    waitUntil: (promise) => executionContext?.waitUntil?.(promise),
  };
}

function apiError(code, message, status) {
  return secure(errorResponse(new ProviderError(code, message, status)));
}

export async function handleRequest(request, env, executionContext = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return secure(new Response('Static assets are not configured.', { status: 500 }));
    }
    return secure(await env.ASSETS.fetch(request));
  }

  if (request.method !== 'GET') return apiError('METHOD_NOT_ALLOWED', 'Only GET is supported.', 405);
  const handler = routes.get(url.pathname);
  if (!handler) return apiError('NOT_FOUND', 'API route not found.', 404);

  try {
    return secure(await handler(contextFor(request, env, executionContext)));
  } catch (error) {
    return apiError(error?.code ?? 'UPSTREAM_ERROR', error?.message ?? 'The transport provider is temporarily unavailable.', error?.status ?? 502);
  }
}

export default { fetch: handleRequest };
