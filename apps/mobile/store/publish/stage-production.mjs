import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({ keyFile: '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
for (const [name, pkg] of [['Tarea Home','com.taptarea.customer'],['Tarea Pro','com.taptarea.handyman']]) {
  try {
    const { data: edit } = await ap.edits.insert({ packageName: pkg });
    const editId = edit.id;
    const { data: internal } = await ap.edits.tracks.get({ packageName: pkg, editId, track: 'internal' });
    const vcodes = internal.releases?.[0]?.versionCodes || ['1'];
    await ap.edits.tracks.update({ packageName: pkg, editId, track: 'production', requestBody: {
      track: 'production',
      releases: [{ versionCodes: vcodes, status: 'draft', releaseNotes: [{ language:'en-US', text: 'Welcome to '+name+'!' }] }],
    }});
    const { data: c } = await ap.edits.commit({ packageName: pkg, editId });
    console.log(`${name}: ✅ draft production release staged (vcode ${vcodes.join(',')}) edit ${c.id}`);
  } catch (e) {
    console.error(`${name}: ✖`, e?.response?.data?.error?.message || e.message);
  }
}
