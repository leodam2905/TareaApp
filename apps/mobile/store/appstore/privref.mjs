import { asc } from './asc.mjs';
for (const [label, path] of [['CATEGORIES','/v1/appDataUsageCategories?limit=200'],['PURPOSES','/v1/appDataUsagePurposes?limit=200'],['PROTECTIONS','/v1/appDataUsageDataProtections?limit=200']]) {
  const r = await asc(path);
  console.log(`=== ${label} (${r.status}) ===`);
  if (r.status===200) console.log((r.body.data||[]).map(d=>d.id).join(', '));
  else console.log(JSON.stringify(r.body).slice(0,200));
}
