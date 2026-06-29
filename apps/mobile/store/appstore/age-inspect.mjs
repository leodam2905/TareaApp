import { asc } from './asc.mjs';
const ver = await asc('/v1/apps/6784023441/appStoreVersions');
const verId = ver.body.data[0].id;
const r = await asc(`/v1/appStoreVersions/${verId}/ageRatingDeclaration`);
console.log('status', r.status);
if (r.body.data) {
  console.log('declaration id:', r.body.data.id);
  console.log('attributes:', JSON.stringify(r.body.data.attributes, null, 1));
} else console.log(JSON.stringify(r.body).slice(0,400));
