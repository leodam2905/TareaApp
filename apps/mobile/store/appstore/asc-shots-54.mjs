import { asc } from '/Users/monsegueadah/TareaApp/apps/mobile/store/appstore/asc.mjs';
const LOC = { customer: '2c520405-7abb-4174-b9c8-d35c221d0df8', pro: 'd7ed744b-3457-4f1b-a4e9-2a2620bd25ba' };
for (const [name, locId] of Object.entries(LOC)) {
  console.log(`\n=== ${name} ===`);
  const s = await asc(`/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets?limit=10`);
  for (const set of (s.body?.data ?? [])) {
    const shots = await asc(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=12&fields[appScreenshots]=fileName,assetDeliveryState`);
    const list = shots.body?.data ?? [];
    const states = list.map(x => x.attributes?.assetDeliveryState?.state).join(',');
    console.log(`  ${set.attributes.screenshotDisplayType.padEnd(22)} ${list.length} shots  [${states}]`);
  }
  if (!(s.body?.data ?? []).length) console.log('  NO screenshot sets — nothing inherited');
}
