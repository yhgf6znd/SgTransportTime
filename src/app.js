import { normalizeService, normalizeStopCode, parseEtaMinutes } from './lib/transit.js';
import { loadState, saveState, toggleFavourite } from './lib/storage.js';

const $ = (selector) => document.querySelector(selector);
const state = { view: 'bus', saved: loadState(window.localStorage), current: null, timer: null, stations: [], stops: [] };
const results = $('#results');

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function setStatus(message) { $('#status').textContent = message; }
function clearResults() { results.replaceChildren(); }
function apiError(error) { return error instanceof Error ? error.message : 'The request could not be completed.'; }

async function api(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error(body?.error?.message ?? 'The service is temporarily unavailable.');
  return body;
}

function chip(status) { return node('span', status, `status-chip status-${status}`); }

function saveButton(favourite) {
  const saved = state.saved.favourites.some((item) => item.kind === favourite.kind && item.code === favourite.code && item.service === favourite.service);
  const button = node('button', saved ? '★ Saved' : '☆ Save', 'save-button');
  button.type = 'button';
  button.addEventListener('click', () => {
    toggleFavourite(state.saved, favourite);
    saveState(window.localStorage, state.saved);
    renderSaved();
    renderCurrent();
  });
  return button;
}

function minutesLabel(item) {
  const minutes = parseEtaMinutes(item.estimatedArrival);
  return minutes === null ? 'No ETA' : minutes <= 1 ? 'Arriving' : `${minutes} min`;
}

function loadLabel(code) { return ({ SEA: 'Seats available', SDA: 'Standing available', LSD: 'Limited standing' })[code] ?? null; }
function vehicleLabel(code) { return ({ SD: 'Single deck', DD: 'Double deck', BD: 'Bendy bus' })[code] ?? null; }

function mapLink(label, latitude, longitude) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;
  const link = node('a', label, 'card-link');
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  link.target = '_blank';
  link.rel = 'noreferrer';
  return link;
}

function formatClock(value) {
  const text = String(value ?? '');
  return /^\d{4}$/.test(text) ? `${text.slice(0, 2)}:${text.slice(2)}` : text || '—';
}

function formatFrequency(value) { return value ? `${value} min` : '—'; }

function renderArrivalMeta(arrival) {
  const labels = [
    arrival.destinationName ? `To ${arrival.destinationName}` : arrival.destinationCode ? `To stop ${arrival.destinationCode}` : null,
    loadLabel(arrival.load),
    vehicleLabel(arrival.vehicleType),
    arrival.wheelchairAccessible === true ? 'Wheelchair accessible' : null,
    arrival.monitored === true ? 'Live position' : arrival.monitored === false ? 'Scheduled estimate' : null,
  ].filter(Boolean);
  const box = node('div', labels.join(' · '), 'eta-meta');
  if (arrival.estimatedLocation) {
    const link = mapLink('View estimated location', arrival.estimatedLocation.latitude, arrival.estimatedLocation.longitude);
    if (link) box.append(link);
  }
  return box;
}

function renderBus(data, meta) {
  clearResults();
  const top = node('div', undefined, 'card-head');
  const titleGroup = node('div', undefined, 'card-title-group');
  const stopTitle = [data.stopName, data.stopRoad].filter(Boolean).join(' · ') || `Stop ${data.stopCode}`;
  titleGroup.append(node('div', `Stop ${data.stopCode}`, 'card-title'), node('p', stopTitle, 'card-sub'));
  top.append(titleGroup, chip(meta.status));
  results.append(top);
  if (!data.services.length) {
    results.append(node('div', 'No active arrivals were returned for this stop or service. This is not a prediction of zero wait time.', 'empty'));
    return;
  }
  for (const service of data.services) {
    const card = node('article', undefined, 'card');
    const head = node('div', undefined, 'card-head');
    const title = node('div');
    title.append(node('div', service.serviceNo, 'card-title'), node('p', `${service.operator ?? 'Bus'} · LTA DataMall`, 'card-sub'));
    head.append(title, saveButton({ kind: 'bus', code: data.stopCode, service: service.serviceNo, name: `Stop ${data.stopCode}` }));
    const grid = node('div', undefined, 'eta-grid');
    for (const arrival of service.arrivals.slice(0, 3)) {
      const minutes = parseEtaMinutes(arrival.estimatedArrival);
      const eta = node('div', undefined, `eta${minutes !== null && minutes <= 2 ? ' soon' : ''}`);
      eta.append(node('strong', minutesLabel(arrival)), renderArrivalMeta(arrival));
      grid.append(eta);
    }
    card.append(head, grid);
    results.append(card);
  }
}

