import { asc } from '/Users/monsegueadah/TareaApp/apps/mobile/store/appstore/asc.mjs';
const APPS = { customer: '6784023441', pro: '6784029141' };
for (const [name, id] of Object.entries(APPS)) {
  console.log(`\n=== ${name} (${id}) ===`);
  const v = await asc(`/v1/apps/${id}/appStoreVersions?limit=4&fields[appStoreVersions]=versionString,appStoreState,createdDate`);
  for (const r of (v.body?.data ?? []))
    console.log(`  version ${r.attributes.versionString.padEnd(8)} ${r.attributes.appStoreState.padEnd(24)} id=${r.id}`);
  const s = await asc(`/v1/apps/${id}/appStoreVersions?limit=1&filter[appStoreState]=PREPARE_FOR_SUBMISSION`);
  const editable = (s.body?.data ?? [])[0];
  console.log(`  editable version: ${editable ? editable.attributes.versionString + ' ' + editable.id : 'NONE — one must be created for 1.0.28'}`);
}
