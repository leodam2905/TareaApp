import { asc } from '/Users/monsegueadah/TareaApp/apps/mobile/store/appstore/asc.mjs';
const V = { customer: { app: '6784023441', ver: 'db25abc0-dc25-4e3a-98a6-9a8a41f2bec3' },
            pro:      { app: '6784029141', ver: 'c176576a-3498-4231-abac-34669e945a64' } };
for (const [name, { app, ver }] of Object.entries(V)) {
  console.log(`\n=== ${name} ===`);
  const sub = await asc('/v1/reviewSubmissions', { method: 'POST', body: JSON.stringify({ data: {
    type: 'reviewSubmissions', attributes: { platform: 'IOS' },
    relationships: { app: { data: { type: 'apps', id: app } } } } }) });
  if (sub.status >= 300) { console.log(`  create submission failed ${sub.status}: ${JSON.stringify(sub.body?.errors?.[0]?.detail)}`); continue; }
  const sid = sub.body.data.id;
  console.log(`  submission ${sid}`);
  const item = await asc('/v1/reviewSubmissionItems', { method: 'POST', body: JSON.stringify({ data: {
    type: 'reviewSubmissionItems',
    relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sid } },
                     appStoreVersion: { data: { type: 'appStoreVersions', id: ver } } } } }) });
  console.log(`  item added: ${item.status < 300 ? 'ok' : item.status + ' ' + JSON.stringify(item.body?.errors?.[0]?.detail)}`);
  if (item.status >= 300) continue;
  const done = await asc(`/v1/reviewSubmissions/${sid}`, { method: 'PATCH', body: JSON.stringify({ data: {
    type: 'reviewSubmissions', id: sid, attributes: { submitted: true } } }) });
  console.log(`  SUBMITTED: ${done.status < 300 ? 'yes — state ' + done.body?.data?.attributes?.state : done.status + ' ' + JSON.stringify(done.body?.errors?.[0]?.detail)}`);
}
