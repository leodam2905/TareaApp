import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({ keyFile: '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
const pkg = 'com.taptarea.customer';
const { data: edit } = await ap.edits.insert({ packageName: pkg });
const eid = edit.id;
console.log(`=== ${pkg} ===`);
for (const t of ['internal','alpha','beta','production']) {
  try {
    const { data } = await ap.edits.tracks.get({ packageName: pkg, editId: eid, track: t });
    const rel = (data.releases||[]).map(r => `status=${r.status} vcodes=[${r.versionCodes||''}] name="${r.name||''}"`).join(' | ');
    console.log(`  ${t.padEnd(11)}: ${rel || '(no releases)'}`);
  } catch(e){ console.log(`  ${t.padEnd(11)}: ${e.response?.data?.error?.message||e.message}`); }
}
try {
  const { data } = await ap.edits.countryavailability.get({ packageName: pkg, editId: eid, track: 'internal' });
  console.log(`  country availability (internal): restWorld=${data.restOfWorld} countries=${(data.countries||[]).length}`);
} catch(e){ console.log('  country availability: '+(e.response?.data?.error?.message||e.message)); }
await ap.edits.delete({ packageName: pkg, editId: eid }).catch(()=>{});
