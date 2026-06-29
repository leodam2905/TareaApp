import { asc } from './asc.mjs';
for (const [name, appId] of [['Tarea Home','6784023441'],['Tarea Pro','6784029141']]) {
  const r = await asc(`/v1/builds?filter[app]=${appId}&limit=5`);
  console.log(`\n=== ${name} builds (${r.status}) ===`);
  if (r.status===200) {
    if (!r.body.data?.length) console.log('  NO builds found (still uploading/processing or none arrived)');
    r.body.data?.forEach(b=>console.log(`  v${b.attributes.version} state=${b.attributes.processingState} uploaded=${b.attributes.uploadedDate} expired=${b.attributes.expired}`));
  } else console.log(JSON.stringify(r.body).slice(0,200));
}
