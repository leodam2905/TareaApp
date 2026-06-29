import { asc } from './asc.mjs';
const COPYRIGHT = '© 2026 Tarea US LLC';
async function go(name, appId) {
  console.log(`\n=== ${name} ===`);
  const ver = await asc(`/v1/apps/${appId}/appStoreVersions?limit=1`);
  const verId = ver.body.data[0].id;
  // 1. set copyright
  const c = await asc(`/v1/appStoreVersions/${verId}`, { method:'PATCH', body: JSON.stringify({
    data: { type:'appStoreVersions', id: verId, attributes: { copyright: COPYRIGHT } }
  })});
  console.log('  copyright set:', c.status===200?'✅':c.status+' '+JSON.stringify(c.body.errors?.[0]?.detail||'').slice(0,150));
  // 2. find or create review submission
  let rsId;
  const ex = await asc(`/v1/apps/${appId}/reviewSubmissions?limit=10`);
  const open = (ex.body.data||[]).find(s=>s.attributes.state==='READY_FOR_REVIEW' && !s.attributes.submitted);
  if (open) { rsId = open.id; console.log('  reusing reviewSubmission', rsId); }
  else {
    const rs = await asc('/v1/reviewSubmissions', { method:'POST', body: JSON.stringify({
      data: { type:'reviewSubmissions', attributes:{ platform:'IOS' }, relationships:{ app:{ data:{ type:'apps', id:appId } } } } })});
    rsId = rs.body.data?.id; console.log('  created reviewSubmission', rsId, rs.status);
  }
  // 3. add item (skip if already has one)
  const items = await asc(`/v1/reviewSubmissions/${rsId}/items`);
  if (!(items.body.data||[]).length) {
    const item = await asc('/v1/reviewSubmissionItems', { method:'POST', body: JSON.stringify({
      data: { type:'reviewSubmissionItems', relationships:{
        reviewSubmission:{ data:{ type:'reviewSubmissions', id:rsId } },
        appStoreVersion:{ data:{ type:'appStoreVersions', id:verId } } } } })});
    console.log('  add version item:', item.status===201?'✅':item.status+' '+JSON.stringify(item.body.errors?.[0]?.detail||'').slice(0,180));
  } else console.log('  item already present');
  // 4. submit
  const sub = await asc(`/v1/reviewSubmissions/${rsId}`, { method:'PATCH', body: JSON.stringify({
    data: { type:'reviewSubmissions', id:rsId, attributes:{ submitted:true } } })});
  console.log('  SUBMIT:', sub.status===200?'🚀 ✅ SUBMITTED FOR REVIEW':sub.status+' '+JSON.stringify(sub.body.errors?.[0]?.detail||'').slice(0,220));
}
await go('Tarea Home','6784023441');
await go('Tarea Pro','6784029141');
