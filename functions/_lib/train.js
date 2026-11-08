import { strFromU8, unzipSync } from 'fflate';
import { decodeGtfsRealtime, csvRows } from './gtfs.js';
import { ltaFeedBytes, ltaJson } from './lta.js';
import { ProviderError } from './http.js';
import { STATIC_CACHE_SECONDS } from './cache.js';

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const SERVICE_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SCHEDULE_CACHE_MS = STATIC_CACHE_SECONDS * 1000;
const TRAIN_FILES = ['stops.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt', 'calendar_dates.txt', 'routes.txt'];
let stationCache = null;
let stationCacheAt = 0;
let stationCacheStale = false;
const scheduleCache = new Map();
const scheduleCacheAt = new Map();
const scheduleCacheStale = new Set();

function findZipText(files, suffix) {
  const name = Object.keys(files).find((entry) => entry.toLowerCase().endsWith(suffix));
  if (!name) throw new ProviderError('UPSTREAM_INVALID', `The train schedule is missing ${suffix}.`, 502);
  return strFromU8(files[name]);
}

function extractGtfsFiles(bytes, suffixes) {
  const wanted = suffixes.map((suffix) => suffix.toLowerCase());
  return unzipSync(bytes, { filter: (file) => wanted.some((suffix) => String(file.name).toLowerCase().endsWith(suffix)) });
}

function parseGtfsClock(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):([0-5]\d):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function dateKey(epochMs) {
  return new Date(epochMs + SINGAPORE_OFFSET_MS).toISOString().slice(0, 10).replaceAll('-', '');
}

function shiftDateKey(key, days) {
  const date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8))));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function localMidnightEpoch(date) {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8))) - SINGAPORE_OFFSET_MS;
}

function stationRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const id = String(row.stop_id ?? '').trim();
    const name = String(row.stop_name ?? '').trim();
    if (!id || !name) continue;
    const parent = String(row.parent_station ?? '').trim();
    const key = parent || id;
    const current = grouped.get(key) ?? { id: key, name, stopIds: [], latitude: null, longitude: null };
    if (!current.stopIds.includes(id)) current.stopIds.push(id);
    if (row.location_type === '1' || !parent) current.name = name;
    const latitude = Number(row.stop_lat);
    const longitude = Number(row.stop_lon);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && current.latitude === null) {
      current.latitude = latitude; current.longitude = longitude;
    }
    grouped.set(key, current);
  }
  return [...grouped.values()].filter((station) => station.id && station.name).sort((a, b) => a.name.localeCompare(b.name));
}

const TRAIN_CODE_PATTERN = /^[A-Z]{1,5}\d{1,3}$/i;
const TRAIN_QUERY_PATTERN = /^[A-Z0-9_.:-]{1,30}$/i;

function parseTrainCodeValues(value, pattern) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  const codes = [...new Set(values.map((code) => String(code).trim().toUpperCase()).filter(Boolean))];
  if (!codes.length || codes.length > 8 || codes.some((code) => !pattern.test(code))) {
    throw new ProviderError('INVALID_INPUT', 'Use one or more comma-separated train station codes, such as NS9 or NS9,TE2.', 400);
  }
  return codes;
}

export function parseTrainStationCodes(value) {
  return parseTrainCodeValues(value, TRAIN_CODE_PATTERN);
}

