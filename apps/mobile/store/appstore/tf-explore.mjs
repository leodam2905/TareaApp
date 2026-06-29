import { asc } from './asc.mjs';
for (const [name, appId] of [['Tarea Home','6784023441'],['Tarea Pro','6784029141']]) {
  console.log(`\n=== ${name} (${appId}) ===`);
  const builds = await asc(`/v1/apps/${appId}/builds?limit=3&sort=-version`);
  (builds.body.data||[]).forEach(b=>console.log(`  build ${b.attributes.version} processing=${b.attributes.processingState} expired=${b.attributes.expired} id=${b.id}`));
  const groups = await asc(`/v1/apps/${appId}/betaGroups?limit=10`);
  console.log('  betaGroups:', (groups.body.data||[]).map(g=>`${g.attributes.name}(internal=${g.attributes.isInternalGroup})`).join(', ')||'(none)');
}
