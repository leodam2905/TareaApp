import { asc } from './asc.mjs';
const r = await asc('/v1/bundleIds?limit=200&filter[platform]=IOS');
console.log('status', r.status);
if (r.status === 200) {
  (r.body.data||[]).forEach(b => console.log(`  ${b.attributes.identifier.padEnd(28)} name="${b.attributes.name}"  id=${b.id}`));
} else console.log(JSON.stringify(r.body).slice(0,400));