export function buildTrainSchedule({ stops = [], trips = [], stopTimes = [], calendar = [], calendarDates = [], routes = [] }) {
  const routeNames = new Map(routes.map((row) => [String(row.route_id ?? '').trim(), String(row.route_short_name ?? row.route_long_name ?? row.route_id ?? '').trim()]));
  const tripRecords = new Map();
  for (const row of trips) {
    const tripId = String(row.trip_id ?? '').trim();
    const serviceId = String(row.service_id ?? '').trim();
    if (!tripId || !serviceId) continue;
    const routeId = String(row.route_id ?? '').trim();
    const directionId = String(row.direction_id ?? '').trim().slice(0, 30) || null;
    const destination = String(row.trip_headsign ?? row.destination ?? '').trim().slice(0, 120) || null;
    tripRecords.set(tripId, {
      tripId,
      serviceId,
      route: routeNames.get(routeId) || routeId || null,
      directionId,
      destination,
    });
  }

  const entriesByStopId = new Map();
  for (const row of stopTimes) {
    const trip = tripRecords.get(String(row.trip_id ?? '').trim());
    const stopId = String(row.stop_id ?? '').trim();
    const seconds = parseGtfsClock(row.arrival_time || row.departure_time);
    if (!trip || !stopId || seconds === null) continue;
    const entries = entriesByStopId.get(stopId) ?? [];
    entries.push({ ...trip, stopId, seconds, stopSequence: Number(row.stop_sequence) || 0 });
    entriesByStopId.set(stopId, entries);
  }

  return {
    stations: stationRows(stops),
    entriesByStopId,
    calendar,
    calendarDates,
  };
}

function activeServiceIds(schedule, serviceDate) {
  const active = new Set();
  const weekday = SERVICE_DAYS[new Date(Date.UTC(Number(serviceDate.slice(0, 4)), Number(serviceDate.slice(4, 6)) - 1, Number(serviceDate.slice(6, 8)))).getUTCDay()];
  for (const row of schedule.calendar) {
    const serviceId = String(row.service_id ?? '').trim();
    if (serviceId && serviceDate >= String(row.start_date ?? '') && serviceDate <= String(row.end_date ?? '') && row[weekday] === '1') active.add(serviceId);
  }
  for (const row of schedule.calendarDates) {
    if (String(row.date ?? '').trim() !== serviceDate) continue;
    const serviceId = String(row.service_id ?? '').trim();
    if (!serviceId) continue;
    if (String(row.exception_type) === '1') active.add(serviceId);
    if (String(row.exception_type) === '2') active.delete(serviceId);
  }
  return active;
}

