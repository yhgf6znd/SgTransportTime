export function databaseRouteRow(raw) {
  return {
    service_no: String(raw.ServiceNo),
    operator: raw.Operator ?? null,
    direction: String(raw.Direction),
    stop_sequence: Number(raw.StopSequence),
    bus_stop_code: String(raw.BusStopCode),
    distance_km: raw.Distance === undefined ? null : Number(raw.Distance),
    wd_first: raw.WD_FirstBus ?? null,
    wd_last: raw.WD_LastBus ?? null,
    sat_first: raw.SAT_FirstBus ?? null,
    sat_last: raw.SAT_LastBus ?? null,
    sun_first: raw.SUN_FirstBus ?? null,
    sun_last: raw.SUN_LastBus ?? null,
  };
}

function statement(database, sql, parameters = []) {
  return {
    sql,
    parameters,
    bind(...values) { return statement(database, sql, values); },
    async first() {
      if (sql.includes('FROM bus_route_sync')) return { ...database.state };
      throw new Error(`Unexpected first query: ${sql}`);
    },
    async all() {
      if (sql.includes('bus_stop_code = ?')) {
        const [, stopCode] = parameters;
        const services = new Map();
        for (const row of database.rows.filter((item) => item.bus_stop_code === stopCode)) {
          if (!services.has(row.service_no)) services.set(row.service_no, { service_no: row.service_no, operator: row.operator });
        }
        return { results: [...services.values()] };
      }
      if (sql.includes('service_no = ?')) {
        const [, service] = parameters;
        return { results: database.rows.filter((row) => row.service_no === service) };
      }
      throw new Error(`Unexpected all query: ${sql}`);
    },
  };
}

export function routeDatabase(rawRows, options = {}) {
  const database = {
    rows: rawRows.map(databaseRouteRow),
    state: {
      active_generation: options.activeGeneration ?? 'active-test-generation',
      active_updated_at: options.updatedAt ?? '2026-11-09T04:00:00.000Z',
      in_progress_generation: null,
      next_skip: 0,
      started_at: null,
      cleanup_pending: 0,
      last_error: null,
    },
    prepare(sql) { return statement(database, sql); },
  };
  return database;
}
