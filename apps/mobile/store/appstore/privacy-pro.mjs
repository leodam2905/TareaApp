import { asc } from './asc.mjs';
const ai = await asc('/v1/apps/6784029141/appInfos');
const appInfoId = ai.body.data[0].id;
const loc = await asc(`/v1/appInfos/${appInfoId}/appInfoLocalizations`);
const en = loc.body.data.find(l=>l.attributes.locale==='en-US');
const r = await asc(`/v1/appInfoLocalizations/${en.id}`, { method:'PATCH', body: JSON.stringify({
  data: { type:'appInfoLocalizations', id: en.id, attributes: { privacyPolicyUrl: 'https://taptarea.com/privacy' } }
})});
console.log('Tarea Pro privacyPolicyUrl ->', r.status==200?'OK':JSON.stringify(r.body.errors).slice(0,200));
