import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRowsForService, routeServicesForStop, syncBusRouteCatalogue } from '../../functions/_lib/bus-route-catalogue.js';
import { routeDatabase } from '../helpers/route-db.js';

const routeRows = [
  { ServiceNo: '56', Operator: 'SBST', Direction: '1', StopSequence: '1', BusStopCode: '53009', Distance: '0' },
  { ServiceNo: '56', Operator: 'SBST', Direction: '1', StopSequence: '2', BusStopCode: '51011', Distance: '1.2' },
  { ServiceNo: '57', Operator: 'SBST', Direction: '1', StopSequence: '1', BusStopCode: '53009', Distance: '0' },
];

test('route requests use indexed D1 catalogue reads without contacting LTA', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('route reads must not call LTA'); };
  try {
    const database = routeDatabase(routeRows);
    const route = await routeRowsForService('56', { ROUTES_DB: database });
    const services = await routeServicesForStop('53009', { ROUTES_DB: database });
    assert.deepEqual(route.rows.map((row) => row.BusStopCode), ['53009', '51011']);
    assert.deepEqual(services.map((item) => item.serviceNo), ['56', '57']);
    assert.equal(route.updatedAt, '2026-11-09T04:00:00.000Z');
  } finally { globalThis.fetch = originalFetch; }
});

function syncDatabase() {
  const state = {
    active_generation: null,
    active_updated_at: null,
    in_progress_generation: null,
    next_skip: 0,
    started_at: null,
    cleanup_pending: 0,
    last_error: null,
  };
  const importedPages = [];
  function prepared(sql, parameters = []) {
    return {
      sql,
      parameters,
      bind(...values) { return prepared(sql, values); },
      async first() { return { ...state }; },
      async run() {
        if (sql.includes('SET in_progress_generation')) {
          state.in_progress_generation = parameters[0];
          state.started_at = parameters[1];
          state.next_skip = 0;
        } else if (sql.includes('SET last_error')) state.last_error = parameters[0];
        else if (sql.includes('cleanup_pending = 0')) state.cleanup_pending = 0;
        if (sql.includes('DELETE FROM bus_route_rows')) return { success: true, meta: { changes: 0 } };
        return { success: true, meta: { changes: 1 } };
      },
    };
  }
  return {
    state,
    importedPages,
    prepare(sql) { return prepared(sql); },
    async batch(statements) {
      for (const item of statements) {
        if (item.sql.includes('INSERT OR REPLACE')) importedPages.push(JSON.parse(item.parameters[1]));
        else if (item.sql.includes('SET active_generation')) {
          state.active_generation = item.parameters[0];
          state.active_updated_at = item.parameters[1];
          state.in_progress_generation = null;
          state.next_skip = 0;
          state.cleanup_pending = 1;
        } else if (item.sql.includes('SET next_skip')) state.next_skip = item.parameters[0];
      }
      return statements.map(() => ({ success: true }));
    },
  };
}

test('scheduled sync imports bounded pages and activates only a complete generation', async () => {
  const originalFetch = globalThis.fetch;
  const database = syncDatabase();
  let fetches = 0;
  globalThis.fetch = async (request) => {
    fetches += 1;
    const skip = Number(new URL(request).searchParams.get('$skip'));
    const value = skip === 0
      ? Array.from({ length: 500 }, () => routeRows[0])
      : [routeRows[1]];
    return new Response(JSON.stringify({ value }), { status: 200 });
  };
  try {
    const result = await syncBusRouteCatalogue({ ROUTES_DB: database, LTA_ACCOUNT_KEY: 'test' }, Date.parse('2026-11-09T04:00:00.000Z'));
    assert.equal(result.status, 'completed');
    assert.equal(fetches, 2);
    assert.equal(database.importedPages.length, 2);
    assert.equal(database.state.active_generation, '2026-11-09T04:00:00.000Z');
    assert.equal(database.state.in_progress_generation, null);
    const cleanup = await syncBusRouteCatalogue({ ROUTES_DB: database, LTA_ACCOUNT_KEY: 'test' }, Date.parse('2026-11-10T05:00:00.000Z'));
    assert.equal(cleanup.status, 'fresh');
    assert.equal(database.state.cleanup_pending, 0);
  } finally { globalThis.fetch = originalFetch; }
});
