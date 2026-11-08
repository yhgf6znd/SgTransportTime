import { formatEtaClock, formatEtaLabel, groupTrainArrivals, normalizeService, normalizeStopCode, parseEtaMinutes, searchMatchRank, sortSearchRecords } from './lib/transit.js';
import { loadState, saveState, toggleFavourite } from './lib/storage.js';

const $ = (selector) => document.querySelector(selector);
const state = { view: 'search', saved: loadState(window.localStorage), current: null, timer: null, searchTimer: null, searchQuery: '', searchRecords: [], stations: [], stops: [] };
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

function isFavourite(favourite) {
  return state.saved.favourites.some((item) => item.kind === favourite.kind && item.code === favourite.code && item.service === (favourite.service ?? ''));
}

function saveButton(favourite, onChange = () => {}) {
  const saved = isFavourite(favourite);
  const button = node('button', saved ? '★' : '☆', 'save-button');
  button.type = 'button';
  button.setAttribute('aria-label', saved ? 'Remove from saved entries' : 'Save entry');
  button.title = saved ? 'Remove from saved entries' : 'Save entry';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleFavourite(state.saved, favourite);
    saveState(window.localStorage, state.saved);
    onChange();
    renderCurrent();
  });
  return button;
}

function minutesLabel(item) {
  return formatEtaLabel(item.estimatedArrival);
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

function etaBadge(icon, label, className) {
  const badge = node("span", undefined, "eta-badge " + className);
  badge.setAttribute("aria-label", label);
  badge.title = label;
  const iconNode = node("span", icon, "eta-badge-icon");
  iconNode.setAttribute("aria-hidden", "true");
  badge.append(iconNode, node("span", label, "eta-badge-label"));
  return badge;
}

function loadIcon(code) {
  return ({ SEA: "●", SDA: "◐", LSD: "◒" })[code] ?? null;
}

function renderArrivalIndicators(arrival) {
  const box = node("span", undefined, "eta-indicators");
  const crowdIcon = loadIcon(arrival.load);
  if (crowdIcon) box.append(etaBadge(crowdIcon, "Crowd: " + loadLabel(arrival.load), "crowd-status crowd-" + arrival.load.toLowerCase()));
  if (arrival.wheelchairAccessible === true) box.append(etaBadge("♿", "Wheelchair accessible", "wheelchair-status"));
  return box.childElementCount ? box : null;
}

function renderArrivalMeta(arrival) {
  const box = node("div", undefined, "eta-meta");
  const destination = arrival.destinationName ? "To " + arrival.destinationName : arrival.destinationCode ? "To stop " + arrival.destinationCode : null;
  if (destination) box.append(node("span", destination, "eta-detail"));
  const vehicle = vehicleLabel(arrival.vehicleType);
  if (vehicle) box.append(node("span", vehicle, "eta-detail"));
  const monitoring = arrival.monitored === true ? "Live position" : arrival.monitored === false ? "Scheduled estimate" : null;
  if (monitoring) box.append(node("span", monitoring, "eta-detail"));
  if (arrival.estimatedLocation) {
    const link = mapLink("View estimated location", arrival.estimatedLocation.latitude, arrival.estimatedLocation.longitude);
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
    if (!service.arrivals.length) {
      card.append(head, node('p', 'No live arrival data is available for this service right now. This is not a prediction of zero wait time.', 'empty'));
    } else {
      const grid = node('div', undefined, 'eta-grid');
      for (const arrival of service.arrivals.slice(0, 3)) {
        const minutes = parseEtaMinutes(arrival.estimatedArrival);
        const eta = node('div', undefined, 'eta' + (minutes !== null && minutes <= 2 ? ' soon' : ''));
        const primary = node('div', undefined, 'eta-primary');
        primary.append(node('strong', minutesLabel(arrival)));
        const clock = minutes !== null && minutes < 60 ? formatEtaClock(arrival.estimatedArrival) : null;
        if (clock) primary.append(node('span', clock, 'eta-clock'));
        const indicators = renderArrivalIndicators(arrival);
        if (indicators) primary.append(indicators);
        eta.append(primary, renderArrivalMeta(arrival));
        grid.append(eta);
      }
      card.append(head, grid);
    }
    results.append(card);
  }
}

function trainDirectionCards(container, arrivals) {
  for (const groupArrivals of groupTrainArrivals(arrivals)) {
    const direction = node("div", undefined, "card train-direction");
    const directionId = groupArrivals.find((arrival) => arrival.directionId)?.directionId;
    const routes = [...new Set(groupArrivals.map((arrival) => arrival.route).filter(Boolean))];
    const destinations = [...new Set(groupArrivals.map((arrival) => arrival.destination).filter(Boolean))];
    const lineLabel = routes.length ? "Line " + routes.join(" / ") : null;
    const label = [lineLabel, directionId ? "Direction " + directionId : null].filter(Boolean).join(" · ") || "Direction not provided";
    const subtitle = destinations.length > 1 ? "Multiple destinations shown beside each arrival." : destinations.length ? "Destination shown beside each arrival." : "The feed did not provide a destination for these arrivals.";
    const directionHead = node("div", undefined, "card-head");
    const directionTitle = node("div");
    directionTitle.append(node("h3", label, "card-title"), node("p", subtitle, "card-sub"));
    directionHead.append(directionTitle);
    direction.append(directionHead);
    const grid = node("div", undefined, "eta-grid");
    for (const arrival of groupArrivals.slice(0, 6)) {
      const eta = node("div", undefined, "eta");
      const arrivalLabel = arrival.predictionStatus === "scheduled" ? "Planned schedule" : "Realtime feed";
      const primary = node("div", undefined, "eta-primary");
      primary.append(node("strong", minutesLabel(arrival)));
      if (arrival.destination) primary.append(node("span", "To " + arrival.destination, "eta-destination"));
      eta.append(primary, node("span", arrivalLabel));
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
    const codes = entry.station.codes?.join(' / ') || entry.station.id;
    title.append(node('h2', `${entry.station.name} · ${codes}`, 'card-title'), node('p', 'Verified station code(s)', 'card-sub'));
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


function renderCurrent() {
  if (state.current?.kind === 'bus' && state.current.data) renderBus(state.current.data, state.current.meta);
  if (state.current?.kind === 'train' && state.current.data) renderTrain(state.current.data, state.current.meta);
}

let searchRevision = 0;
let suggestionButtons = [];
let activeSuggestion = -1;

async function loadBusStops(query) {
  const body = await api(`/api/bus/stops?search=${encodeURIComponent(query)}&limit=20`);
  return body.data;
}

async function loadBusServices(query) {
  const body = await api(`/api/bus/services?search=${encodeURIComponent(query)}&limit=20`);
  return body.data;
}

async function loadTrainStations(query) {
  const body = await api(`/api/train/stations?search=${encodeURIComponent(query)}`);
  return body.data;
}

async function loadPlaces(query) {
  const body = await api(`/api/places/search?q=${encodeURIComponent(query)}`);
  return body.data.results;
}



async function collectSearchRecords(query) {
  const serviceQuery = normalizeStopCode(query) || /^[A-Z]{1,5}\d{1,3}$/i.test(query) ? null : normalizeService(query);
  const responses = await Promise.allSettled([
    loadBusStops(query),
    serviceQuery ? loadBusServices(serviceQuery) : Promise.resolve([]),
    loadTrainStations(query),
    query.length >= 3 ? loadPlaces(query) : Promise.resolve([]),
  ]);
  const stops = responses[0].status === "fulfilled" ? responses[0].value : [];
  const services = responses[1].status === "fulfilled" ? responses[1].value : [];
  const stations = responses[2].status === "fulfilled" ? responses[2].value : [];
  const places = responses[3].status === "fulfilled" ? responses[3].value : [];
  return [
    ...stops.map((item) => searchRecord("bus-stop", item, query, `Bus stop ${item.code} · ${item.name}`, item.road ? `Bus stop · ${item.road}` : "Bus stop", [item.code, item.name, item.road])),
    ...services.map((item) => searchRecord("bus-service", item, query, `Bus service ${item.serviceNo}`, [item.operator, item.category, item.originName, item.destinationName].filter(Boolean).join(" · ") || "Scheduled service", [item.serviceNo, item.originName, item.destinationName])),
    ...stations.map((item) => searchRecord("train-station", item, query, item.name, `MRT / LRT · ${(item.codes ?? [item.id]).join(" / ")}`, [item.name, item.id, ...(item.codes ?? []), ...(item.stopIds ?? [])])),
    ...places.map((item) => searchRecord("place", item, query, `Nearby transport · ${item.label}`, item.address || "Location", [item.label, item.address])),
  ].filter(Boolean).sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
}

function updateSearchHint(query) {
  const hint = $("#search-hint");
  if (!query) hint.textContent = "Try a station code, service number, bus stop, postal code, or location name.";
  else if (normalizeStopCode(query)) hint.textContent = "Bus stop code detected. Press Search for live arrivals.";
  else if (/^[A-Z]{1,5}\d{1,3}$/i.test(query)) hint.textContent = "Station code detected. We will verify it against the train directory.";
  else if (normalizeService(query)) hint.textContent = "Bus service number detected. Choose a scheduled service.";
  else hint.textContent = "Searching station names, stop names, roads, and nearby places…";
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

function chooseSearchRecord(record) {
  const input = $("#global-query");
  input.value = record.kind === "bus-stop" || record.kind === "bus" ? record.item.code : record.kind === "bus-service" ? record.item.serviceNo : record.kind === "train-station" ? record.item.name : record.item.label;
  $("#search-suggestions").replaceChildren();
  suggestionButtons = [];
  if (record.kind === "bus" || record.kind === "bus-stop") return refreshBus(record.item.code, record.item.service || "");
  if (record.kind === "bus-service") return showBusService(record.item);
  if (record.kind === "train-station") return refreshTrain(record.item);
  if (Number.isFinite(Number(record.item.latitude)) && Number.isFinite(Number(record.item.longitude))) return nearby(record.item.latitude, record.item.longitude);
  return loadPlaces(record.item.label).then((places) => places[0] ? nearby(places[0].latitude, places[0].longitude) : setStatus("That saved place could not be located."));
}

function parseDirectQuery(query) {
  const parts = query.split(/\s+/);
  const stop = parts.map(normalizeStopCode).find(Boolean);
  const service = parts.map(normalizeService).find((value) => value && !/^[A-Z]{1,5}\d{1,3}$/i.test(value));
  return stop && service ? { stop, service } : null;
}

async function searchAll(event) {
  event?.preventDefault();
  const query = $("#global-query").value.trim();
  if (!query) { state.searchQuery = ""; state.searchRecords = []; refreshSearchSuggestions(); setStatus(state.saved.favourites.length ? "Saved entries are shown below." : "Type to search bus stops, services, stations, or places."); return; }
  const direct = parseDirectQuery(query);
  if (direct) { $("#search-suggestions").replaceChildren(); await refreshBus(direct.stop, direct.service); return; }
  try {
    const records = state.searchQuery === query && state.searchRecords.length ? state.searchRecords : await collectSearchRecords(query);
    state.searchQuery = query;
    state.searchRecords = records;
    if (records.length === 1 && records[0].rank === 0) { await chooseSearchRecord(records[0]); return; }
    renderSuggestions($("#search-suggestions"), records, chooseSearchRecord);
    setStatus(records.length ? "Choose a result. Exact matches are shown first." : "No bus stops, services, stations, or nearby places matched.");
  } catch (error) { $("#search-suggestions").replaceChildren(); clearResults(); setStatus(apiError(error)); }
}

function scheduleSearch() {
  clearTimeout(state.searchTimer);
  const query = $("#global-query").value.trim();
  updateSearchHint(query);
  state.searchQuery = query;
  state.searchRecords = [];
  if (!query) { refreshSearchSuggestions(); setStatus(state.saved.favourites.length ? "Saved entries are shown below." : "Type to search bus stops, services, stations, or places."); return; }
  const revision = ++searchRevision;
  state.searchTimer = setTimeout(async () => {
    try {
      const records = await collectSearchRecords(query);
      if (revision !== searchRevision || $("#global-query").value.trim() !== query) return;
      state.searchRecords = records;
      renderSuggestions($("#search-suggestions"), records, chooseSearchRecord);
    } catch (error) {
      if (revision === searchRevision) setStatus(apiError(error));
    }
  }, 280);
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

async function refreshTrain(station) {
  clearResults();
  setStatus('Loading train arrivals…');
  $('#refresh-button').hidden = false;
  try {
    const body = await api(`/api/train/arrivals?station=${encodeURIComponent(station.id)}`);
    state.current = { kind: 'train', station, data: body.data, meta: body.meta };
    renderTrain(body.data);
    setStatus(body.meta.status === 'live' ? 'Updated from the verified LTA realtime feed.' : body.meta.status === 'mixed' ? 'The interchange lines have mixed live, planned, or unavailable data.' : body.meta.status === 'scheduled' ? 'No disruption update was available; showing planned schedule times.' : body.meta.status === 'stale' ? 'Live data was unavailable; showing the last known planned schedule.' : 'No train arrivals are available for this station code.');
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
    const radius = state.saved.nearbyRadius;
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


function scheduleRefresh() {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    if (!document.hidden && state.current) {
      if (state.current.kind === 'bus') refreshBus(state.current.stop, state.current.service);
      else if (state.current.kind === 'train') refreshTrain(state.current.station);
    }
  }, state.saved.pollingSeconds * 1000);
}


$('#search-form').addEventListener('submit', searchAll);
$('#global-query').addEventListener('input', scheduleSearch);
$('#global-query').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestion(activeSuggestion + 1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion(activeSuggestion - 1); }
  if (event.key === 'Escape') { $('#search-suggestions').replaceChildren(); suggestionButtons = []; activeSuggestion = -1; }
  if (event.key === "Enter" && activeSuggestion >= 0 && suggestionButtons[activeSuggestion]) { event.preventDefault(); suggestionButtons[activeSuggestion].querySelector(".suggestion-result").click(); }
});
$('#refresh-button').addEventListener('click', () => state.current?.kind === 'bus' ? refreshBus(state.current.stop, state.current.service) : refreshTrain(state.current.station));
$('#location-button').addEventListener('click', () => {
  if (!navigator.geolocation) { setStatus('Location is not available in this browser.'); return; }
  setStatus('Waiting for your permission…');
  navigator.geolocation.getCurrentPosition(({ coords }) => nearby(coords.latitude, coords.longitude), () => setStatus('Location permission was denied or unavailable. Nothing was saved.'), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
});
$('#settings-button').addEventListener('click', () => { $('#theme-select').value = state.saved.theme; $('#polling-select').value = String(state.saved.pollingSeconds); $('#nearby-radius').value = String(state.saved.nearbyRadius); $('#settings-dialog').showModal(); });
$('#settings-form').addEventListener('submit', (event) => {
  if (event.submitter?.id !== 'save-settings') return;
  state.saved.theme = $('#theme-select').value;
  state.saved.pollingSeconds = Number($('#polling-select').value); state.saved.nearbyRadius = Number($('#nearby-radius').value);
  saveState(window.localStorage, state.saved);
  applyTheme();
  if (state.current) scheduleRefresh();
});

function applyTheme() { document.documentElement.dataset.theme = state.saved.theme === 'system' ? '' : state.saved.theme; }
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(state.timer); else if (state.current) scheduleRefresh(); });
applyTheme();
refreshSearchSuggestions();
loadAlerts();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
function favouriteForRecord(kind, item) {
  if (kind === 'bus-stop') return { kind: 'bus-stop', code: item.code, service: '', name: item.name || `Stop ${item.code}` };
  if (kind === 'bus-service') return { kind: 'bus-service', code: item.serviceNo, service: '', name: `Service ${item.serviceNo}` };
  if (kind === 'train-station') return { kind: 'train', code: item.id, service: '', name: item.name };
  return { kind: 'place', code: item.label, service: '', name: item.label };
}

function savedRecord(favourite) {
  if (favourite.kind === 'bus' || favourite.kind === 'bus-stop') return { kind: favourite.kind, item: { code: favourite.code, name: favourite.name, service: favourite.service }, rank: 2, label: favourite.kind === 'bus' ? `Bus service ${favourite.service} · Stop ${favourite.code}` : `Bus stop ${favourite.code} · ${favourite.name}`, detail: 'Saved bus entry', favourite };
  if (favourite.kind === 'bus-service') return { kind: 'bus-service', item: { serviceNo: favourite.code }, rank: 2, label: 'Bus service ' + favourite.code, detail: 'Saved bus service', favourite };
  if (favourite.kind === 'train') return { kind: 'train-station', item: { id: favourite.code, name: favourite.name, stopIds: [] }, rank: 2, label: favourite.name, detail: `Saved MRT / LRT station · ${favourite.code}`, favourite };
  return { kind: 'place', item: { label: favourite.name }, rank: 2, label: favourite.name, detail: 'Saved nearby location', favourite };
}

function searchRecord(kind, item, query, label, detail, fields) {
  const rank = searchMatchRank(fields, query);
  return rank < 0 ? null : { kind, item, rank, label, detail, favourite: favouriteForRecord(kind, item) };
}

function renderSuggestions(container, records, onSelect) {
  suggestionButtons = [];
  activeSuggestion = -1;
  const ordered = sortSearchRecords(records.map((record) => ({ ...record, saved: isFavourite(record.favourite) })));
  const groups = [[(record) => record.saved, 'Saved'], [(record) => !record.saved && record.rank === 0, 'Exact match'], [(record) => !record.saved && record.rank === 1, 'Starting with'], [(record) => !record.saved && record.rank === 2, 'Other matches']];
  const elements = [];
  for (const [matches, title] of groups) {
    const group = ordered.filter(matches);
    if (!group.length) continue;
    elements.push(node('div', title, 'suggestion-group-label'));
    for (const record of group) {
      const row = node('div', undefined, 'suggestion');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      const select = node('button', undefined, 'suggestion-result');
      select.type = 'button';
      select.append(node('strong', record.label), node('span', record.detail, 'suggestion-detail'));
      select.addEventListener('click', () => { onSelect(record); container.replaceChildren(); suggestionButtons = []; activeSuggestion = -1; });
      row.append(select, saveButton(record.favourite, refreshSearchSuggestions));
      suggestionButtons.push(row);
      elements.push(row);
    }
  }
  container.replaceChildren(...elements);
}

function refreshSearchSuggestions() {
  const query = $('#global-query').value.trim();
  renderSuggestions($('#search-suggestions'), query ? state.searchRecords : state.saved.favourites.map(savedRecord), chooseSearchRecord);
}

function setActiveSuggestion(index) {
  if (!suggestionButtons.length) return;
  activeSuggestion = (index + suggestionButtons.length) % suggestionButtons.length;
  suggestionButtons.forEach((row, rowIndex) => {
    const selected = rowIndex === activeSuggestion;
    row.setAttribute('aria-selected', String(selected));
    if (selected) row.scrollIntoView({ block: 'nearest' });
  });
}