export function scheduledTrainArrivals(schedule, station, nowMs = Date.now(), horizonMs = 24 * 60 * 60 * 1000) {
  const stopIds = new Set([station.id, ...station.stopIds]);
  const results = [];
  const today = dateKey(nowMs);
  // Include the previous date for after-midnight trips and scan forward so a
  // quiet period does not incorrectly become an unavailable result.
  for (let dayOffset = -1; dayOffset <= 7; dayOffset += 1) {
    const serviceDate = shiftDateKey(today, dayOffset);
    const active = activeServiceIds(schedule, serviceDate);
    const midnight = localMidnightEpoch(serviceDate);
    for (const stopId of stopIds) {
      for (const entry of schedule.entriesByStopId.get(stopId) ?? []) {
        if (!active.has(entry.serviceId)) continue;
        const arrivalMs = midnight + entry.seconds * 1000;
        if (arrivalMs < nowMs - 30_000 || arrivalMs > nowMs + horizonMs) continue;
        results.push({
          estimatedArrival: new Date(arrivalMs).toISOString(),
          route: entry.route,
          directionId: entry.directionId,
          destination: entry.destination,
          trip: entry.tripId || null,
          delaySeconds: null,
          predictionStatus: 'scheduled',
        });
      }
    }
  }
  const seen = new Set();
  return results.sort((a, b) => Date.parse(a.estimatedArrival) - Date.parse(b.estimatedArrival)).filter((item) => {
    const key = `${item.trip}|${item.estimatedArrival}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

async function loadStationDirectory(env) {
  const now = Date.now();
  if (!stationCache || now - stationCacheAt > SCHEDULE_CACHE_MS) {
    const previousStations = stationCache;
    try {
      const bytes = await ltaFeedBytes('GTFSScheduleTrain', env, 12000, STATIC_CACHE_SECONDS);
      const files = extractGtfsFiles(bytes, ['stops.txt']);
      const stations = stationRows(csvRows(findZipText(files, 'stops.txt')));
      if (!stations.length) throw new ProviderError('UPSTREAM_INVALID', 'The LTA train schedule contained no station records.', 502);
      stationCache = stations;
      stationCacheAt = now;
      stationCacheStale = false;
    } catch (error) {
      if (!previousStations) throw error;
      stationCacheStale = true;
    }
  }
  return stationCache;
}

function cachedTrainSchedule(stationId, now) {
  const schedule = scheduleCache.get(stationId);
  if (!schedule) return null;
  const station = schedule.stations.find((item) => item.id.toLowerCase() === stationId.toLowerCase());
  if (!station) return null;
  return {
    schedule,
    station,
    fresh: now - (scheduleCacheAt.get(stationId) ?? 0) <= SCHEDULE_CACHE_MS,
  };
}

async function loadTrainSchedules(env, stationIds) {
  const requestedIds = parseTrainStationCodes(stationIds);
  const now = Date.now();
  const previous = requestedIds.map((stationId) => cachedTrainSchedule(stationId, now));
  if (previous.every(Boolean) && previous.every((item) => item.fresh)) {
    return { items: previous.map(({ schedule, station }) => ({ schedule, station, stale: false })) };
  }

  try {
    const bytes = await ltaFeedBytes('GTFSScheduleTrain', env, 12000, STATIC_CACHE_SECONDS);
    const files = extractGtfsFiles(bytes, TRAIN_FILES);
    const stops = csvRows(findZipText(files, 'stops.txt'));
    const stations = stationRows(stops);
    const selectedStations = requestedIds.map((stationId) => stations.find((station) => station.id.toLowerCase() === stationId.toLowerCase()));
    if (selectedStations.some((station) => !station)) throw new ProviderError('INVALID_INPUT', 'Choose verified train station codes from the current station directory.', 400);
    const stopIds = new Set(selectedStations.flatMap((station) => [station.id, ...station.stopIds]));
    const nextSchedule = buildTrainSchedule({
      stops,
      trips: csvRows(findZipText(files, 'trips.txt')),
      stopTimes: csvRows(findZipText(files, 'stop_times.txt'), (row) => stopIds.has(String(row.stop_id ?? '').trim())),
      calendar: csvRows(findZipText(files, 'calendar.txt')),
      calendarDates: csvRows(findZipText(files, 'calendar_dates.txt')),
      routes: csvRows(findZipText(files, 'routes.txt')),
    });
    if (!nextSchedule.entriesByStopId.size) throw new ProviderError('UPSTREAM_INVALID', 'The LTA train schedule contained no timetable records for these stations.', 502);
    for (const station of selectedStations) {
      scheduleCache.set(station.id, nextSchedule);
      scheduleCacheAt.set(station.id, now);
      scheduleCacheStale.delete(station.id);
    }
    return { items: selectedStations.map((station) => ({ schedule: nextSchedule, station, stale: false })) };
  } catch (error) {
    if (previous.every(Boolean)) {
      for (const stationId of requestedIds) scheduleCacheStale.add(stationId);
      return { items: previous.map(({ schedule, station }) => ({ schedule, station, stale: true })) };
    }
    throw error;
  }
}

export async function trainStations(env, query = '') {
  const stations = await loadStationDirectory(env);
  const codes = parseTrainCodeValues(query, TRAIN_QUERY_PATTERN);
  const results = [];
  const seen = new Set();
  for (const code of codes) {
    const exact = stations.filter((station) => station.id.toLowerCase() === code.toLowerCase()
      || station.stopIds.some((id) => id.toLowerCase() === code.toLowerCase()));
    const matches = exact.length ? exact : stations.filter((station) => station.id.toLowerCase().includes(code.toLowerCase())
      || station.stopIds.some((id) => id.toLowerCase().includes(code.toLowerCase())));
    for (const station of matches) {
      if (seen.has(station.id)) continue;
      seen.add(station.id);
      results.push(station);
    }
  }
  return results.slice(0, 50);
}

function scheduleTripMetadata(schedule) {
  const metadata = new Map();
  for (const entries of schedule.entriesByStopId.values()) {
    for (const entry of entries) {
      if (entry.tripId && !metadata.has(entry.tripId)) metadata.set(entry.tripId, entry);
    }
  }
  return metadata;
}

function realtimeTrainArrivals(feed, station, now, schedule) {
  const allowed = new Set([station.id, ...station.stopIds]);
  const metadata = scheduleTripMetadata(schedule);
  const arrivals = [];
  for (const entity of feed.entities) {
    const update = entity.tripUpdate;
    if (!update) continue;
    for (const stop of update.stopTimeUpdates) {
      if (!allowed.has(stop.stopId)) continue;
      const event = stop.arrival ?? stop.departure;
      const time = Number(event?.time ?? 0);
      if (!time || time < now - 120) continue;
      const tripId = String(update.trip?.tripId ?? '').slice(0, 80);
      const trip = metadata.get(tripId);
      arrivals.push({
        estimatedArrival: new Date(time * 1000).toISOString(),
        route: String(update.trip?.routeId ?? '').slice(0, 30) || trip?.route || null,
        directionId: String(update.trip?.directionId ?? '').slice(0, 30) || trip?.directionId || null,
        destination: trip?.destination ?? null,
        trip: tripId || entity.id || null,
        delaySeconds: Number(event?.delay ?? 0),
        predictionStatus: 'live',
      });
    }
  }
  return arrivals.sort((a, b) => Date.parse(a.estimatedArrival) - Date.parse(b.estimatedArrival)).slice(0, 20);
}

function aggregateTrainStatus(items) {
  const statuses = new Set(items.map((item) => item.status));
  return statuses.size === 1 ? items[0].status : 'mixed';
}

export async function trainArrivals(env, stationIds) {
  const loaded = await loadTrainSchedules(env, stationIds);
  let feed = null;
  try {
    const bytes = await ltaFeedBytes('GTFSRealtimeTrainTripUpdates', env);
    feed = decodeGtfsRealtime(bytes);
  } catch {
    // The published schedule remains the honest fallback when realtime data is unavailable.
  }

  const items = loaded.items.map((item) => {
    const scheduled = scheduledTrainArrivals(item.schedule, item.station);
    const liveArrivals = feed ? realtimeTrainArrivals(feed, item.station, Math.floor(Date.now() / 1000), item.schedule) : [];
    const arrivals = liveArrivals.length ? liveArrivals : scheduled;
    const status = liveArrivals.length ? 'live' : scheduled.length ? (item.stale ? 'stale' : 'scheduled') : 'unavailable';
    return { station: item.station, arrivals, status };
  });
  const status = aggregateTrainStatus(items);
  return {
    station: items.length === 1 ? items[0].station : null,
    stations: items,
    arrivals: items.flatMap((item) => item.arrivals),
    status,
  };
}

export async function trainAlerts(env) {
  const payload = await ltaJson('TrainServiceAlerts', env);
  const rows = Array.isArray(payload?.value) ? payload.value : Array.isArray(payload) ? payload : [];
  return rows.slice(0, 50).map((row) => ({
    title: String(row?.Message ?? row?.Title ?? row?.Description ?? 'Train service advisory').slice(0, 240),
    line: String(row?.Line ?? row?.AffectedLine ?? '').slice(0, 80) || null,
    stations: String(row?.Stations ?? row?.AffectedStation ?? '').slice(0, 240) || null,
    updatedAt: String(row?.UpdateTime ?? row?.UpdatedAt ?? '').slice(0, 50) || null,
  }));
}

export function trainScheduleStatus() { return stationCacheStale ? 'stale' : 'scheduled'; }

export function clearTrainCache() {
  stationCache = null;
  stationCacheAt = 0;
  stationCacheStale = false;
  scheduleCache.clear();
  scheduleCacheAt.clear();
  scheduleCacheStale.clear();
}
