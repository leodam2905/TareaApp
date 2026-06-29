import { asc } from './asc.mjs';
const appId='6784023441';
const app = await asc(`/v1/apps/${appId}`);
console.log('app relationships:', Object.keys(app.body.data?.relationships||{}).join(', '));
console.log('');
for (const p of [
  `/v1/apps/${appId}/appDataUsages`,
  `/v1/apps/${appId}/appDataUsagesPublishState`,
  `/v1/apps/${appId}/dataUsages`,
  `/v1/apps/${appId}/appPrivacyDetails`,
  `/v1/appDataUsages?filter[app]=${appId}`,
  `/v1/dataCollections`,
  `/v1/appDataUsageCategory`,
]) {
  const r = await asc(p);
  console.log(`${r.status}  ${p}`);
}
