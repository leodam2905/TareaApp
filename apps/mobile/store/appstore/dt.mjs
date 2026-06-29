import { asc } from './asc.mjs';
const ver = await asc('/v1/apps/6784023441/appStoreVersions');
const verId = ver.body.data[0].id;
const vLoc = await asc(`/v1/appStoreVersions/${verId}/appStoreVersionLocalizations`);
const locId = vLoc.body.data.find(l=>l.attributes.locale==='en-US').id;
const r = await asc('/v1/appScreenshotSets',{method:'POST',body:JSON.stringify({data:{type:'appScreenshotSets',attributes:{screenshotDisplayType:'BOGUS'},relationships:{appStoreVersionLocalization:{data:{type:'appStoreVersionLocalizations',id:locId}}}}})});
console.log(r.body.errors?.[0]?.detail || JSON.stringify(r.body).slice(0,1500));
