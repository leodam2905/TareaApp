import { asc } from '/Users/monsegueadah/TareaApp/apps/mobile/store/appstore/asc.mjs';
for (const [name, id] of Object.entries({customer:'6784023441', pro:'6784029141'})) {
  const b = await asc(`/v1/builds?filter[app]=${id}&limit=3&sort=-version&fields[builds]=version,processingState,uploadedDate,expired`);
  console.log(`  ${name}:`);
  for (const r of (b.body?.data ?? []))
    console.log(`    build ${String(r.attributes.version).padEnd(4)} ${r.attributes.processingState}`);
}
