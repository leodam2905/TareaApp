import { asc } from './asc.mjs';
for (const [name, appId] of [['Tarea Home','6784023441'],['Tarea Pro','6784029141']]) {
  console.log(`\n=== ${name} ===`);
  const builds = await asc(`/v1/builds?filter[app]=${appId}&limit=1`);
  const b = builds.body.data[0];
  console.log('  build usesNonExemptEncryption:', b.attributes.usesNonExemptEncryption, '| processingState:', b.attributes.processingState);
  // check idfa / app store version phased release etc
  const ver = await asc(`/v1/apps/${appId}/appStoreVersions?limit=1`);
  const v = ver.body.data[0];
  console.log('  version state:', v.attributes.appStoreState);
  // check appStoreVersionLocalizations completeness
  const loc = await asc(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`);
  const en = loc.body.data.find(l=>l.attributes.locale==='en-US');
  console.log('  desc len:', (en.attributes.description||'').length, '| keywords:', !!en.attributes.keywords, '| support:', !!en.attributes.supportUrl);
  // screenshots
  const sets = await asc(`/v1/appStoreVersionLocalizations/${en.id}/appScreenshotSets`);
  for (const s of (sets.body.data||[])) {
    const shots = await asc(`/v1/appScreenshotSets/${s.id}/appScreenshots`);
    console.log(`  screenshots[${s.attributes.screenshotDisplayType}]:`, (shots.body.data||[]).map(x=>x.attributes.assetDeliveryState?.state).join(','));
  }
}
