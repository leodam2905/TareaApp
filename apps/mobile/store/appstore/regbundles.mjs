import { asc } from './asc.mjs';
// list ALL bundle ids (no filter)
let r = await asc('/v1/bundleIds?limit=200');
console.log('=== all bundleIds ===');
(r.body.data||[]).forEach(b => console.log(`  ${b.attributes.identifier} [${b.attributes.platform}] id=${b.id}`));

// register the two real ones if missing
const have = new Set((r.body.data||[]).map(b => b.attributes.identifier));
const want = [
  { identifier: 'com.taptarea.customer', name: 'Tarea Customer' },
  { identifier: 'com.taptarea.handyman', name: 'Tarea Handyman' },
];
for (const w of want) {
  if (have.has(w.identifier)) { console.log(`already registered: ${w.identifier}`); continue; }
  const res = await asc('/v1/bundleIds', { method: 'POST', body: JSON.stringify({
    data: { type: 'bundleIds', attributes: { identifier: w.identifier, name: w.name, platform: 'IOS', seedId: undefined } }
  })});
  console.log(`register ${w.identifier} -> ${res.status} ${res.status===201 ? 'OK id='+res.body.data.id : JSON.stringify(res.body.errors||res.body).slice(0,300)}`);
}
