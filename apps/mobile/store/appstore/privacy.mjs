import { asc } from './asc.mjs';
// inspect appInfoLocalization attributes for a privacy field
const ai = await asc('/v1/apps/6784023441/appInfos');
const appInfoId = ai.body.data[0].id;
const loc = await asc(`/v1/appInfos/${appInfoId}/appInfoLocalizations`);
const en = loc.body.data.find(l=>l.attributes.locale==='en-US');
console.log('appInfoLocalization attrs:', Object.keys(en.attributes).join(', '));
// try set privacyPolicyUrl
const r = await asc(`/v1/appInfoLocalizations/${en.id}`, { method:'PATCH', body: JSON.stringify({
  data: { type:'appInfoLocalizations', id: en.id, attributes: { privacyPolicyUrl: 'https://taptarea.com/privacy' } }
})});
console.log('set privacyPolicyUrl ->', r.status, r.status>=300 ? JSON.stringify(r.body.errors).slice(0,200) : 'OK ('+r.body.data.attributes.privacyPolicyUrl+')');
