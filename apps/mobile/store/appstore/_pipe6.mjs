import { asc } from './asc.mjs';
const appId='6784029141', verId='5d42ae4a-6c6c-4bc5-8ed9-3521c95d2f51', groupId='53e8e99b-2b41-4d24-8382-e8efb1eebbf8';
let b6=null;
for (let i=1;i<=30;i++){
  const b = await asc(`/v1/apps/${appId}/builds?limit=8&fields[builds]=version,processingState`);
  b6=(b.body.data||[]).find(x=>x.attributes.version==='6');
  console.log(new Date().toTimeString().slice(0,5),'build 6:', b6?b6.attributes.processingState:'not visible');
  if (b6?.attributes.processingState==='VALID') break;
  await new Promise(r=>setTimeout(r,60000));
}
if (b6?.attributes.processingState!=='VALID'){ console.log('build 6 not VALID yet'); process.exit(1); }
await asc(`/v1/betaGroups/${groupId}/relationships/builds`, { method:'POST', body: JSON.stringify({ data:[{ type:'builds', id: b6.id }] }) });
console.log('✅ build 6 in TestFlight');
await asc(`/v1/appStoreVersions/${verId}/relationships/build`, { method:'PATCH', body: JSON.stringify({ data:{ type:'builds', id: b6.id } }) });
console.log('✅ build 6 attached to version');
const rs = await asc(`/v1/apps/${appId}/reviewSubmissions?limit=8`);
for (const s of (rs.body.data||[])) if (['UNRESOLVED_ISSUES','READY_FOR_REVIEW','WAITING_FOR_REVIEW','IN_REVIEW'].includes(s.attributes.state)){
  await asc(`/v1/reviewSubmissions/${s.id}`, { method:'PATCH', body: JSON.stringify({ data:{ type:'reviewSubmissions', id:s.id, attributes:{ canceled:true } } }) });
  console.log('canceled stale', s.id.slice(0,8), s.attributes.state);
}
const sub = await asc('/v1/reviewSubmissions', { method:'POST', body: JSON.stringify({ data:{ type:'reviewSubmissions', attributes:{ platform:'IOS' }, relationships:{ app:{ data:{ type:'apps', id: appId } } } } }) });
const newSub = sub.body.data.id;
for (let i=1;i<=24;i++){
  let it = await asc('/v1/reviewSubmissionItems', { method:'POST', body: JSON.stringify({ data:{ type:'reviewSubmissionItems', relationships:{ reviewSubmission:{ data:{ type:'reviewSubmissions', id:newSub } }, appStoreVersion:{ data:{ type:'appStoreVersions', id:verId } } } } }) });
  if (it.status<400 || (it.body?.errors?.[0]?.title||'').includes('already')){
    let s = await asc(`/v1/reviewSubmissions/${newSub}`, { method:'PATCH', body: JSON.stringify({ data:{ type:'reviewSubmissions', id:newSub, attributes:{ submitted:true } } }) });
    if (s.status<400){ console.log(`✅✅ SUBMITTED build 6 — ${s.body?.data?.attributes?.state}`); process.exit(0); }
  }
  console.log(`${new Date().toTimeString().slice(0,5)} attempt ${i}: not ready — retry 120s`);
  await new Promise(r=>setTimeout(r,120000));
}
