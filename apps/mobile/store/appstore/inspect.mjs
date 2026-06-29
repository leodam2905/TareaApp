import { asc } from './asc.mjs';
const id = '6784023441'; // Tarea Home
console.log('=== appInfos ===');
let r = await asc(`/v1/apps/${id}/appInfos`);
for (const ai of (r.body.data||[])) {
  console.log(' appInfo', ai.id, 'state=', ai.attributes.state);
  const loc = await asc(`/v1/appInfos/${ai.id}/appInfoLocalizations`);
  (loc.body.data||[]).forEach(l=>console.log('   loc', l.id, l.attributes.locale, 'name=', l.attributes.name, 'subtitle=', l.attributes.subtitle));
}
console.log('=== appStoreVersions ===');
r = await asc(`/v1/apps/${id}/appStoreVersions`);
for (const v of (r.body.data||[])) {
  console.log(' version', v.id, v.attributes.versionString, 'state=', v.attributes.appStoreState, 'platform=', v.attributes.platform);
  const loc = await asc(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`);
  (loc.body.data||[]).forEach(l=>console.log('   verLoc', l.id, l.attributes.locale, 'descLen=', (l.attributes.description||'').length, 'kw=', l.attributes.keywords));
}
