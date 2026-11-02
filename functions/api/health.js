import { json } from '../_lib/http.js';

export function onRequestGet() {
  return json({ service: 'sg-transit', status: 'ok' }, {
    source: 'SG Transit',
    status: 'live',
    fetchedAt: new Date().toISOString(),
  });
}
