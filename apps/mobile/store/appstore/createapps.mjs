import { asc } from './asc.mjs';
const apps = [
  { name: 'Tarea: Find a Handyman', bundleId: 'com.taptarea.customer', sku: 'TAREA-CUSTOMER-001' },
  { name: 'Tarea Pro: Handyman Jobs', bundleId: 'com.taptarea.handyman', sku: 'TAREA-HANDYMAN-001' },
];
for (const a of apps) {
  const res = await asc('/v1/apps', { method: 'POST', body: JSON.stringify({
    data: {
      type: 'apps',
      attributes: { name: a.name, primaryLocale: 'en-US', bundleId: a.bundleId, sku: a.sku },
    }
  })});
  console.log(`create "${a.name}" -> ${res.status}`);
  if (res.status >= 300) console.log('   ', JSON.stringify(res.body.errors||res.body).slice(0,400));
  else console.log('   id=', res.body.data.id);
}
