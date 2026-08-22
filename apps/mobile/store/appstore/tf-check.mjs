import { asc } from './asc.mjs';
for (const [name, appId] of [['Tarea Home','6784023441'],['Tarea Pro','6784029141']]) {
  const r = await asc(`/v1/builds?filter[app]=${appId}&limit=2`);
  console.log(`\n${name}:`);
  for (const b of r.body.data ?? []) {
    const d = await asc(`/v1/builds/${b.id}/buildBetaDetail`);
    console.log(`  v${b.attributes.version}  processing=${b.attributes.processingState}  testflight=${d.body.data?.attributes?.internalBuildState ?? '-'}`);
  }
}
