import { asc } from '/Users/monsegueadah/TareaApp/apps/mobile/store/appstore/asc.mjs';

const NOTES = {
  customer: `A redesigned home screen: a new banner, clearer shortcuts to posting a job, AI diagnosis, instant quotes and browsing pros, and your location at the top.`,
  pro: `A redesigned dashboard: shortcuts to find jobs, manage work, check earnings and set your availability, with your performance at a glance. You can now hide your earnings figure with a tap.`,
};
const APPS = { customer: '6784023441', pro: '6784029141' };

for (const [name, appId] of Object.entries(APPS)) {
  console.log(`\n=== ${name} ===`);

  // 1. The version record.
  const create = await asc('/v1/appStoreVersions', {
    method: 'POST',
    body: JSON.stringify({ data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: '1.0.29', releaseType: 'AFTER_APPROVAL' },
      relationships: { app: { data: { type: 'apps', id: appId } } },
    }}),
  });
  if (create.status >= 300) { console.log(`  create failed ${create.status}: ${JSON.stringify(create.body?.errors?.[0]?.detail)}`); continue; }
  const vid = create.body.data.id;
  console.log(`  created 1.0.29  id=${vid}`);

  // 2. Attach build 55.
  const builds = await asc(`/v1/builds?filter[app]=${appId}&filter[version]=55&limit=1`);
  const bid = (builds.body?.data ?? [])[0]?.id;
  if (!bid) { console.log('  BUILD 54 NOT FOUND'); continue; }
  const link = await asc(`/v1/appStoreVersions/${vid}/relationships/build`, {
    method: 'PATCH', body: JSON.stringify({ data: { type: 'builds', id: bid } }),
  });
  console.log(`  build 55 attached: ${link.status < 300 ? 'ok' : link.status + ' ' + JSON.stringify(link.body?.errors?.[0]?.detail)}`);

  // 3. What's New.
  const loc = await asc(`/v1/appStoreVersions/${vid}/appStoreVersionLocalizations?limit=20`);
  const enUS = (loc.body?.data ?? []).find(l => l.attributes.locale === 'en-US');
  if (enUS) {
    const r = await asc(`/v1/appStoreVersionLocalizations/${enUS.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'appStoreVersionLocalizations', id: enUS.id, attributes: { whatsNew: NOTES[name] } } }),
    });
    console.log(`  release notes: ${r.status < 300 ? 'set' : r.status}`);
    console.log(`  localization id=${enUS.id}`);
  } else {
    console.log(`  no en-US localization found (locales: ${(loc.body?.data??[]).map(l=>l.attributes.locale).join(', ')})`);
  }
}
