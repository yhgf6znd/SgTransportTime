export const VALID_POLLING_SECONDS = [15, 30, 45, 60];

export function normalizeStopCode(value) {
  const code = String(value ?? '').trim();
  return /^\d{5}$/.test(code) ? code : null;
}

export function normalizeService(value) {
  const service = String(value ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{1,5}$/.test(service) ? service : null;
}

export function parseEtaMinutes(estimatedArrival, now = Date.now()) {
  const timestamp = Date.parse(estimatedArrival ?? '');
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - now) / 60000));
}

export function normalizeBusArrival(raw = {}) {
  const estimatedArrival = String(raw.EstimatedArrival ?? '').trim();
  const latitude = Number(raw.Latitude);
  const longitude = Number(raw.Longitude);
  return {
    estimatedArrival: estimatedArrival || null,
    estimatedLocation: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null,
    load: raw.Load === 'SEA' || raw.Load === 'SDA' || raw.Load === 'LSD' ? raw.Load : null,
    wheelchairAccessible: raw.Feature === 'WAB' ? true : raw.Feature ? false : null,
    vehicleType: typeof raw.Type === 'string' && raw.Type.length <= 30 ? raw.Type : null,
    originCode: typeof raw.OriginCode === 'string' ? raw.OriginCode.trim() || null : null,
    destinationCode: typeof raw.DestinationCode === 'string' ? raw.DestinationCode.trim() || null : null,
    monitored: raw.Monitored === '1' || raw.Monitored === 1 ? true : raw.Monitored === '0' || raw.Monitored === 0 ? false : null,
    visitNumber: Number.isFinite(Number(raw.VisitNumber)) ? Number(raw.VisitNumber) : null,
  };
}

export function formatEtaClock(estimatedArrival) {
  if (!Number.isFinite(Date.parse(estimatedArrival ?? ''))) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(estimatedArrival));
}

export function formatEtaLabel(estimatedArrival, now = Date.now()) {
  const minutes = parseEtaMinutes(estimatedArrival, now);
  if (minutes === null) return 'No ETA';
  if (minutes <= 1) return 'Arriving';
  if (minutes > 60) return formatEtaClock(estimatedArrival);
  return String(minutes) + ' min';
}

export function selectBusRouteDirections(directions, service) {
  const available = Array.isArray(directions) ? directions : [];
  if (!service) return available;
  const wantedDirection = String(service.direction ?? "").trim();
  const wantedOrigin = String(service.originCode ?? "").trim();
  const wantedDestination = String(service.destinationCode ?? "").trim();
  const scored = available.map((direction) => {
    const stops = Array.isArray(direction.stops) ? direction.stops : [];
    const first = stops[0]?.busStopCode;
    const last = stops[stops.length - 1]?.busStopCode;
    const endpointScore = (wantedOrigin && first === wantedOrigin ? 1 : 0) + (wantedDestination && last === wantedDestination ? 1 : 0);
    const directionScore = wantedDirection && String(direction.direction ?? "").trim() === wantedDirection ? 1 : 0;
    return { direction, score: endpointScore * 10 + directionScore };
  });
  const bestScore = Math.max(...scored.map((item) => item.score), 0);
  return bestScore > 0 ? scored.filter((item) => item.score === bestScore).map((item) => item.direction) : available;
}

export function groupTrainArrivals(arrivals) {
  const groups = new Map();
  for (const arrival of arrivals) {
    const key = [arrival.route ?? '', arrival.directionId ?? ''].join('|') || 'unknown';
    const group = groups.get(key) ?? [];
    group.push(arrival);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function haversineKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latDelta = toRadians(latitudeB - latitudeA);
  const lonDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validCoordinates(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number(latitude) >= -90 && Number(latitude) <= 90
    && Number.isFinite(Number(longitude)) && Number(longitude) >= -180 && Number(longitude) <= 180;
}

export function searchRecords(records, query, fields, limit = 20) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return records.slice(0, limit);
  return records.filter((record) => fields.some((field) => String(record[field] ?? '').toLowerCase().includes(needle))).slice(0, limit);
}

export function searchMatchRank(fields, query) {
  const values = fields.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean);
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return -1;
  if (values.some((value) => value === needle)) return 0;
  if (values.some((value) => value.startsWith(needle))) return 1;
  if (values.some((value) => value.includes(needle))) return 2;
  return -1;
}

export function stationMatches(station, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return true;
  return [station.id, ...(station.stopIds ?? [])].some((value) => String(value).toLowerCase().includes(needle));
}
export function sortSearchRecords(records) {
  return records.slice().sort((a, b) => Number(Boolean(b.saved)) - Number(Boolean(a.saved)) || (a.rank ?? 2) - (b.rank ?? 2) || String(a.label ?? '').localeCompare(String(b.label ?? '')));
}