function trainDirectionCards(container, arrivals) {
  const groups = new Map();
  for (const arrival of arrivals) {
    const key = [arrival.route ?? '', arrival.directionId ?? '', arrival.destination ?? ''].join('|') || 'unknown';
    const group = groups.get(key) ?? [];
    group.push(arrival);
    groups.set(key, group);
  }

  for (const groupArrivals of groups.values()) {
    const direction = node('div', undefined, 'card train-direction');
    const destination = groupArrivals.find((arrival) => arrival.destination)?.destination;
    const directionId = groupArrivals.find((arrival) => arrival.directionId)?.directionId;
    const routes = [...new Set(groupArrivals.map((arrival) => arrival.route).filter(Boolean))];
    const label = destination ? `To ${destination}` : directionId ? `Direction ${directionId}` : routes.length ? `Line ${routes.join(' / ')}` : 'Direction not provided';
    const subtitle = routes.length ? `Line ${routes.join(' / ')}` : 'The feed did not provide a destination for these arrivals.';
    const directionHead = node('div', undefined, 'card-head');
    const directionTitle = node('div');
    directionTitle.append(node('h3', label, 'card-title'), node('p', subtitle, 'card-sub'));
    directionHead.append(directionTitle);
    direction.append(directionHead);
    const grid = node('div', undefined, 'eta-grid');
    for (const arrival of groupArrivals.slice(0, 6)) {
      const eta = node('div', undefined, 'eta');
      const arrivalLabel = arrival.predictionStatus === 'scheduled' ? 'Planned schedule' : 'Realtime feed';
      eta.append(node('strong', minutesLabel(arrival)), node('span', arrivalLabel));
      grid.append(eta);
    }
    direction.append(grid);
    container.append(direction);
  }
}

function renderTrain(data) {
  clearResults();
  const entries = Array.isArray(data.stations) && data.stations.length
    ? data.stations
    : data.station ? [{ station: data.station, arrivals: data.arrivals, status: data.status }] : [];
  if (!entries.length) {
    results.append(node('div', 'No verified train station codes were returned.', 'empty'));
    return;
  }

  for (const entry of entries) {
    const card = node('article', undefined, 'card');
    const head = node('div', undefined, 'card-head');
    const title = node('div');
    title.append(node('h2', `${entry.station.name} · ${entry.station.id}`, 'card-title'), node('p', 'Verified station code', 'card-sub'));
    head.append(title, saveButton({ kind: 'train', code: entry.station.id, service: '', name: entry.station.name }));
    card.append(head, chip(entry.status));
    if (!entry.arrivals.length) {
      card.append(node('p', 'No planned or realtime train arrivals are available for this station right now.', 'empty'));
    } else {
      trainDirectionCards(card, entry.arrivals);
    }
    results.append(card);
  }
}

function renderSaved() {
  const view = $('#view-saved');
  view.querySelector('.panel').replaceChildren(node('h2', 'Saved journeys'), node('p', 'Saved locally on this device. No account or credentials are needed.', 'panel-copy'));
  for (const favourite of state.saved.favourites) {
    const row = node('article', undefined, 'card saved-row');
    row.append(node('strong', favourite.kind === 'bus' ? `Bus ${favourite.service} · Stop ${favourite.code}` : `Train · ${favourite.name}`));
    const open = node('button', 'Open', 'secondary-button');
    open.type = 'button';
    open.addEventListener('click', () => openFavourite(favourite));
    row.append(open);
    view.append(row);
  }
  if (!state.saved.favourites.length) view.append(node('div', 'No saved journeys yet.', 'empty'));
}

function renderCurrent() {
  if (state.current?.kind === 'bus' && state.current.data) renderBus(state.current.data, state.current.meta);
  if (state.current?.kind === 'train' && state.current.data) renderTrain(state.current.data, state.current.meta);
}

async function loadBusStops(query) {
  const body = await api(`/api/bus/stops?search=${encodeURIComponent(query)}&limit=12`);
  state.stops = body.data;
  return state.stops;
}

async function loadBusServices(query) {
  const body = await api(`/api/bus/services?search=${encodeURIComponent(query)}&limit=12`);
  return body.data;
}

function renderSuggestions(container, records, label, onSelect) {
  container.replaceChildren(...records.map((record) => {
    const button = node('button', label(record), 'suggestion');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.addEventListener('click', () => { onSelect(record); container.replaceChildren(); });
    return button;
  }));
}

