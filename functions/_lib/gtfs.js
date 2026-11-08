function readVarint(bytes, state) {
  let value = 0n;
  let shift = 0n;
  while (state.offset < bytes.length) {
    const byte = bytes[state.offset++];
    value |= BigInt(byte & 0x7f) << shift;
    if (!(byte & 0x80)) return value;
    shift += 7n;
    if (shift > 70n) throw new Error('Invalid protobuf varint');
  }
  throw new Error('Truncated protobuf varint');
}

function text(bytes) { return new TextDecoder().decode(bytes); }

export function decodeGtfsRealtime(bytes) {
  const feed = { entities: [] };
  const state = { offset: 0 };
  while (state.offset < bytes.length) {
    const tag = Number(readVarint(bytes, state));
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 0) { readVarint(bytes, state); continue; }
    if (wire !== 2) throw new Error('Unsupported protobuf wire type');
    const length = Number(readVarint(bytes, state));
    const end = state.offset + length;
    if (end > bytes.length) throw new Error('Truncated protobuf message');
    const chunk = bytes.subarray(state.offset, end);
    state.offset = end;
    if (field === 2) feed.entities.push(decodeEntity(chunk));
  }
  return feed;
}

function decodeEntity(bytes) {
  const entity = {};
  const state = { offset: 0 };
  while (state.offset < bytes.length) {
    const tag = Number(readVarint(bytes, state));
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 0) { entity[field] = Number(readVarint(bytes, state)); continue; }
    if (wire !== 2) throw new Error('Unsupported entity wire type');
    const length = Number(readVarint(bytes, state));
    const chunk = bytes.subarray(state.offset, state.offset + length);
    state.offset += length;
    if (field === 1) entity.id = text(chunk);
    if (field === 3) entity.tripUpdate = decodeTripUpdate(chunk);
  }
  return entity;
}

function decodeTripUpdate(bytes) {
  const tripUpdate = { stopTimeUpdates: [] };
  const state = { offset: 0 };
  while (state.offset < bytes.length) {
    const tag = Number(readVarint(bytes, state));
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 0) { readVarint(bytes, state); continue; }
    const length = Number(readVarint(bytes, state));
    const chunk = bytes.subarray(state.offset, state.offset + length);
    state.offset += length;
    if (field === 1) tripUpdate.trip = decodeTrip(chunk);
    if (field === 2) tripUpdate.stopTimeUpdates.push(decodeStopTimeUpdate(chunk));
  }
  return tripUpdate;
}

function decodeTrip(bytes) {
  const trip = {};
  const state = { offset: 0 };
  while (state.offset < bytes.length) {
    const tag = Number(readVarint(bytes, state));
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 0) { readVarint(bytes, state); continue; }
    const length = Number(readVarint(bytes, state));
    const chunk = bytes.subarray(state.offset, state.offset + length);
    state.offset += length;
    if (field === 1) trip.tripId = text(chunk);
    if (field === 5) trip.routeId = text(chunk);
  }
  return trip;
}

function decodeStopTimeUpdate(bytes) {
  const update = {};
  const state = { offset: 0 };
  while (state.offset < bytes.length) {
    const tag = Number(readVarint(bytes, state));
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 0) { update[field] = Number(readVarint(bytes, state)); continue; }
    const length = Number(readVarint(bytes, state));
    const chunk = bytes.subarray(state.offset, state.offset + length);
    state.offset += length;
    if (field === 4) update.stopId = text(chunk);
    if (field === 2) update.arrival = decodeEvent(chunk);
    if (field === 3) update.departure = decodeEvent(chunk);
  }
  return update;
}

function decodeEvent(bytes) {
  const event = {};
  const state = { offset: 0 };
  while (state.offset < bytes.length) {
    const tag = Number(readVarint(bytes, state));
    const field = tag >> 3;
    if ((tag & 7) === 0) event[field] = Number(readVarint(bytes, state));
    else throw new Error('Unsupported stop event wire type');
  }
  return { delay: event[1] ?? 0, time: event[2] ?? 0 };
}

export function csvRows(csv, include) {
  const rows = [];
  let headers = null;
  let fields = [], field = '', quoted = false;
  const finishRow = () => {
    fields.push(field);
    if (!fields.some(Boolean)) { fields = []; field = ''; return; }
    if (!headers) headers = fields.map((value) => value.replace(/^\uFEFF/, ''));
    else {
      const row = Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? '']));
      if (!include || include(row)) rows.push(row);
    }
    fields = [];
    field = '';
  };
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { fields.push(field); field = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      finishRow();
    } else field += character;
  }
  if (field || fields.length) finishRow();
  return rows;
}
