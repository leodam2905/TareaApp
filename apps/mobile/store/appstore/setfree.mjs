import { asc } from './asc.mjs';
async function makeFree(appId, name) {
  const r = await asc(`/v1/apps/${appId}/appPricePoints?filter[territory]=USA&limit=200`);
  const free = (r.body.data||[]).find(p => parseFloat(p.attributes.customerPrice)===0);
  if (!free) { console.log(`${name}: no free price point found`); return; }
  const res = await asc('/v1/appPriceSchedules', { method:'POST', body: JSON.stringify({
    data: {
      type: 'appPriceSchedules',
      relationships: {
        app: { data: { type:'apps', id: appId } },
        baseTerritory: { data: { type:'territories', id:'USA' } },
        manualPrices: { data: [{ type:'appPrices', id:'${new-price}' }] },
      },
    },
    included: [{
      type: 'appPrices', id: '${new-price}',
      attributes: {},
      relationships: { appPricePoint: { data: { type:'appPricePoints', id: free.id } } },
    }],
  })});
  console.log(`${name} (${appId}): set Free -> ${res.status==201?'✅ OK':res.status+' '+JSON.stringify(res.body.errors).slice(0,300)}`);
}
await makeFree('6784023441','Tarea Home');
await makeFree('6784029141','Tarea Pro');