function renderServiceInfo(service) {
  clearResults();
  const card = node('article', undefined, 'card');
  const head = node('div', undefined, 'card-head');
  const title = node('div');
  title.append(node('h2', `Service ${service.serviceNo}`, 'card-title'), node('p', [service.operator, service.category, service.direction ? `Direction ${service.direction}` : null].filter(Boolean).join(' · '), 'card-sub'));
  head.append(title, chip('scheduled'));
  card.append(head);
  const endpoints = node('div', undefined, 'details-grid');
  endpoints.append(node('div', `Origin: ${service.originName ?? 'Unknown'}${service.originCode ? ` (${service.originCode})` : ''}`, 'detail'), node('div', `Destination: ${service.destinationName ?? 'Unknown'}${service.destinationCode ? ` (${service.destinationCode})` : ''}`, 'detail'));
  card.append(endpoints);
  if (service.loopDescription) card.append(node('p', `Loop: ${service.loopDescription}`, 'card-sub'));
  const frequencies = node('div', undefined, 'schedule-grid');
  for (const [label, value] of [['AM peak', service.frequencies?.amPeak], ['AM off-peak', service.frequencies?.amOffPeak], ['PM peak', service.frequencies?.pmPeak], ['PM off-peak', service.frequencies?.pmOffPeak]]) {
    const item = node('div', undefined, 'schedule-item');
    item.append(node('strong', label), node('span', formatFrequency(value)));
    frequencies.append(item);
  }
  card.append(node('h3', 'Dispatch frequency', 'section-title'), frequencies);
  const routeButton = node('button', 'View route and first/last bus times', 'secondary-button');
  routeButton.type = 'button';
  routeButton.addEventListener('click', () => showBusRoute(service.serviceNo));
  card.append(routeButton, node('p', 'Select a bus stop to view live arrivals for this service.', 'card-sub'));
  results.append(card);
}

async function showBusService(service) {
  state.current = null;
  setStatus(`Loading scheduled information for service ${service.serviceNo}…`);
  try {
    renderServiceInfo(service);
    setStatus(`Scheduled information for service ${service.serviceNo} · LTA DataMall.`);
  } catch (error) { clearResults(); setStatus(apiError(error)); }
}

function scheduleTable(firstLast) {
  const table = node('div', undefined, 'schedule-grid');
  for (const [label, schedule] of [['Weekdays', firstLast?.weekday], ['Saturday', firstLast?.saturday], ['Sunday / public holiday', firstLast?.sunday]]) {
    const item = node('div', undefined, 'schedule-item');
    item.append(node('strong', label), node('span', `First ${formatClock(schedule?.first)} · Last ${formatClock(schedule?.last)}`));
    table.append(item);
  }
  return table;
}

function renderRoute(data) {
  clearResults();
  const heading = node('div', undefined, 'card-head');
  heading.append(node('h2', `Service ${data.service} route`, 'card-title'), chip('scheduled'));
  results.append(heading);
  for (const direction of data.directions) {
    const card = node('article', undefined, 'card');
    card.append(node('h3', `Direction ${direction.direction}${direction.operator ? ` · ${direction.operator}` : ''}`, 'card-title'));
    const first = direction.stops[0];
    card.append(node('p', 'Published first and last bus times', 'card-sub'), scheduleTable(first?.firstLast));
    const list = node('ol', undefined, 'route-list');
    for (const stop of direction.stops) {
      const item = node('li', undefined, 'route-stop');
      const copy = node('div');
      copy.append(node('strong', `${stop.stopName ?? 'Bus stop'} · ${stop.busStopCode}`), node('span', [stop.road, stop.distanceKm !== null ? `${stop.distanceKm.toFixed(1)} km` : null].filter(Boolean).join(' · '), 'card-sub'));
      item.append(copy);
      const link = mapLink('Map', stop.latitude, stop.longitude);
      if (link) item.append(link);
      list.append(item);
    }
    card.append(list);
    results.append(card);
  }
  if (!data.directions.length) results.append(node('div', 'No route stops were returned for this service.', 'empty'));
}

async function showBusRoute(service) {
  clearResults();
  setStatus(`Loading route for service ${service}…`);
  try {
    const body = await api(`/api/bus/routes?service=${encodeURIComponent(service)}`);
    renderRoute(body.data);
    setStatus(`Scheduled route for service ${service} · LTA DataMall.`);
  } catch (error) { clearResults(); setStatus(apiError(error)); }
}

