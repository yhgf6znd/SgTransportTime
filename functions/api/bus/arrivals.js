import { normalizeBusArrival, normalizeService, normalizeStopCode } from '../../../src/lib/transit.js';
import { errorResponse, json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { ltaJson } from '../../_lib/lta.js';

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const stop = normalizeStopCode(url.searchParams.get('stop'));
  const rawService = url.searchParams.get('service');
  const service = rawService ? normalizeService(queryLength(rawService, 1, 5)) : null;
  if (!stop || (rawService && !service)) throw new ProviderError('INVALID_INPUT', 'Bus stop must be five digits and service must be 1–5 letters or digits.', 400);
  const query = new URLSearchParams({ BusStopCode: stop });
  if (service) query.set('ServiceNo', service);
  const payload = await ltaJson(`v3/BusArrival?${query}`, env);
  const services = Array.isArray(payload?.Services) ? payload.Services : [];
  const data = {
    stopCode: stop,
    services: services.map((item) => ({
      serviceNo: String(item?.ServiceNo ?? '').slice(0, 10),
      operator: String(item?.Operator ?? '').slice(0, 20) || null,
      arrivals: [item?.NextBus, item?.NextBus2, item?.NextBus3].filter(Boolean).map(normalizeBusArrival),
    })).filter((item) => item.serviceNo),
  };
  return json(data, { source: 'LTA DataMall BusArrival v3', status: 'live', fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cached: false });
});

export function onRequest(context) {
  if (context.request.method !== 'GET') return errorResponse(new ProviderError('METHOD_NOT_ALLOWED', 'Only GET is supported.', 405));
  return onRequestGet(context);
}
