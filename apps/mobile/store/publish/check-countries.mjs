import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({ keyFile: '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
for (const [name, pkg] of [['Tarea Home','com.taptarea.customer'],['Tarea Pro','com.taptarea.handyman']]) {
  const { data: edit } = await ap.edits.insert({ packageName: pkg });
  const { data: prod } = await ap.edits.tracks.get({ packageName: pkg, editId: edit.id, track: 'production' });
  const rel = prod.releases?.[0];
  const ct = rel?.countryTargeting;
  console.log(`${name}: release status=${rel?.status} | countries=${ct ? (ct.countries?.join(',')||'')+(ct.includeRestOfWorld?' +RoW':'') : 'NONE'}`);
  await ap.edits.delete({ packageName: pkg, editId: edit.id }).catch(()=>{});
}
