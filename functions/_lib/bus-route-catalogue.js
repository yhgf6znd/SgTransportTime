import { ProviderError } from './http.js';
import { ltaJson } from './lta.js';

const PAGE_SIZE = 500;
const PAGES_PER_SYNC = 15;
const MAX_SKIP = 100_000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_DELAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_ROWS = 5_000;

const INSERT_PAGE_SQL = `
  INSERT OR REPLACE INTO bus_route_rows (
    generation, service_no, operator, direction, stop_sequence, bus_stop_code,
    distance_km, wd_first, wd_last, sat_first, sat_last, sun_first, sun_last
  )
  SELECT
    ?,
    UPPER(TRIM(CAST(json_extract(item.value, '$.ServiceNo') AS TEXT))),
    SUBSTR(CAST(json_extract(item.value, '$.Operator') AS TEXT), 1, 20),
    SUBSTR(CAST(json_extract(item.value, '$.Direction') AS TEXT), 1, 4),
    CAST(json_extract(item.value, '$.StopSequence') AS INTEGER),
    TRIM(CAST(json_extract(item.value, '$.BusStopCode') AS TEXT)),
    CASE WHEN json_type(item.value, '$.Distance') IN ('integer', 'real', 'text')
      THEN CAST(json_extract(item.value, '$.Distance') AS REAL) ELSE NULL END,
    SUBSTR(CAST(json_extract(item.value, '$.WD_FirstBus') AS TEXT), 1, 4),
    SUBSTR(CAST(json_extract(item.value, '$.WD_LastBus') AS TEXT), 1, 4),
    SUBSTR(CAST(json_extract(item.value, '$.SAT_FirstBus') AS TEXT), 1, 4),
    SUBSTR(CAST(json_extract(item.value, '$.SAT_LastBus') AS TEXT), 1, 4),
    SUBSTR(CAST(json_extract(item.value, '$.SUN_FirstBus') AS TEXT), 1, 4),
    SUBSTR(CAST(json_extract(item.value, '$.SUN_LastBus') AS TEXT), 1, 4)
  FROM json_each(?) AS item
  WHERE LENGTH(UPPER(TRIM(CAST(json_extract(item.value, '$.ServiceNo') AS TEXT)))) BETWEEN 1 AND 5
    AND UPPER(TRIM(CAST(json_extract(item.value, '$.ServiceNo') AS TEXT))) NOT GLOB '*[^A-Z0-9]*'
    AND LENGTH(TRIM(CAST(json_extract(item.value, '$.Direction') AS TEXT))) BETWEEN 1 AND 4
    AND LENGTH(TRIM(CAST(json_extract(item.value, '$.BusStopCode') AS TEXT))) = 5
    AND TRIM(CAST(json_extract(item.value, '$.BusStopCode') AS TEXT)) NOT GLOB '*[^0-9]*'
    AND CAST(json_extract(item.value, '$.StopSequence') AS INTEGER) > 0
`;

function routeDatabase(env) {
  if (!env?.ROUTES_DB || typeof env.ROUTES_DB.prepare !== 'function') {
    throw new ProviderError('CONFIGURATION', 'Scheduled bus routes are not configured for this deployment.', 503);
  }
  return env.ROUTES_DB;
}

async function syncState(db) {
  try {
    return await db.prepare(`
      SELECT active_generation, active_updated_at, in_progress_generation, next_skip, started_at, cleanup_pending, last_error
      FROM bus_route_sync WHERE singleton = 1
    `).first();
  } catch {
    throw new ProviderError('CONFIGURATION', 'The scheduled bus-route database has not been initialized.', 503);
  }
}

function rawRouteRow(row) {
  return {
    ServiceNo: row?.service_no,
    Operator: row?.operator,
    Direction: row?.direction,
    StopSequence: row?.stop_sequence,
    BusStopCode: row?.bus_stop_code,
    Distance: row?.distance_km,
    WD_FirstBus: row?.wd_first,
    WD_LastBus: row?.wd_last,
    SAT_FirstBus: row?.sat_first,
    SAT_LastBus: row?.sat_last,
    SUN_FirstBus: row?.sun_first,
    SUN_LastBus: row?.sun_last,
  };
}

async function activeGeneration(db) {
  const state = await syncState(db);
  if (!state?.active_generation) {
    throw new ProviderError('CATALOGUE_WARMING', 'Scheduled route data is being prepared. Try again shortly.', 503);
  }
  return state;
}

export async function routeRowsForService(service, env) {
  const db = routeDatabase(env);
  const state = await activeGeneration(db);
  const result = await db.prepare(`
    SELECT service_no, operator, direction, stop_sequence, bus_stop_code, distance_km,
      wd_first, wd_last, sat_first, sat_last, sun_first, sun_last
    FROM bus_route_rows
    WHERE generation = ? AND service_no = ?
    ORDER BY direction, stop_sequence
  `).bind(state.active_generation, service).all();
  return {
    rows: (result?.results ?? []).map(rawRouteRow),
    updatedAt: state.active_updated_at ?? null,
  };
}

