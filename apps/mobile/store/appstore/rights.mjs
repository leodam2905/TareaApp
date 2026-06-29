import { asc } from './asc.mjs';
for (const appId of ['6784023441','6784029141']) {
  const r = await asc(`/v1/apps/${appId}`, { method:'PATCH', body: JSON.stringify({
    data: { type:'apps', id: appId, attributes: { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' } }
  })});
  console.log(`${appId}: contentRights -> ${r.status==200 ? '✅ '+r.body.data.attributes.contentRightsDeclaration : r.status+' '+JSON.stringify(r.body.errors).slice(0,200)}`);
}
