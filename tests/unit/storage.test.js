import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, sanitizeState, saveState, toggleFavourite } from '../../src/lib/storage.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('migrates invalid local storage to a safe empty schema', () => {
  const state = sanitizeState({ version: 1, favourites: [{ kind: 'bus', code: 'bad', service: '36' }, { kind: 'bus', code: '01012', service: '36A', name: 'Stop' }], theme: 'neon', pollingSeconds: 999 });
  assert.equal(state.favourites.length, 1); assert.equal(state.theme, 'system'); assert.equal(state.pollingSeconds, 30); assert.equal(state.nearbyRadius, 500);
});

test('accepts only 15-second polling increments', () => {
  assert.equal(sanitizeState({ version: 1, pollingSeconds: 45 }).pollingSeconds, 45);
  assert.equal(sanitizeState({ version: 1, nearbyRadius: 1000 }).nearbyRadius, 1000);
  assert.equal(sanitizeState({ version: 1, pollingSeconds: 20 }).pollingSeconds, 30);
});

test('round trips versioned favourites and toggles without credentials', () => {
  const storage = memoryStorage();
  const state = loadState(storage);
  toggleFavourite(state, { kind: 'bus', code: '01012', service: '36A', name: 'Stop 01012' });
  saveState(storage, state);
  const restored = loadState(storage);
  assert.equal(restored.favourites.length, 1);
  assert.equal(restored.favourites[0].service, '36A');
  toggleFavourite(restored, restored.favourites[0]);
  assert.equal(restored.favourites.length, 0);
});
test("supports saved search entry types", () => {
  const state = sanitizeState({ version: 1, favourites: [
    { kind: "bus-stop", code: "01012", name: "Raffles Hotel" },
    { kind: "bus-service", code: "36A", name: "Service 36A" },
    { kind: "place", code: "Raffles Place", name: "Raffles Place", latitude: 1.283, longitude: 103.851 },
  ] });
  assert.equal(state.favourites.length, 3);
  toggleFavourite(state, state.favourites[1]);
  assert.equal(state.favourites.length, 2);
});
