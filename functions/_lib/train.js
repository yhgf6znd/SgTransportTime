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

async function loadTrainSchedule(env, stationId) {
  const now = Date.now();
  const previousSchedule = scheduleCache.get(stationId);
  const cachedAt = scheduleCacheAt.get(stationId) ?? 0;
  if (previousSchedule && now - cachedAt <= SCHEDULE_CACHE_MS) return { schedule: previousSchedule, stale: false };
  try {
    const bytes = await ltaFeedBytes('GTFSScheduleTrain', env, 12000, STATIC_CACHE_SECONDS);
    const files = extractGtfsFiles(bytes, TRAIN_FILES);
    const stops = csvRows(findZipText(files, 'stops.txt'));
    const station = stationRows(stops).find((item) => item.id === stationId);
    if (!station) throw new ProviderError('INVALID_INPUT', 'Choose a station from the current station directory.', 400);
    const stopIds = new Set([station.id, ...station.stopIds]);
    const nextSchedule = buildTrainSchedule({
      stops,
      trips: csvRows(findZipText(files, 'trips.txt')),
      stopTimes: csvRows(findZipText(files, 'stop_times.txt'), (row) => stopIds.has(String(row.stop_id ?? '').trim())),
      calendar: csvRows(findZipText(files, 'calendar.txt')),
      calendarDates: csvRows(findZipText(files, 'calendar_dates.txt')),
      routes: csvRows(findZipText(files, 'routes.txt')),
    });
    if (!nextSchedule.entriesByStopId.size) throw new ProviderError('UPSTREAM_INVALID', 'The LTA train schedule contained no timetable records for this station.', 502);
    scheduleCache.set(stationId, nextSchedule);
    scheduleCacheAt.set(stationId, now);
    scheduleCacheStale.delete(stationId);
    return { schedule: nextSchedule, stale: false };
  } catch (error) {
    if (!previousSchedule) throw error;
    scheduleCacheStale.add(stationId);
    return { schedule: previousSchedule, stale: true };
  }
}

export async function trainStations(env, query = '') {
  const stations = await loadStationDirectory(env);
  const needle = String(query).trim().toLowerCase();
  const matches = stations.filter((station) => !needle || station.id.toLowerCase().includes(needle)
    || station.name.toLowerCase().includes(needle)
    || station.stopIds.some((id) => id.toLowerCase().includes(needle)));
  if (!needle) return matches.slice(0, 50);
  const exact = matches.filter((station) => station.id.toLowerCase() === needle
    || station.name.toLowerCase() === needle
    || station.stopIds.some((id) => id.toLowerCase() === needle));
  return (exact.length ? exact : matches).slice(0, 50);
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

export async function trainArrivals(env, stationId) {
  const loaded = await loadTrainSchedule(env, stationId);
  const schedule = loaded.schedule;
  const station = schedule.stations.find((item) => item.id === stationId);
  if (!station) throw new ProviderError('INVALID_INPUT', 'Choose a station from the current station directory.', 400);

  const scheduled = scheduledTrainArrivals(schedule, station);
  try {
    const bytes = await ltaFeedBytes('GTFSRealtimeTrainTripUpdates', env);
    const feed = decodeGtfsRealtime(bytes);
    const liveArrivals = realtimeTrainArrivals(feed, station, Math.floor(Date.now() / 1000), schedule);
    if (liveArrivals.length) return { station, arrivals: liveArrivals, status: 'live' };
  } catch {
    // The published schedule remains the honest fallback when realtime data is unavailable.
  }

  return { station, arrivals: scheduled, status: scheduled.length ? (loaded.stale ? 'stale' : 'scheduled') : 'unavailable' };
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
