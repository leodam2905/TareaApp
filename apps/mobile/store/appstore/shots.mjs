import { asc } from './asc.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

async function upload(appId, dir, displayType='APP_IPHONE_67') {
  const ver = await asc(`/v1/apps/${appId}/appStoreVersions`);
  const verId = ver.body.data[0].id;
  const vLoc = await asc(`/v1/appStoreVersions/${verId}/appStoreVersionLocalizations`);
  const locId = vLoc.body.data.find(l=>l.attributes.locale==='en-US').id;
  // clean existing sets for this display type
  const sets = await asc(`/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
  for (const s of (sets.body.data||[])) if (s.attributes.screenshotDisplayType===displayType) await asc(`/v1/appScreenshotSets/${s.id}`,{method:'DELETE'});
  const setRes = await asc('/v1/appScreenshotSets',{method:'POST',body:JSON.stringify({data:{type:'appScreenshotSets',attributes:{screenshotDisplayType:displayType},relationships:{appStoreVersionLocalization:{data:{type:'appStoreVersionLocalizations',id:locId}}}}})});
  if (setRes.status>=300) { console.log('  set create FAIL', JSON.stringify(setRes.body.errors).slice(0,200)); return; }
  const setId = setRes.body.data.id;
  for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.png')).sort()) {
    const buf = fs.readFileSync(path.join(dir,f));
    const res = await asc('/v1/appScreenshots',{method:'POST',body:JSON.stringify({data:{type:'appScreenshots',attributes:{fileSize:buf.length,fileName:f},relationships:{appScreenshotSet:{data:{type:'appScreenshotSets',id:setId}}}}})});
    if (res.status>=300){ console.log(`  ${f} reserve FAIL`, JSON.stringify(res.body.errors).slice(0,200)); continue; }
    const shotId=res.body.data.id;
    for (const op of res.body.data.attributes.uploadOperations){
      const chunk=buf.subarray(op.offset,op.offset+op.length);
      const headers={}; (op.requestHeaders||[]).forEach(h=>headers[h.name]=h.value);
      await fetch(op.url,{method:op.method,headers,body:chunk});
    }
    const md5=crypto.createHash('md5').update(buf).digest('hex');
    const patch=await asc(`/v1/appScreenshots/${shotId}`,{method:'PATCH',body:JSON.stringify({data:{type:'appScreenshots',id:shotId,attributes:{uploaded:true,sourceFileChecksum:md5}}})});
    console.log(`  ${f}: ${patch.status==200?'✅':'patch '+patch.status}`);
  }
}
console.log('=== Tarea Home ==='); await upload('6784023441','/Users/monsegueadah/Desktop/playstore-screenshots/ios/customer');
console.log('=== Tarea Pro ==='); await upload('6784029141','/Users/monsegueadah/Desktop/playstore-screenshots/ios/handyman');
