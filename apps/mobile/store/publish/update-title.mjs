import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({ keyFile: '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });
const pkg = 'com.taptarea.customer';
const newTitle = 'Tarea Home: Find a Handyman';
const { data: edit } = await ap.edits.insert({ packageName: pkg });
const editId = edit.id;
const { data: L } = await ap.edits.listings.get({ packageName: pkg, editId, language: 'en-US' });
await ap.edits.listings.update({ packageName: pkg, editId, language: 'en-US', requestBody: {
  language: 'en-US', title: newTitle, shortDescription: L.shortDescription, fullDescription: L.fullDescription,
}});
const { data: c } = await ap.edits.commit({ packageName: pkg, editId });
console.log(`✅ customer title -> "${newTitle}" (${newTitle.length} chars), committed ${c.id}`);
