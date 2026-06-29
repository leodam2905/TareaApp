import { asc } from './asc.mjs';
const appId='6784023441';
// existing usages + publish state
console.log('appDataUsages:', (await asc(`/v1/apps/${appId}/appDataUsages`)).status);
console.log('publishState:', JSON.stringify((await asc(`/v1/apps/${appId}/appDataUsagesPublishState`)).body).slice(0,200));
// probe POST to learn required relationships from the error
const probe = await asc('/v1/appDataUsages', { method:'POST', body: JSON.stringify({
  data: { type:'appDataUsages', relationships: {
    app: { data:{ type:'apps', id: appId } },
    category: { data:{ type:'appDataUsageCategories', id:'NAME' } },
    grant: { data:{ type:'appDataUsageGrants', id:'APP_FUNCTIONALITY' } },
    dataProtection: { data:{ type:'appDataUsageDataProtections', id:'DATA_LINKED_TO_YOU' } },
  } }
})});
console.log('probe POST status:', probe.status);
console.log(JSON.stringify(probe.body.errors||probe.body.data||probe.body).slice(0,600));