export async function routeServicesForStop(stopCode, env) {
  const db = routeDatabase(env);
  const state = await activeGeneration(db);
  const result = await db.prepare(`
    SELECT service_no, MIN(operator) AS operator
    FROM bus_route_rows
    WHERE generation = ? AND bus_stop_code = ?
    GROUP BY service_no
    ORDER BY service_no
  `).bind(state.active_generation, stopCode).all();
  return (result?.results ?? []).map((row) => ({
    serviceNo: String(row?.service_no ?? ''),
    operator: String(row?.operator ?? '').slice(0, 20) || null,
  })).filter((row) => row.serviceNo)
    .sort((a, b) => a.serviceNo.localeCompare(b.serviceNo, undefined, { numeric: true }));
}

function refreshDue(state, now) {
  if (!state?.active_generation || !state.active_updated_at) return true;
  const updated = Date.parse(state.active_updated_at);
  return !Number.isFinite(updated) || now - updated >= REFRESH_MS;
}

async function beginSync(db, state, now) {
  if (state?.in_progress_generation || !refreshDue(state, now)) return state;
  const generation = new Date(now).toISOString();
  const cutoff = new Date(now - REFRESH_MS).toISOString();
  await db.prepare(`
    UPDATE bus_route_sync
    SET in_progress_generation = ?, next_skip = 0, started_at = ?, last_error = NULL
    WHERE singleton = 1 AND in_progress_generation IS NULL
      AND (active_generation IS NULL OR active_updated_at IS NULL OR active_updated_at <= ?)
  `).bind(generation, generation, cutoff).run();
  return syncState(db);
}

async function recordSyncError(db, code) {
  try {
    await db.prepare('UPDATE bus_route_sync SET last_error = ? WHERE singleton = 1')
      .bind(String(code ?? 'UPSTREAM_ERROR').slice(0, 64)).run();
  } catch { /* Preserve the provider error when diagnostic state cannot be saved. */ }
}

async function cleanupObsoleteGenerations(db, state, now) {
  if (!state?.active_generation || !state.cleanup_pending) return 0;
  const updated = Date.parse(state.active_updated_at);
  if (!Number.isFinite(updated) || now - updated < CLEANUP_DELAY_MS) return 0;
  const result = await db.prepare(`
    DELETE FROM bus_route_rows
    WHERE generation <> ?
      AND (generation, service_no, direction, stop_sequence, bus_stop_code) IN (
        SELECT generation, service_no, direction, stop_sequence, bus_stop_code
        FROM bus_route_rows
        WHERE generation <> ?
        LIMIT ?
      )
  `).bind(state.active_generation, state.active_generation, CLEANUP_ROWS).run();
  const changes = Number(result?.meta?.changes) || 0;
  if (changes < CLEANUP_ROWS) {
    await db.prepare('UPDATE bus_route_sync SET cleanup_pending = 0 WHERE singleton = 1').run();
  }
  return changes;
}

export async function syncBusRouteCatalogue(env, now = Date.now()) {
  const db = routeDatabase(env);
  let state = await beginSync(db, await syncState(db), now);
  if (!state?.in_progress_generation) {
    const cleaned = await cleanupObsoleteGenerations(db, state, now);
    return { status: 'fresh', updatedAt: state?.active_updated_at ?? null, cleaned };
  }

  const generation = state.in_progress_generation;
  let skip = Number(state.next_skip) || 0;
  try {
    for (let page = 0; page < PAGES_PER_SYNC; page += 1) {
      if (skip > MAX_SKIP) throw new ProviderError('UPSTREAM_INVALID', 'LTA returned an incomplete bus-route catalogue.', 502);
      const payload = await ltaJson(`BusRoutes?${String.fromCharCode(36)}skip=${skip}`, env, 7000, 0);
      if (!Array.isArray(payload?.value)) throw new ProviderError('UPSTREAM_INVALID', 'LTA returned an invalid bus-route catalogue page.', 502);
      const rows = payload.value;
      if (skip === 0 && rows.length === 0) throw new ProviderError('UPSTREAM_INVALID', 'LTA returned an empty bus-route catalogue.', 502);
      const completed = rows.length < PAGE_SIZE;
      const statements = [db.prepare(INSERT_PAGE_SQL).bind(generation, JSON.stringify(rows))];
      if (completed) {
        const completedAt = new Date(now).toISOString();
        statements.push(db.prepare(`
          UPDATE bus_route_sync
          SET active_generation = ?, active_updated_at = ?, in_progress_generation = NULL,
            next_skip = 0, started_at = NULL, cleanup_pending = 1, last_error = NULL
          WHERE singleton = 1 AND in_progress_generation = ?
        `).bind(generation, completedAt, generation));
      } else {
        statements.push(db.prepare(`
          UPDATE bus_route_sync SET next_skip = ?, last_error = NULL
          WHERE singleton = 1 AND in_progress_generation = ?
        `).bind(skip + PAGE_SIZE, generation));
      }
      await db.batch(statements);
      if (completed) return { status: 'completed', updatedAt: new Date(now).toISOString(), pages: page + 1 };
      skip += PAGE_SIZE;
    }
    state = await syncState(db);
    return { status: 'progress', nextSkip: Number(state?.next_skip) || skip };
  } catch (error) {
    await recordSyncError(db, error?.code);
    throw error;
  }
}

export const routeCatalogueConfig = Object.freeze({ pageSize: PAGE_SIZE, pagesPerSync: PAGES_PER_SYNC, maxSkip: MAX_SKIP, cleanupRows: CLEANUP_ROWS });
