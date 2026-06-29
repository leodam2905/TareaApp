import { asc } from './asc.mjs';
const r = await asc('/v1/apps?limit=200');
console.log('apps in App Store Connect:');
(r.body.data||[]).forEach(a => console.log(`  "${a.attributes.name}" — ${a.attributes.bundleId} — sku=${a.attributes.sku} — id=${a.id}`));
