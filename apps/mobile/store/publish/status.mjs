import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({ keyFile: '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
for (const pkg of ['com.taptarea.customer','com.taptarea.handyman']) {
  const { data: edit } = await ap.edits.insert({ packageName: pkg });
  const eid = edit.id;
  const { data: L } = await ap.edits.listings.get({ packageName: pkg, editId: eid, language: 'en-US' });
  const imgs = {};
  for (const t of ['icon','featureGraphic','phoneScreenshots']) {
    const { data } = await ap.edits.images.list({ packageName: pkg, editId: eid, language:'en-US', imageType: t });
    imgs[t] = (data.images||[]).length;
  }
  let internal='?';
  try { const { data: tr } = await ap.edits.tracks.get({ packageName: pkg, editId: eid, track:'internal' }); internal=(tr.releases||[]).map(r=>r.status+' v'+r.versionCodes).join(','); } catch{}
  await ap.edits.delete({ packageName: pkg, editId: eid }).catch(()=>{});
  console.log(`\n${pkg}`);
  console.log(`  title: ${L.title}`);
  console.log(`  icon=${imgs.icon} feature=${imgs.featureGraphic} screenshots=${imgs.phoneScreenshots}`);
  console.log(`  internal track: ${internal}`);
}
