import { normalizeBusArrival, normalizeService } from '../../src/lib/transit.js';
import { ltaJson, busRoutes, busStops, pagedLta } from './lta.js';

function stopLocation(stop) {
  return stop && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)
    ? { latitude: stop.latitude, longitude: stop.longitude }
    : null;
}

function namedArrival(raw, names) {
  const arrival = normalizeBusArrival(raw);
  return {
    ...arrival,
    originName: arrival.originCode ? names.get(arrival.originCode)?.name ?? null : null,
    destinationName: arrival.destinationCode ? names.get(arrival.destinationCode)?.name ?? null : null,
  };
}

function serviceArrivalRecord(raw, service, names, stopCode) {
  const serviceNo = normalizeService(raw?.ServiceNo) ?? service;
  return {
    serviceNo,
    operator: String(raw?.Operator ?? '').slice(0, 20) || null,
    stopCode,
    arrivals: [raw?.NextBus, raw?.NextBus2, raw?.NextBus3]
      .filter(Boolean)
      .map((item) => namedArrival(item, names)),
  };
}

export function routeRecord(raw, names) {
  const code = String(raw?.BusStopCode ?? '').trim();
  const sequence = Number(raw?.StopSequence);
  if (!/^\d{5}$/.test(code) || !Number.isFinite(sequence)) return null;
  const stop = names.get(code);
  return {
    serviceNo: normalizeService(raw?.ServiceNo) ?? null,
    operator: String(raw?.Operator ?? '').slice(0, 20) || null,
    direction: String(raw?.Direction ?? '').slice(0, 4) || null,
    stopSequence: sequence,
    busStopCode: code,
    stopName: stop?.name ?? null,
    road: stop?.road ?? null,
    latitude: stop?.latitude ?? null,
    longitude: stop?.longitude ?? null,
    distanceKm: Number.isFinite(Number(raw?.Distance)) ? Number(raw.Distance) : null,
    firstLast: {
      weekday: { first: String(raw?.WD_FirstBus ?? '').slice(0, 4) || null, last: String(raw?.WD_LastBus ?? '').slice(0, 4) || null },
      saturday: { first: String(raw?.SAT_FirstBus ?? '').slice(0, 4) || null, last: String(raw?.SAT_LastBus ?? '').slice(0, 4) || null },
      sunday: { first: String(raw?.SUN_FirstBus ?? '').slice(0, 4) || null, last: String(raw?.SUN_LastBus ?? '').slice(0, 4) || null },
    },
  };
}

export async function loadBusRoute(service, env) {
  const payload = await pagedLta('BusRoutes', env, 500, 14_400);
  let stops = [];
  try { stops = await busStops(env); } catch { /* Route data remains useful without catalogue metadata. */ }
  const names = new Map(stops.map((stop) => [stop.code, stop]));
  const rows = payload
    .filter((row) => normalizeService(row?.ServiceNo) === service)
    .map((row) => routeRecord(row, names))
    .filter(Boolean);
  const directions = [...new Set(rows.map((row) => row.direction))].map((direction) => ({
    direction,
    operator: rows.find((row) => row.direction === direction)?.operator ?? null,
    stops: rows.filter((row) => row.direction === direction).sort((a, b) => a.stopSequence - b.stopSequence),
  }));
  return { service, directions, names };
}

export async function fetchBusArrivalsAtStop(stopCode, service, env, names = new Map()) {
  const query = new URLSearchParams({ BusStopCode: stopCode });
  if (service) query.set('ServiceNo', service);
  const payload = await ltaJson(`v3/BusArrival?${query}`, env);
  const stop = names.get(stopCode);
  const records = (Array.isArray(payload?.Services) ? payload.Services : [])
    .filter((item) => !service || normalizeService(item?.ServiceNo) === service)
    .map((item) => serviceArrivalRecord(item, service, names, stopCode))
    .filter((item) => item.serviceNo);
  return {
    stopCode,
    stopName: stop?.name ?? null,
    stopRoad: stop?.road ?? null,
    stopLocation: stopLocation(stop),
    services: records,
  };
}

export async function busServicesAtStop(stopCode, env) {
  const rows = await busRoutes(env);
  const services = new Map();
  for (const row of rows) {
    if (row.busStopCode !== stopCode || services.has(row.serviceNo)) continue;
    services.set(row.serviceNo, { serviceNo: row.serviceNo, operator: row.operator });
  }
  return [...services.values()].sort((a, b) => a.serviceNo.localeCompare(b.serviceNo, undefined, { numeric: true }));
}

export async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function fetchServiceArrivals(service, env) {
  const route = await loadBusRoute(service, env);
  const stopCodes = [...new Set(route.directions.flatMap((direction) => direction.stops.map((stop) => stop.busStopCode)))];
  const arrivals = await mapWithConcurrency(
    stopCodes,
    8,
    (stopCode) => fetchBusArrivalsAtStop(stopCode, service, env, route.names),
  );
  const byStop = new Map(arrivals.map((item) => [item.stopCode, item]));
  return {
    service,
    directions: route.directions.map((direction) => ({
      direction: direction.direction,
      operator: direction.operator,
      stops: direction.stops.map((stop) => ({
        ...stop,
        arrivals: byStop.get(stop.busStopCode)?.services[0]?.arrivals ?? [],
      })),
    })),
    stopResults: arrivals,
  };
}

export function dedupeBusLocations(stopResults) {
  const seen = new Set();
  const locations = [];
  for (const stop of stopResults) {
    for (const service of stop.services ?? []) {
      for (const arrival of service.arrivals ?? []) {
        if (!arrival.estimatedLocation) continue;
        const { latitude, longitude } = arrival.estimatedLocation;
        const key = `${latitude},${longitude}`;
        if (seen.has(key)) continue;
        seen.add(key);
        locations.push({
          latitude,
          longitude,
          stopCode: stop.stopCode,
          estimatedArrival: arrival.estimatedArrival,
          load: arrival.load,
          wheelchairAccessible: arrival.wheelchairAccessible,
          vehicleType: arrival.vehicleType,
          originCode: arrival.originCode,
          originName: arrival.originName,
          destinationCode: arrival.destinationCode,
          destinationName: arrival.destinationName,
          monitored: arrival.monitored,
          visitNumber: arrival.visitNumber,
        });
      }
    }
  }
  return locations;
}
