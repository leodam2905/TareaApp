import { asc } from './asc.mjs';
for (const [name, appId] of [['Tarea Home','6784023441'],['Tarea Pro','6784029141']]) {
  const ver = await asc(`/v1/apps/${appId}/appStoreVersions?limit=1`);
  const v = ver.body.data[0];
  console.log(`\n${name}: version ${v.attributes.versionString} state=${v.attributes.appStoreState}`);
  const build = await asc(`/v1/appStoreVersions/${v.id}/build`);
  console.log('  build attached:', build.body.data ? build.body.data.id : 'NONE — needs attaching');
  // get the valid build to attach
  const builds = await asc(`/v1/builds?filter[app]=${appId}&limit=1`);
  console.log('  available build:', builds.body.data?.[0]?.id, '(v'+builds.body.data?.[0]?.attributes.version+')');
}
