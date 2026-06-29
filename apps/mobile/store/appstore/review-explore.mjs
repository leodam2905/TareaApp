import { asc } from './asc.mjs';
const ver = await asc('/v1/apps/6784023441/appStoreVersions');
const verId = ver.body.data[0].id;
console.log('versionId:', verId);
const r = await asc(`/v1/appStoreVersions/${verId}/appStoreReviewDetail`);
console.log('appStoreReviewDetail GET:', r.status);
if (r.body.data) console.log('  exists, id:', r.body.data.id, 'attrs:', JSON.stringify(r.body.data.attributes));
else console.log('  not set yet:', JSON.stringify(r.body).slice(0,200));
