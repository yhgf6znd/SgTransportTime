import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, saveState, sanitizeState, STORAGE_KEY, toggleFavourite } from '../../src/lib/storage.js';

function storage() { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }

test('migrates invalid local storage to a safe empty schema', () => {
  const state = sanitizeState({ version: 1, favourites: [{ kind: 'bus', code: 'bad', service: '36' }, { kind: 'bus', code: '01012', service: '36A', name: 'Stop' }], theme: 'neon', pollingSeconds: 999 });
  assert.equal(state.favourites.length, 1); assert.equal(state.theme, 'system'); assert.equal(state.pollingSeconds, 20);
});

test('round trips versioned favourites and toggles without credentials', () => {
  const store = storage(); const state = loadState(store); const favourite = { kind: 'bus', code: '01012', service: '36A', name: 'Stop' };
  assert.equal(toggleFavourite(state, favourite), true); saveState(store, state); assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).version, 1); assert.equal(loadState(store).favourites.length, 1); assert.equal(toggleFavourite(state, favourite), false);
});
