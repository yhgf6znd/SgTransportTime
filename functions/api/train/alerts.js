import { json, run } from '../../_lib/http.js';
import { trainAlerts } from '../../_lib/train.js';

export const onRequestGet = run(async ({ env }) => json({ alerts: await trainAlerts(env) }, {
  source: 'LTA DataMall TrainServiceAlerts', status: 'live', fetchedAt: new Date().toISOString(), cached: false,
}));
