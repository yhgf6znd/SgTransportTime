export const STORAGE_KEY = 'sg-transit-state-v1';
export const STORAGE_VERSION = 1;

const DEFAULT_POLLING_SECONDS = 30;
const VALID_POLLING_SECONDS = [15, 30, 45, 60];
const emptyState = () => ({ version: STORAGE_VERSION, favourites: [], recent: [], theme: 'system', pollingSeconds: DEFAULT_POLLING_SECONDS });

function validFavourite(value) {
  const kinds = ['bus', 'bus-stop', 'bus-service', 'train', 'place'];
  if (!value || !kinds.includes(value.kind)) return false;
  if (value.kind === 'bus' && (!/^\d{5}$/.test(value.code) || !/^[A-Z0-9]{1,5}$/.test(value.service))) return false;
  if (value.kind === 'bus-stop' && (!/^\d{5}$/.test(value.code) || value.service)) return false;
  if (value.kind === 'bus-service' && (!/^[A-Z0-9]{1,5}$/.test(value.code) || value.service)) return false;
  if (value.kind === 'train' && (!String(value.code ?? '').match(/^[A-Za-z0-9_.:-]{1,60}$/) || !value.name)) return false;
  if (value.kind === 'place' && !value.name) return false;
  return { kind: value.kind, code: String(value.code), service: String(value.service ?? ''), name: String(value.name ?? '').slice(0, 120), latitude: value.kind === 'place' ? undefined : Number.isFinite(Number(value.latitude)) ? Number(value.latitude) : undefined, longitude: value.kind === 'place' ? undefined : Number.isFinite(Number(value.longitude)) ? Number(value.longitude) : undefined };
}

export function sanitizeState(value) {
  const state = emptyState();
  if (!value || value.version !== STORAGE_VERSION) return state;
  state.favourites = Array.isArray(value.favourites) ? value.favourites.map(validFavourite).filter(Boolean).slice(0, 100) : [];
  state.recent = Array.isArray(value.recent) ? value.recent.filter((item) => item && ['bus', 'bus-stop', 'bus-service', 'train', 'place'].includes(item.kind)).slice(0, 10) : [];
  state.theme = ['system', 'light', 'dark'].includes(value.theme) ? value.theme : 'system';
  state.pollingSeconds = VALID_POLLING_SECONDS.includes(value.pollingSeconds) ? value.pollingSeconds : DEFAULT_POLLING_SECONDS;
  return state;
}

export function loadState(storage) {
  try { return sanitizeState(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')); } catch { return emptyState(); }
}

export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState({ ...state, version: STORAGE_VERSION })));
}

export function toggleFavourite(state, favourite) {
  const match = (item) => item.kind === favourite.kind && item.code === favourite.code && item.service === (favourite.service ?? '');
  const index = state.favourites.findIndex(match);
  if (index >= 0) state.favourites.splice(index, 1);
  else state.favourites.unshift({ ...favourite, service: favourite.service ?? '' });
  return index < 0;
}
