import { asc } from '/Users/monsegueadah/TareaApp/apps/mobile/store/appstore/asc.mjs';
const V = { customer: { app: '6784023441', ver: 'ce5f3cb4-1526-4cf5-a37a-1cef8ef33668' },
            pro:      { app: '6784029141', ver: '1ae7094e-72e8-41c9-aeb1-76ec07f3e4a5' } };
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
