import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({ keyFile: '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
for (const pkg of ['com.taptarea.customer','com.taptarea.handyman']) {
  const { data: edit } = await ap.edits.insert({ packageName: pkg });
  const { data: L } = await ap.edits.listings.get({ packageName: pkg, editId: edit.id, language: 'en-US' });
  const imgs = {};
  for (const t of ['icon','featureGraphic','phoneScreenshots']) {
    const { data } = await ap.edits.images.list({ packageName: pkg, editId: edit.id, language: 'en-US', imageType: t });
    imgs[t] = (data.images||[]).length;
  }
  await ap.edits.delete({ packageName: pkg, editId: edit.id }).catch(()=>{});
  console.log(`\n${pkg}`);
  console.log(`  title: ${L.title}`);
  console.log(`  short: ${L.shortDescription}`);
  console.log(`  full : ${L.fullDescription.length} chars`);
  console.log(`  images: icon=${imgs.icon} featureGraphic=${imgs.featureGraphic} phoneScreenshots=${imgs.phoneScreenshots}`);
}
