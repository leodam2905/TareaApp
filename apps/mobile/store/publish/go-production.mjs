import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({ keyFile: '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
for (const [name, pkg] of [['Tarea Home','com.taptarea.customer'],['Tarea Pro','com.taptarea.handyman']]) {
  console.log(`\n=== ${name} (${pkg}) ===`);
  try {
    const { data: edit } = await ap.edits.insert({ packageName: pkg });
    const editId = edit.id;
    // find the version code on internal track
    const { data: internal } = await ap.edits.tracks.get({ packageName: pkg, editId, track: 'internal' });
    const vcodes = internal.releases?.[0]?.versionCodes || ['1'];
    console.log('  version codes:', vcodes.join(','));
    // set production track, full rollout
    await ap.edits.tracks.update({ packageName: pkg, editId, track: 'production', requestBody: {
      track: 'production',
      releases: [{ versionCodes: vcodes, status: 'completed', releaseNotes: [{ language:'en-US', text: 'Welcome to '+name+'!' }] }],
    }});
    console.log('  ✓ production track set (100% rollout)');
    const { data: c } = await ap.edits.commit({ packageName: pkg, editId });  // sends for review
    console.log(`  ✅ COMMITTED & SENT FOR REVIEW (edit ${c.id})`);
  } catch (e) {
    const msg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e.message;
    console.error('  ✖ FAILED:', msg);
  }
}
