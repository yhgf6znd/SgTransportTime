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

export function stationMatches(station, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return true;
  return [station.id, ...(station.stopIds ?? [])].some((value) => String(value).toLowerCase().includes(needle));
}