async function searchBus(event) {
  event?.preventDefault();
  const query = $('#bus-query').value.trim();
  const serviceInput = $('#bus-service').value.trim();
  const normalizedService = serviceInput ? normalizeService(serviceInput) : null;
  if (!query || (serviceInput && !normalizedService)) { setStatus('Enter a stop, bus number, or an optional service number such as 36A.'); return; }
  try {
    const directStop = normalizeStopCode(query) ? { code: query, name: `Stop ${query}` } : null;
    if (directStop) { $('#bus-suggestions').replaceChildren(); await refreshBus(directStop.code, normalizedService ?? ''); return; }
    const serviceQuery = normalizeService(query);
    const [stopResult, serviceResult] = await Promise.allSettled([loadBusStops(query), serviceQuery ? loadBusServices(serviceQuery) : Promise.resolve([])]);
    const stops = stopResult.status === 'fulfilled' ? stopResult.value : [];
    const services = serviceResult.status === 'fulfilled' ? serviceResult.value : [];
    if (stops.length === 1 && !services.length) { await refreshBus(stops[0].code, normalizedService ?? ''); return; }
    const suggestions = [...stops.map((item) => ({ type: 'stop', item })), ...services.map((item) => ({ type: 'service', item }))];
    renderSuggestions($('#bus-suggestions'), suggestions, (entry) => entry.type === 'stop'
      ? `${entry.item.code} · ${entry.item.name} (${entry.item.road})`
      : `Service ${entry.item.serviceNo} · ${entry.item.operator ?? 'LTA'}${entry.item.category ? ` · ${entry.item.category}` : ''}`,
    (entry) => {
      if (entry.type === 'stop') { $('#bus-query').value = entry.item.code; refreshBus(entry.item.code, normalizedService ?? ''); }
      else { $('#bus-query').value = entry.item.serviceNo; showBusService(entry.item); }
    });
    setStatus(suggestions.length ? 'Choose a bus stop or service from the results.' : 'No matching bus stops or bus services found.');
  } catch (error) { clearResults(); setStatus(apiError(error)); }
}

async function refreshBus(stop, service) {
  clearResults();
  setStatus('Loading bus arrivals…');
  $('#refresh-button').hidden = false;
  try {
    const body = await api(`/api/bus/arrivals?stop=${encodeURIComponent(stop)}${service ? `&service=${encodeURIComponent(service)}` : ''}`);
    state.current = { kind: 'bus', stop, service, data: body.data, meta: body.meta };
    renderBus(body.data, body.meta);
    setStatus(`Updated ${new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', timeStyle: 'short' }).format(new Date())} SGT · ${body.meta.source}`);
    scheduleRefresh();
  } catch (error) { clearResults(); setStatus(apiError(error)); }
}

async function searchTrain(event) {
  event?.preventDefault();
  const query = $('#train-query').value.trim();
  const codes = [...new Set(query.split(',').map((code) => code.trim()).filter(Boolean))];
  if (!codes.length) { setStatus('Enter one or more station codes, such as NS9 or NS9,TE2.'); return; }
  try {
    const body = await api(`/api/train/stations?code=${encodeURIComponent(codes.join(','))}`);
    state.stations = body.data;
    if (state.stations.length !== codes.length) {
      renderSuggestions($('#train-suggestions'), state.stations, (item) => `${item.id} · ${item.name}`, (item) => { $('#train-query').value = item.id; searchTrain(); });
      setStatus(state.stations.length ? 'Choose a verified station code from the results.' : 'No verified station code matched that query.');
      return;
    }
    await refreshTrain(state.stations);
  } catch (error) { clearResults(); setStatus(apiError(error)); }
}

async function refreshTrain(stations) {
  const stationList = Array.isArray(stations) ? stations : [stations];
  const codes = stationList.map((station) => station.id).join(',');
  clearResults();
  setStatus('Loading train arrivals…');
  $('#refresh-button').hidden = false;
  try {
    const body = await api(`/api/train/arrivals?station=${encodeURIComponent(codes)}`);
    state.current = { kind: 'train', stations: stationList, data: body.data, meta: body.meta };
    renderTrain(body.data);
    setStatus(body.meta.status === 'live' ? 'Updated from the verified LTA realtime feed.' : body.meta.status === 'mixed' ? 'The selected lines have mixed live, planned, or unavailable data.' : body.meta.status === 'scheduled' ? 'No disruption update was available; showing planned schedule times.' : body.meta.status === 'stale' ? 'Live data was unavailable; showing the last known planned schedule.' : 'No train arrivals are available for these station codes.');
    scheduleRefresh();
  } catch (error) { clearResults(); setStatus(apiError(error)); }
}

