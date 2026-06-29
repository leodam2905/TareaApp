import { asc } from './asc.mjs';
const appId='6784023441';
// current price schedule
console.log('appPriceSchedule:', (await asc(`/v1/apps/${appId}/appPriceSchedule`)).status);
// find the FREE price point (USA base territory)
const r = await asc(`/v1/apps/${appId}/appPricePoints?filter[territory]=USA&include=territory&limit=200`);
console.log('appPricePoints status:', r.status);
if (r.status===200) {
  const free = (r.body.data||[]).find(p => p.attributes.customerPrice === '0' || p.attributes.customerPrice === '0.00' || parseFloat(p.attributes.customerPrice)===0);
  console.log('  total points:', r.body.data.length, '| FREE point id:', free?.id, 'price:', free?.attributes.customerPrice);
} else console.log(JSON.stringify(r.body).slice(0,300));
