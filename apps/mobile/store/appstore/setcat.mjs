import { asc } from './asc.mjs';
const map = { '6784023441': 'LIFESTYLE', '6784029141': 'BUSINESS' };
for (const [appId, cat] of Object.entries(map)) {
  const ai = await asc(`/v1/apps/${appId}/appInfos`);
  const appInfoId = ai.body.data[0].id;
  const r = await asc(`/v1/appInfos/${appInfoId}`, { method:'PATCH', body: JSON.stringify({
    data: { type:'appInfos', id: appInfoId, relationships: { primaryCategory: { data: { type:'appCategories', id: cat } } } }
  })});
  console.log(`app ${appId} -> primaryCategory ${cat}: ${r.status==200?'OK':JSON.stringify(r.body.errors).slice(0,200)}`);
}