async function loadAlerts() {
  try {
    const body = await api('/api/train/alerts');
    const box = $('#train-alerts');
    box.hidden = !body.data.alerts.length;
    box.textContent = body.data.alerts.map((alert) => [alert.title, alert.line].filter(Boolean).join(' · ')).join(' | ');
  } catch { /* Alerts are supplementary. */ }
}

async function nearby(latitude, longitude) {
  clearResults();
  setStatus('Finding nearby bus stops and MRT/LRT stations…');
  try {
    const radius = $('#nearby-radius').value;
    const body = await api(`/api/nearby?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&radius=${radius}`);
    for (const [label, records] of [['Bus stops', body.data.buses], ['Train stations', body.data.trains]]) {
      results.append(node('h2', label));
      if (!records.length) results.append(node('div', `No ${label.toLowerCase()} were found in this radius.`, 'empty'));
      for (const record of records) {
        const card = node('article', undefined, 'card');
        card.append(node('strong', record.kind === 'bus' ? `${record.code} · ${record.name}` : `${record.name} · ${record.id}`), node('p', `${Math.round(record.distanceMetres)} m away${record.road ? ` · ${record.road}` : ''}`, 'card-sub'));
        results.append(card);
      }
    }
    setStatus(`Nearby bus stops and MRT/LRT stations within ${radius} m. Location was used transiently only.`);
  } catch (error) { setStatus(apiError(error)); }
}

function openFavourite(favourite) {
  if (favourite.kind === 'bus') { switchView('bus'); $('#bus-query').value = favourite.code; $('#bus-service').value = favourite.service; refreshBus(favourite.code, favourite.service); }
  else { switchView('train'); $('#train-query').value = favourite.code; refreshTrain({ id: favourite.code, name: favourite.name, stopIds: [] }); }
}

function scheduleRefresh() {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    if (!document.hidden && state.current) {
      if (state.current.kind === 'bus') refreshBus(state.current.stop, state.current.service);
      else if (state.current.kind === 'train') refreshTrain(state.current.stations);
    }
  }, state.saved.pollingSeconds * 1000);
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  document.querySelectorAll('.view').forEach((section) => { section.hidden = section.id !== `view-${view}`; });
  clearTimeout(state.timer);
  $('#refresh-button').hidden = true;
  clearResults();
  if (view === 'saved') renderSaved();
  else if (view === 'train') loadAlerts();
  setStatus(view === 'saved' ? 'Saved journeys' : 'Choose a search to get started.');
}

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
$('#bus-form').addEventListener('submit', searchBus);
$('#train-form').addEventListener('submit', searchTrain);
$('#refresh-button').addEventListener('click', () => state.current?.kind === 'bus' ? refreshBus(state.current.stop, state.current.service) : refreshTrain(state.current.stations));
$('#location-button').addEventListener('click', () => {
  if (!navigator.geolocation) { setStatus('Location is not available in this browser.'); return; }
  setStatus('Waiting for your permission…');
  navigator.geolocation.getCurrentPosition(({ coords }) => nearby(coords.latitude, coords.longitude), () => setStatus('Location permission was denied or unavailable. Nothing was saved.'), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
});
$('#place-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const body = await api(`/api/places/search?q=${encodeURIComponent($('#place-query').value.trim())}`);
    renderSuggestions($('#place-suggestions'), body.data.results, (item) => `${item.label} · ${item.address}`, (item) => nearby(item.latitude, item.longitude));
    setStatus(body.data.results.length ? 'Choose a place to find nearby transport.' : 'No places found.');
  } catch (error) { setStatus(apiError(error)); }
});
$('#settings-button').addEventListener('click', () => { $('#theme-select').value = state.saved.theme; $('#polling-select').value = String(state.saved.pollingSeconds); $('#settings-dialog').showModal(); });
$('#settings-form').addEventListener('submit', (event) => {
  if (event.submitter?.id !== 'save-settings') return;
  state.saved.theme = $('#theme-select').value;
  state.saved.pollingSeconds = Number($('#polling-select').value);
  saveState(window.localStorage, state.saved);
  applyTheme();
  if (state.current) scheduleRefresh();
});

function applyTheme() { document.documentElement.dataset.theme = state.saved.theme === 'system' ? '' : state.saved.theme; }
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(state.timer); else if (state.current) scheduleRefresh(); });
applyTheme();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
