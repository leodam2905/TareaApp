import { asc } from './asc.mjs';
const apps = await asc('/v1/apps?limit=200');
console.log('GET /v1/apps ->', apps.status);
if (apps.status === 200) {
  console.log('existing apps:', (apps.body.data||[]).map(a => `${a.attributes.name} (${a.attributes.bundleId})`));
} else {
  console.log(JSON.stringify(apps.body).slice(0,500));
}
