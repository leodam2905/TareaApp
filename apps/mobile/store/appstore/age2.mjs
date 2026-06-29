import { asc } from './asc.mjs';
const ai = await asc('/v1/apps/6784023441/appInfos');
const appInfoId = ai.body.data[0].id;
console.log('appInfo relationships:', Object.keys(ai.body.data[0].relationships||{}).join(', '));
const r = await asc(`/v1/appInfos/${appInfoId}/ageRatingDeclaration`);
console.log('ageRatingDeclaration via appInfo:', r.status);
if (r.body.data) { console.log('  id:', r.body.data.id); console.log('  attrs:', JSON.stringify(r.body.data.attributes).slice(0,800)); }
else console.log('  ', JSON.stringify(r.body).slice(0,300));
