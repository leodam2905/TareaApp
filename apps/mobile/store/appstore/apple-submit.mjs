import { asc } from './asc.mjs';
async function submitApp(name, appId) {
  console.log(`\n=== ${name} (${appId}) ===`);
  const ver = await asc(`/v1/apps/${appId}/appStoreVersions?limit=1`);
  const verId = ver.body.data[0].id;
  const builds = await asc(`/v1/builds?filter[app]=${appId}&limit=1`);
  const buildId = builds.body.data[0].id;
  // 1. attach build to version
  const a = await asc(`/v1/appStoreVersions/${verId}`, { method:'PATCH', body: JSON.stringify({
    data: { type:'appStoreVersions', id: verId, relationships: { build: { data: { type:'builds', id: buildId } } } }
  })});
  console.log('  1. attach build:', a.status===200?'✅':a.status+' '+JSON.stringify(a.body.errors?.[0]?.detail||'').slice(0,150));
  // 2. create review submission
  const rs = await asc('/v1/reviewSubmissions', { method:'POST', body: JSON.stringify({
    data: { type:'reviewSubmissions', attributes: { platform:'IOS' }, relationships: { app: { data:{ type:'apps', id: appId } } } }
  })});
  if (rs.status>=300) { console.log('  2. reviewSubmission:', rs.status, JSON.stringify(rs.body.errors?.[0]?.detail||rs.body).slice(0,200)); return; }
  const rsId = rs.body.data.id;
  console.log('  2. reviewSubmission created:', rsId);
  // 3. add version as item
  const item = await asc('/v1/reviewSubmissionItems', { method:'POST', body: JSON.stringify({
    data: { type:'reviewSubmissionItems', relationships: {
      reviewSubmission: { data:{ type:'reviewSubmissions', id: rsId } },
      appStoreVersion: { data:{ type:'appStoreVersions', id: verId } } } }
  })});
  console.log('  3. add version item:', item.status===201?'✅':item.status+' '+JSON.stringify(item.body.errors?.[0]?.detail||'').slice(0,180));
  // 4. submit
  const sub = await asc(`/v1/reviewSubmissions/${rsId}`, { method:'PATCH', body: JSON.stringify({
    data: { type:'reviewSubmissions', id: rsId, attributes: { submitted: true } }
  })});
  console.log('  4. SUBMIT FOR REVIEW:', sub.status===200?'🚀 ✅ SUBMITTED':sub.status+' '+JSON.stringify(sub.body.errors?.[0]?.detail||'').slice(0,250));
}
await submitApp('Tarea Home','6784023441');
await submitApp('Tarea Pro','6784029141');
