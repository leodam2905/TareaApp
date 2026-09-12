import { google } from "googleapis";
const auth = new google.auth.GoogleAuth({
  keyFile: "/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json",
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});
const ap = google.androidpublisher({ version: "v3", auth });

for (const pkg of ["com.taptarea.customer", "com.taptarea.handyman"]) {
  console.log(`\n=== ${pkg} ===`);
  const { data: edit } = await ap.edits.insert({ packageName: pkg });
  const eid = edit.id;
  try {
    for (const t of ["internal", "alpha", "beta", "production"]) {
      try {
        const { data } = await ap.edits.tracks.get({ packageName: pkg, editId: eid, track: t });
        for (const r of data.releases || [])
          console.log(`  ${t.padEnd(10)} status=${(r.status||'').padEnd(9)} vcodes=[${r.versionCodes||''}] name="${r.name||''}" notes=${r.releaseNotes?.length ? 'yes' : 'NO'}`);
        if (!(data.releases||[]).length) console.log(`  ${t.padEnd(10)} (no releases)`);
      } catch { console.log(`  ${t.padEnd(10)} (unavailable)`); }
    }
    // Every bundle Play has, so we can see whether 54 really landed.
    const { data: b } = await ap.edits.bundles.list({ packageName: pkg, editId: eid });
    console.log(`  bundles on Play: ${(b.bundle||[]).map(x=>x.versionCode).sort((a,c)=>a-c).join(', ')}`);
    // Listing completeness.
    const { data: L } = await ap.edits.listings.list({ packageName: pkg, editId: eid });
    for (const l of L.listings || [])
      console.log(`  listing ${l.language}: title=${l.title? 'yes':'NO'} short=${l.shortDescription? 'yes':'NO'} full=${l.fullDescription? 'yes':'NO'}`);
  } finally {
    await ap.edits.delete({ packageName: pkg, editId: eid }).catch(() => {});
  }
}
