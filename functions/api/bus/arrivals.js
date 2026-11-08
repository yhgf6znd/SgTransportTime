import { normalizeBusArrival, normalizeService, normalizeStopCode } from '../../../src/lib/transit.js';
import { errorResponse, json, ProviderError, queryLength, run } from '../../_lib/http.js';
import { busStops, ltaJson } from '../../_lib/lta.js';
import { busServicesAtStop } from '../../_lib/bus.js';

export const onRequestGet = run(async ({ request, env }) => {
  const url = new URL(request.url);
  const stop = normalizeStopCode(url.searchParams.get('stop'));
  const rawService = url.searchParams.get('service');
  const service = rawService ? normalizeService(queryLength(rawService, 1, 5)) : null;
  if (!stop || (rawService && !service)) throw new ProviderError('INVALID_INPUT', 'Bus stop must be five digits and service must be 1–5 letters or digits.', 400);

  let stopNames = new Map();
  try { stopNames = new Map((await busStops(env)).map((item) => [item.code, item])); } catch { /* Arrival data remains useful if the static catalogue is unavailable. */ }
  const stopRecord = stopNames.get(stop);
  const query = new URLSearchParams({ BusStopCode: stop });
  if (service) query.set('ServiceNo', service);
  const payload = await ltaJson(`v3/BusArrival?${query}`, env);
  const rawServices = Array.isArray(payload?.Services) ? payload.Services : [];
  let routeServices = [];
  try { routeServices = await busServicesAtStop(stop, env); } catch { /* Live arrivals remain useful if the static route catalogue is unavailable. */ }
  const liveServices = rawServices.map((item) => {
    const serviceNo = String(item?.ServiceNo ?? "").slice(0, 10);
    const arrivals = [item?.NextBus, item?.NextBus2, item?.NextBus3].filter(Boolean).map((raw) => {
      const arrival = normalizeBusArrival(raw);
      return {
        ...arrival,
        originName: arrival.originCode ? stopNames.get(arrival.originCode)?.name ?? null : null,
        destinationName: arrival.destinationCode ? stopNames.get(arrival.destinationCode)?.name ?? null : null,
      };
    });
    return {
      serviceNo,
      operator: String(item?.Operator ?? "").slice(0, 20) || null,
      status: arrivals.length ? "live" : "unavailable",
      arrivals,
    };
  }).filter((item) => item.serviceNo);
  const serviceMap = new Map(routeServices.map((item) => [item.serviceNo, { ...item, status: "unavailable", arrivals: [] }]));
  for (const serviceRecord of liveServices) serviceMap.set(serviceRecord.serviceNo, serviceRecord);
  const data = {
    stopCode: stop,
    stopName: stopRecord?.name ?? null,
    stopRoad: stopRecord?.road ?? null,
    stopLocation: stopRecord && Number.isFinite(stopRecord.latitude) && Number.isFinite(stopRecord.longitude)
      ? { latitude: stopRecord.latitude, longitude: stopRecord.longitude }
      : null,
    services: [...serviceMap.values()].filter((item) => !service || item.serviceNo === service),
  };
  return json(data, { source: 'LTA DataMall BusRoutes + BusArrival v3', status: 'live', fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cached: false });
});

export function onRequest(context) {
  if (context.request.method !== 'GET') return errorResponse(new ProviderError('METHOD_NOT_ALLOWED', 'Only GET is supported.', 405));
  return onRequestGet(context);
}
