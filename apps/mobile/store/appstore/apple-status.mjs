import { asc } from './asc.mjs';
console.log('=== APPLE APP STORE ===');
for (const [name, appId] of [['Tarea Home','6784023441'],['Tarea Pro','6784029141']]) {
  const ver = await asc(`/v1/apps/${appId}/appStoreVersions?limit=1`);
  const v = ver.body.data[0];
  console.log(`  ${name}: version ${v.attributes.versionString} state=${v.attributes.appStoreState}`);
}
