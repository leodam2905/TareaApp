import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
const auth = new google.auth.GoogleAuth({ keyFile: '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
const pkg = 'com.taptarea.customer';
const dir = '/Users/monsegueadah/Desktop/playstore-screenshots/submission/customer-v2';
const { data: edit } = await ap.edits.insert({ packageName: pkg });
const editId = edit.id;
await ap.edits.images.deleteall({ packageName: pkg, editId, language: 'en-US', imageType: 'phoneScreenshots' });
console.log('cleared old screenshots');
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.png')).sort()) {
  await ap.edits.images.upload({ packageName: pkg, editId, language:'en-US', imageType:'phoneScreenshots', media:{ mimeType:'image/png', body: fs.createReadStream(path.join(dir,f)) } });
  console.log('  ↑', f);
}
const { data: c } = await ap.edits.commit({ packageName: pkg, editId });
console.log('✅ committed', c.id);
